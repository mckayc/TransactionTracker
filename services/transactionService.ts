
import type { Transaction, RawTransaction, DuplicatePair } from '../types';

/**
 * Generates a consistent, unique ID for a transaction based on its core properties.
 * This is used to detect and prevent duplicate entries.
 */
export const generateTransactionId = (tx: RawTransaction): string => {
  // Use a predictable order for the key
  const date = tx.date || '';
  const desc = (tx.description || '').trim().toLowerCase();
  const amt = typeof tx.amount === 'number' ? tx.amount.toFixed(2) : '0.00';
  const acct = tx.accountId || '';
  
  const key = `${date}|${desc}|${amt}|${acct}`;
  // Browser-safe method to base64 encode
  return btoa(unescape(encodeURIComponent(key)));
};

/**
 * Generates a robust signature for detecting duplicates even if metadata has changed.
 * Includes: Date, Amount, Normalized Description, and Account.
 */
export const getTransactionSignature = (tx: Transaction | RawTransaction): string => {
    const date = tx.date;
    const amount = typeof tx.amount === 'number' ? Math.abs(tx.amount).toFixed(2) : '0.00';
    // Normalized description: lowercase, trimmed, remove common noise like IDs if possible
    let desc = (tx.description || '').trim().toLowerCase();
    // Strip common bank noise to increase match probability
    desc = desc.replace(/id nbr:.*$/i, '').replace(/[\s\-_]+/g, ' ').trim();
    
    const account = tx.accountId || '';
    return `${date}|${amount}|${desc}|${account}`;
};

/**
 * Merges new transactions with an existing list, filtering out duplicates.
 */
export const mergeTransactions = (
  existingTransactions: Transaction[],
  newTransactions: (RawTransaction & { categoryId: string })[]
): { added: Transaction[]; duplicates: DuplicatePair[] } => {
  const existingTxMap = new Map(existingTransactions.map(tx => [tx.id, tx]));
  const added: Transaction[] = [];
  const duplicates: DuplicatePair[] = [];

  // Build a frequency map of existing signatures to handle multiple identical transactions
  const signatureCounts = new Map<string, number>();
  existingTransactions.forEach(tx => {
      const sig = getTransactionSignature(tx);
      signatureCounts.set(sig, (signatureCounts.get(sig) || 0) + 1);
  });

  newTransactions.forEach(newTx => {
    const amount = typeof newTx.amount === 'number' ? newTx.amount : 0;
    
    const transactionWithId: Transaction = {
        ...newTx,
        amount,
        id: generateTransactionId(newTx),
    };

    const signature = getTransactionSignature(transactionWithId);
    const existingCount = signatureCounts.get(signature) || 0;

    // Check 1: Exact ID Match
    if (existingTxMap.has(transactionWithId.id)) {
      duplicates.push({
        newTx: transactionWithId,
        existingTx: existingTxMap.get(transactionWithId.id)!,
      });
      if (existingCount > 0) signatureCounts.set(signature, existingCount - 1);
    } 
    // Check 2: Signature Match
    else if (existingCount > 0) {
        const match = existingTransactions.find(tx => getTransactionSignature(tx) === signature);
        duplicates.push({
            newTx: transactionWithId,
            existingTx: match || existingTransactions[0],
        });
        signatureCounts.set(signature, existingCount - 1);
    }
    else {
      added.push(transactionWithId);
      existingTxMap.set(transactionWithId.id, transactionWithId); 
      signatureCounts.set(signature, (signatureCounts.get(signature) || 0) + 1);
    }
  });

  return { added, duplicates };
};
