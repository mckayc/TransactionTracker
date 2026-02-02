
import type { Transaction, RawTransaction, DuplicatePair } from '../types';

/**
 * Generates a consistent, unique ID for a transaction based on its core properties.
 * This is used to detect and prevent duplicate entries.
 */
export const generateTransactionId = (tx: RawTransaction): string => {
  const date = tx.date || '';
  const desc = (tx.originalDescription || tx.description || '').trim().toLowerCase();
  const amt = typeof tx.amount === 'number' ? tx.amount.toFixed(2) : '0.00';
  const acct = tx.accountId || '';
  
  const key = `${date}|${desc}|${amt}|${acct}`;
  return btoa(unescape(encodeURIComponent(key)));
};

/**
 * Generates a robust signature for detecting duplicates.
 */
export const getTransactionSignature = (tx: Transaction | RawTransaction): string => {
    const date = tx.date;
    const amount = typeof tx.amount === 'number' ? Math.abs(tx.amount).toFixed(2) : '0.00';
    let desc = (tx.originalDescription || tx.description || '').trim().toLowerCase();
    desc = desc.replace(/id nbr:.*$/i, '').replace(/[\s\-_]+/g, ' ').trim();
    const account = tx.accountId || '';
    return `${date}|${amount}|${desc}|${account}`;
};

/**
 * Merges new transactions with an existing list, filtering out duplicates.
 * UPDATED: Resilient against Ghost Records.
 */
export const mergeTransactions = (
  existingTransactions: Transaction[],
  newTransactions: (RawTransaction & { categoryId: string })[]
): { added: Transaction[]; duplicates: DuplicatePair[] } => {
  // Identify "Valid" existing records. Ghosts (isParent=1 with no children) are treated as non-existent 
  // for the purposes of merge protection so they can be overwritten.
  const parentIds = new Set(existingTransactions.map(t => t.parentTransactionId).filter(Boolean));
  
  const existingTxMap = new Map(existingTransactions.map(tx => [tx.id, tx]));
  const added: Transaction[] = [];
  const duplicates: DuplicatePair[] = [];

  const signatureCounts = new Map<string, number>();
  existingTransactions.forEach(tx => {
      // Logic: If a transaction is a parent with children, count it as a hard duplicate.
      // If it's a parent with NO children, it's a ghost - don't let it block a fresh import.
      if (tx.isParent && !parentIds.has(tx.id)) return; 

      const sig = getTransactionSignature(tx);
      signatureCounts.set(sig, (signatureCounts.get(sig) || 0) + 1);
  });

  newTransactions.forEach(newTx => {
    const amount = typeof newTx.amount === 'number' ? newTx.amount : 0;
    const id = generateTransactionId(newTx);
    const transactionWithId: Transaction = { ...newTx, amount, id };

    const signature = getTransactionSignature(transactionWithId);
    const existingCount = signatureCounts.get(signature) || 0;

    const existingMatch = existingTxMap.get(id);
    const isGhostMatch = existingMatch?.isParent && !parentIds.has(existingMatch.id);

    // Check 1: Exact ID Match (but ignore if it matches a Ghost)
    if (existingTxMap.has(id) && !isGhostMatch) {
      duplicates.push({
        newTx: transactionWithId,
        existingTx: existingTxMap.get(id)!,
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
