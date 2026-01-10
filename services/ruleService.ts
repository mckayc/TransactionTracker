
import type { RawTransaction, ReconciliationRule, Transaction, RuleCondition, Account } from '../types';

/**
 * Collapses multiple spaces into a single space, trims, and lowercases.
 * This ensures that 'WORD   A' and 'WORD A' are treated as identical logic tokens.
 */
const normalizeText = (text: string): string => {
    return (text || '').replace(/\s+/g, ' ').trim().toLowerCase();
};

const evaluateCondition = (tx: RawTransaction | Transaction, condition: RuleCondition, accounts: Account[] = []): boolean => {
    if (!tx || !condition || !condition.field) return true;

    // Helper to evaluate a single token against the tx field
    const checkValue = (actualValue: string, expectedValue: string): boolean => {
        const normActual = normalizeText(actualValue);
        const normExpected = normalizeText(expectedValue);
        
        if (!normExpected) return false;

        switch (condition.operator) {
            case 'contains': return normActual.includes(normExpected);
            case 'does_not_contain': return !normActual.includes(normExpected);
            case 'equals': return normActual === normExpected;
            case 'starts_with': return normActual.startsWith(normExpected);
            case 'ends_with': return normActual.endsWith(normExpected);
            case 'regex_match': 
                try {
                    return new RegExp(expectedValue.trim(), 'i').test(actualValue);
                } catch (e) {
                    return false;
                }
            default: return false;
        }
    };

    if (condition.field === 'description') {
        const txValue = (tx.originalDescription || tx.description || '');
        const condValue = String(condition.value || '');
        
        // Handle inline OR logic: split by ||
        const tokens = condValue.split(/\s*\|\|\s*/).filter(Boolean);
        if (tokens.length <= 1) return checkValue(txValue, condValue);
        
        // Logical NOT check: Must not contain ANY of the tokens (Logical AND NOT)
        if (condition.operator === 'does_not_contain') {
            return tokens.every(token => checkValue(txValue, token));
        }
        // Logical OR: match any token in the group
        return tokens.some(token => checkValue(txValue, token));

    } else if (condition.field === 'metadata') {
        const key = condition.metadataKey || '';
        const metadataValue = tx.metadata?.[key];
        
        if (condition.operator === 'exists') {
            return metadataValue !== undefined && metadataValue !== null && String(metadataValue).trim() !== '';
        }

        const txValue = String(metadataValue || '');
        const condValue = String(condition.value || '');
        const tokens = condValue.split(/\s*\|\|\s*/).filter(Boolean);
        
        if (tokens.length <= 1) return checkValue(txValue, condValue);
        if (condition.operator === 'does_not_contain') {
            return tokens.every(token => checkValue(txValue, token));
        }
        return tokens.some(token => checkValue(txValue, token));

    } else if (condition.field === 'amount') {
        const actualAmount = tx.amount || 0;
        const condValue = Number(condition.value);
        if (isNaN(condValue)) return false;
        switch (condition.operator) {
            case 'equals': return Math.abs(actualAmount - condValue) < 0.01;
            case 'greater_than': return actualAmount > condValue;
            case 'less_than': return actualAmount < condValue;
            default: return false;
        }
    } else if (condition.field === 'accountId') {
        const txAccountId = tx.accountId || '';
        if (condition.operator === 'equals') {
            return txAccountId === String(condition.value);
        } else {
            const account = (accounts || []).find(a => a && a.id === txAccountId);
            const accountName = account?.name || '';
            const condValue = String(condition.value || '');
            return checkValue(accountName, condValue);
        }
    } else if (condition.field === 'counterpartyId') {
        const txValue = tx.counterpartyId || '';
        const condValue = String(condition.value || '');
        if (condition.operator === 'equals') return txValue === condValue;
        return false;
    } else if (condition.field === 'locationId') {
        const txValue = tx.locationId || '';
        const condValue = String(condition.value || '');
        if (condition.operator === 'equals') return txValue === condValue;
        return false;
    }
    return false;
};

const matchesRule = (tx: RawTransaction | Transaction, rule: ReconciliationRule, accounts: Account[]): boolean => {
    if (!rule || !rule.id) return false;
    
    if (rule.conditions && rule.conditions.length > 0) {
        const validConditions = rule.conditions.filter(c => c && 'field' in c) as RuleCondition[];
        
        if (validConditions.length === 0) return true;

        let result = evaluateCondition(tx, validConditions[0], accounts);

        for (let i = 0; i < validConditions.length - 1; i++) {
            const currentCond = validConditions[i];
            const nextCond = validConditions[i + 1];
            if (!nextCond) continue;

            const logic = currentCond.nextLogic || 'AND';
            const nextResult = evaluateCondition(tx, nextCond, accounts);

            if (logic === 'AND') {
                result = result && nextResult;
            } else {
                result = result || nextResult;
            }
        }
        
        return result;
    }
    return true;
};

export const applyRulesToTransactions = (
  rawTransactions: RawTransaction[],
  rules: ReconciliationRule[],
  accounts: Account[] = []
): (RawTransaction & { categoryId?: string; isIgnored?: boolean })[] => {
  const safeRules = (rules || []).filter(r => r && r.id);
  if (safeRules.length === 0) {
    return rawTransactions;
  }

  return rawTransactions.filter(Boolean).map(tx => {
    let modifiedTx: RawTransaction & { categoryId?: string; isIgnored?: boolean; appliedRuleId?: string; appliedRuleIds?: string[] } = { ...tx };
    const matchedRuleIds: string[] = [];
    
    if (!modifiedTx.originalDescription) {
        modifiedTx.originalDescription = modifiedTx.description;
    }

    for (const rule of safeRules) {
      if (matchesRule(modifiedTx, rule, accounts)) {
        matchedRuleIds.push(rule.id);
        
        if (rule.skipImport) {
            modifiedTx.isIgnored = true;
        }
        if (rule.setCategoryId) {
          modifiedTx.categoryId = rule.setCategoryId;
        }
        // Support both new 'setCounterpartyId' and legacy 'setPayeeId'
        const targetCounterpartyId = rule.setCounterpartyId || rule.setPayeeId;
        if (targetCounterpartyId) {
          modifiedTx.counterpartyId = targetCounterpartyId;
        }
        if (rule.setLocationId) {
          modifiedTx.locationId = rule.setLocationId;
        }
        if (rule.setUserId) {
          modifiedTx.userId = rule.setUserId;
        }
        if (rule.setTransactionTypeId) {
          modifiedTx.typeId = rule.setTransactionTypeId;
        }
        if (rule.setDescription) {
          modifiedTx.description = rule.setDescription;
        }
        if (rule.assignTagIds && rule.assignTagIds.length > 0) {
            const currentTags = new Set(modifiedTx.tagIds || []);
            rule.assignTagIds.forEach(id => { if(id) currentTags.add(id); });
            modifiedTx.tagIds = Array.from(currentTags);
        }
      }
    }
    
    if (matchedRuleIds.length > 0) {
        modifiedTx.appliedRuleId = matchedRuleIds[0];
        modifiedTx.appliedRuleIds = matchedRuleIds;
    }

    return modifiedTx;
  });
};

export const findMatchingTransactions = (
  transactions: Transaction[],
  rule: ReconciliationRule,
  accounts: Account[] = []
): { original: Transaction; updated: Transaction }[] => {
  const matchedPairs: { original: Transaction; updated: Transaction }[] = [];
  if (!rule || !rule.id) return [];

  (transactions || []).filter(Boolean).forEach(tx => {
    if (matchesRule(tx, rule, accounts)) {
      const updatedTx = { ...tx };
      let changed = false;

      if (!updatedTx.originalDescription) {
          updatedTx.originalDescription = updatedTx.description;
      }

      if (rule.setCategoryId && updatedTx.categoryId !== rule.setCategoryId) {
        updatedTx.categoryId = rule.setCategoryId;
        changed = true;
      }
      
      const targetCounterpartyId = rule.setCounterpartyId || rule.setPayeeId;
      if (targetCounterpartyId && updatedTx.counterpartyId !== targetCounterpartyId) {
        updatedTx.counterpartyId = targetCounterpartyId;
        changed = true;
      }
      if (rule.setLocationId && updatedTx.locationId !== rule.setLocationId) {
        updatedTx.locationId = rule.setLocationId;
        changed = true;
      }
      if (rule.setUserId && updatedTx.userId !== rule.setUserId) {
        updatedTx.userId = rule.setUserId;
        changed = true;
      }
      if (rule.setTransactionTypeId && updatedTx.typeId !== rule.setTransactionTypeId) {
        updatedTx.typeId = rule.setTransactionTypeId;
        changed = true;
      }
      if (rule.setDescription && updatedTx.description !== rule.setDescription) {
        updatedTx.description = rule.setDescription;
        changed = true;
      }
      if (rule.assignTagIds && rule.assignTagIds.length > 0) {
          const originalTagSet = new Set(updatedTx.tagIds || []);
          const newTagSet = new Set(updatedTx.tagIds || []);
          rule.assignTagIds.forEach(id => { if(id) newTagSet.add(id); });
          
          if (newTagSet.size > originalTagSet.size) {
              updatedTx.tagIds = Array.from(newTagSet);
              changed = true;
          }
      }
      
      if (changed) {
        matchedPairs.push({ original: tx, updated: updatedTx });
      }
    }
  });

  return matchedPairs;
};
