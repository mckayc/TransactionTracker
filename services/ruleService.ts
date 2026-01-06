
import type { RawTransaction, ReconciliationRule, Transaction, RuleCondition, Account } from '../types';

const evaluateCondition = (tx: RawTransaction | Transaction, condition: RuleCondition, accounts: Account[] = []): boolean => {
    let txValue: any;
    
    if (!condition || !condition.field) return true;

    if (condition.field === 'description') {
        txValue = (tx.description || '').toLowerCase();
        const condValue = String(condition.value || '').toLowerCase();
        switch (condition.operator) {
            case 'contains': return txValue.includes(condValue);
            case 'does_not_contain': return !txValue.includes(condValue);
            case 'equals': return txValue === condValue;
            case 'starts_with': return txValue.startsWith(condValue);
            case 'ends_with': return txValue.endsWith(condValue);
            default: return false;
        }
    } else if (condition.field === 'metadata') {
        const key = condition.metadataKey || '';
        const metadataValue = tx.metadata?.[key];
        
        if (condition.operator === 'exists') {
            return metadataValue !== undefined && metadataValue !== null && metadataValue.trim() !== '';
        }

        txValue = (metadataValue || '').toLowerCase();
        const condValue = String(condition.value || '').toLowerCase();
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
        const txAccountId = tx.accountId || '';
        if (condition.operator === 'equals') {
            return txAccountId === String(condition.value);
        } else {
            const account = accounts.find(a => a.id === txAccountId);
            const accountName = (account?.name || '').toLowerCase();
            const condValue = String(condition.value || '').toLowerCase();
            if (condition.operator === 'contains') return accountName.includes(condValue);
            if (condition.operator === 'does_not_contain') return !accountName.includes(condValue);
            return false;
        }
    }
    return false;
};

const matchesRule = (tx: RawTransaction | Transaction, rule: ReconciliationRule, accounts: Account[]): boolean => {
    if (rule.conditions && rule.conditions.length > 0) {
        const validConditions = rule.conditions.filter(c => 'field' in c) as RuleCondition[];
        if (validConditions.length === 0) return true;

        let result = evaluateCondition(tx, validConditions[0], accounts);

        for (let i = 0; i < validConditions.length - 1; i++) {
            const currentCond = validConditions[i];
            const nextCond = validConditions[i + 1];
            const logic = currentCond.nextLogic || 'AND';
            const nextResult = evaluateCondition(tx, nextCond, accounts);
            if (logic === 'AND') result = result && nextResult;
            else result = result || nextResult;
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
  if (!rules || rules.length === 0) return rawTransactions;

  const prioritizedRules = [...rules].reverse();

  return rawTransactions.map(tx => {
    let modifiedTx: RawTransaction & { categoryId?: string; isIgnored?: boolean; appliedRuleId?: string; typeId?: string; flowDesignationId?: string } = { ...tx };
    
    for (const rule of prioritizedRules) {
      if (matchesRule(modifiedTx, rule, accounts)) {
        modifiedTx.appliedRuleId = rule.id;
        if (rule.skipImport) modifiedTx.isIgnored = true;
        if (rule.setCategoryId) modifiedTx.categoryId = rule.setCategoryId;
        if (rule.setPayeeId) modifiedTx.payeeId = rule.setPayeeId;
        if (rule.setMerchantId) modifiedTx.merchantId = rule.setMerchantId;
        if (rule.setLocationId) modifiedTx.locationId = rule.setLocationId;
        if (rule.setUserId) modifiedTx.userId = rule.setUserId;
        if (rule.setTransactionTypeId) modifiedTx.typeId = rule.setTransactionTypeId;
        if (rule.setFlowDesignationId) modifiedTx.flowDesignationId = rule.setFlowDesignationId;

        if (rule.assignTagIds && rule.assignTagIds.length > 0) {
            const currentTags = new Set(modifiedTx.tagIds || []);
            rule.assignTagIds.forEach(id => currentTags.add(id));
            modifiedTx.tagIds = Array.from(currentTags);
        }
        return modifiedTx;
      }
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

  transactions.forEach(tx => {
    if (matchesRule(tx, rule, accounts)) {
      const updatedTx = { ...tx };
      let changed = false;

      if (rule.setCategoryId && updatedTx.categoryId !== rule.setCategoryId) { updatedTx.categoryId = rule.setCategoryId; changed = true; }
      if (rule.setPayeeId && updatedTx.payeeId !== rule.setPayeeId) { updatedTx.payeeId = rule.setPayeeId; changed = true; }
      if (rule.setMerchantId && updatedTx.merchantId !== rule.setMerchantId) { updatedTx.merchantId = rule.setMerchantId; changed = true; }
      if (rule.setLocationId && updatedTx.locationId !== rule.setLocationId) { updatedTx.locationId = rule.setLocationId; changed = true; }
      if (rule.setUserId && updatedTx.userId !== rule.setUserId) { updatedTx.userId = rule.setUserId; changed = true; }
      if (rule.setTransactionTypeId && updatedTx.typeId !== rule.setTransactionTypeId) { updatedTx.typeId = rule.setTransactionTypeId; changed = true; }
      if (rule.setFlowDesignationId && updatedTx.flowDesignationId !== rule.setFlowDesignationId) { updatedTx.flowDesignationId = rule.setFlowDesignationId; changed = true; }
      
      if (rule.assignTagIds && rule.assignTagIds.length > 0) {
          const originalTagSet = new Set(updatedTx.tagIds || []);
          const newTagSet = new Set(updatedTx.tagIds || []);
          rule.assignTagIds.forEach(id => newTagSet.add(id));
          if (newTagSet.size > originalTagSet.size) { updatedTx.tagIds = Array.from(newTagSet); changed = true; }
      }
      
      if (changed) matchedPairs.push({ original: tx, updated: updatedTx });
    }
  });

  return matchedPairs;
};
