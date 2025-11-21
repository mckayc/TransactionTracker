
import type { RawTransaction, ReconciliationRule, Transaction } from '../types';

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
      let conditionsMet = true;

      // Condition: descriptionContains
      if (rule.descriptionContains) {
        if (!modifiedTx.description.toLowerCase().includes(rule.descriptionContains.toLowerCase())) {
          conditionsMet = false;
        }
      }

      // Condition: accountId
      if (conditionsMet && rule.accountId) {
        if (modifiedTx.accountId !== rule.accountId) {
          conditionsMet = false;
        }
      }
      
      // Condition: amountEquals
      if (conditionsMet && rule.amountEquals !== undefined && rule.amountEquals !== null) {
        if (modifiedTx.amount !== rule.amountEquals) {
            conditionsMet = false;
        }
      }

      if (conditionsMet) {
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
    let conditionsMet = true;
    
    if (rule.descriptionContains) {
      if (!tx.description.toLowerCase().includes(rule.descriptionContains.toLowerCase())) {
        conditionsMet = false;
      }
    }

    if (conditionsMet && rule.accountId) {
      if (tx.accountId !== rule.accountId) {
        conditionsMet = false;
      }
    }

    if (conditionsMet && rule.amountEquals !== undefined && rule.amountEquals !== null) {
      if (tx.amount !== rule.amountEquals) {
          conditionsMet = false;
      }
    }

    if (conditionsMet) {
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