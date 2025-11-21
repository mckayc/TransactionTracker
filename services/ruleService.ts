
import type { RawTransaction, ReconciliationRule, Transaction, RuleCondition } from '../types';

const evaluateCondition = (tx: RawTransaction | Transaction, condition: RuleCondition): boolean => {
    let txValue: any;
    
    if (condition.field === 'description') {
        txValue = tx.description.toLowerCase();
        const condValue = String(condition.value).toLowerCase();
        switch (condition.operator) {
            case 'contains': return txValue.includes(condValue);
            case 'does_not_contain': return !txValue.includes(condValue);
            case 'equals': return txValue === condValue;
            case 'starts_with': return txValue.startsWith(condValue);
            case 'ends_with': return txValue.endsWith(condValue);
            default: return false;
        }
    } else if (condition.field === 'amount') {
        txValue = tx.amount;
        const condValue = Number(condition.value);
        if (isNaN(condValue)) return false;
        switch (condition.operator) {
            case 'equals': return Math.abs(txValue - condValue) < 0.01;
            case 'greater_than': return txValue > condValue;
            case 'less_than': return txValue < condValue;
            default: return false;
        }
    } else if (condition.field === 'accountId') {
        txValue = tx.accountId;
        const condValue = String(condition.value);
        switch (condition.operator) {
            case 'equals': return txValue === condValue;
            default: return false;
        }
    }
    return false;
};

const matchesRule = (tx: RawTransaction | Transaction, rule: ReconciliationRule): boolean => {
    // 1. Check for new condition structure
    if (rule.conditions && rule.conditions.length > 0) {
        const logic = rule.matchLogic || 'AND';
        if (logic === 'AND') {
            return rule.conditions.every(c => evaluateCondition(tx, c));
        } else { // OR
            return rule.conditions.some(c => evaluateCondition(tx, c));
        }
    }

    // 2. Fallback to legacy simple conditions
    // Description
    if (rule.descriptionContains) {
        if (!tx.description.toLowerCase().includes(rule.descriptionContains.toLowerCase())) {
            return false;
        }
    }
    // Account
    if (rule.accountId) {
        if (tx.accountId !== rule.accountId) {
            return false;
        }
    }
    // Amount
    if (rule.amountEquals !== undefined && rule.amountEquals !== null) {
        if (Math.abs(tx.amount - rule.amountEquals) >= 0.01) {
            return false;
        }
    }

    return true;
};

export const applyRulesToTransactions = (
  rawTransactions: RawTransaction[],
  rules: ReconciliationRule[],
): (RawTransaction & { categoryId?: string })[] => {
  if (!rules || rules.length === 0) {
    return rawTransactions;
  }

  return rawTransactions.map(tx => {
    let modifiedTx: RawTransaction & { categoryId?: string } = { ...tx };
    
    // Find the first rule that matches this transaction
    for (const rule of rules) {
      if (matchesRule(modifiedTx, rule)) {
        // A rule matches, apply actions
        if (rule.setCategoryId) {
          modifiedTx.categoryId = rule.setCategoryId;
        }
        if (rule.setPayeeId) {
          modifiedTx.payeeId = rule.setPayeeId;
        }
        if (rule.setTransactionTypeId) {
          modifiedTx.typeId = rule.setTransactionTypeId;
        }
        if (rule.setDescription) {
            // Save original description if not already saved
            if (!modifiedTx.originalDescription) {
                modifiedTx.originalDescription = modifiedTx.description;
            }
            modifiedTx.description = rule.setDescription;
        }
        // First matching rule wins, so we break
        return modifiedTx;
      }
    }
    
    // If no rule matches, return the transaction as is
    return modifiedTx;
  });
};

export const findMatchingTransactions = (
  transactions: Transaction[],
  rule: ReconciliationRule,
): { original: Transaction; updated: Transaction }[] => {
  const matchedPairs: { original: Transaction; updated: Transaction }[] = [];

  transactions.forEach(tx => {
    if (matchesRule(tx, rule)) {
      const updatedTx = { ...tx };
      let changed = false;

      if (rule.setCategoryId && updatedTx.categoryId !== rule.setCategoryId) {
        updatedTx.categoryId = rule.setCategoryId;
        changed = true;
      }
      if (rule.setPayeeId && updatedTx.payeeId !== rule.setPayeeId) {
        updatedTx.payeeId = rule.setPayeeId;
        changed = true;
      }
      if (rule.setTransactionTypeId && updatedTx.typeId !== rule.setTransactionTypeId) {
        updatedTx.typeId = rule.setTransactionTypeId;
        changed = true;
      }
      if (rule.setDescription && updatedTx.description !== rule.setDescription) {
          if (!updatedTx.originalDescription) {
              updatedTx.originalDescription = updatedTx.description;
          }
          updatedTx.description = rule.setDescription;
          changed = true;
      }
      
      if (changed) {
        matchedPairs.push({ original: tx, updated: updatedTx });
      }
    }
  });

  return matchedPairs;
};