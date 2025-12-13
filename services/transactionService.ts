
import type { Transaction, RawTransaction, DuplicatePair } from '../types';

/**
 * Generates a consistent, unique ID for a transaction based on its core properties.
 * This is used to detect and prevent duplicate entries.
 * @param tx The raw transaction object from the AI.
 * @returns A base64 encoded string ID.
 */
export const generateTransactionId = (tx: RawTransaction): string => {
  const key = `${tx.date}|${tx.description.trim().toLowerCase()}|${tx.amount}|${tx.typeId}|${tx.accountId}|${tx.userId}`;
  // Browser-safe method to base64 encode UTF-8 strings.
  return btoa(unescape(encodeURIComponent(key)));
};

/**
 * Generates a robust signature for detecting duplicates even if metadata (User, Type, Category) has changed.
 * Includes: Date, Amount, Description (cleaned), Account.
 */
const getTransactionSignature = (tx: Transaction | RawTransaction): string => {
    const date = tx.date;
    const amount = typeof tx.amount === 'number' ? tx.amount.toFixed(2) : '0.00';
    // Normalized description: lowercase, trimmed
    const desc = (tx.description || '').trim().toLowerCase();
    const account = tx.accountId || '';
    return `${date}|${amount}|${desc}|${account}`;
};

/**
 * Merges new transactions with an existing list, filtering out duplicates.
 * @param existingTransactions The current list of transactions.
 * @param newTransactions The new raw transactions to be processed.
 * @returns An object containing the list of newly added transactions and a list of duplicate pairs found.
 */
export const mergeTransactions = (
  existingTransactions: Transaction[],
  // FIX: The incoming transactions have been processed to include a categoryId.
  newTransactions: (RawTransaction & { categoryId: string })[]
): { added: Transaction[]; duplicates: DuplicatePair[] } => {
  const existingTxMap = new Map(existingTransactions.map(tx => [tx.id, tx]));
  const added: Transaction[] = [];
  const duplicates: DuplicatePair[] = [];

  // Build a frequency map of existing signatures to handle multiple identical transactions (e.g. 2 coffees for $5 on same day)
  const signatureCounts = new Map<string, number>();
  existingTransactions.forEach(tx => {
      const sig = getTransactionSignature(tx);
      signatureCounts.set(sig, (signatureCounts.get(sig) || 0) + 1);
  });

  newTransactions.forEach(newTx => {
    // Sanitize amount to ensure it's a number, default to 0 if invalid
    const amount = typeof newTx.amount === 'number' ? newTx.amount : 0;
    
    // We retain the original 'category' string in the new transaction object to satisfy the Transaction interface.
    const transactionWithId: Transaction = {
        ...newTx,
        amount,
        id: generateTransactionId(newTx),
    };

    const signature = getTransactionSignature(transactionWithId);
    const existingCount = signatureCounts.get(signature) || 0;

    // Check 1: Exact ID Match (Legacy/Strict)
    if (existingTxMap.has(transactionWithId.id)) {
      duplicates.push({
        newTx: transactionWithId,
        existingTx: existingTxMap.get(transactionWithId.id)!,
      });
      // Decrement count as this existing transaction is "claimed"
      if (existingCount > 0) signatureCounts.set(signature, existingCount - 1);
    } 
    // Check 2: Robust Signature Match (Smart)
    // If the ID didn't match (e.g. User changed), but the core signature matches an available existing transaction
    else if (existingCount > 0) {
        // Find the existing transaction that matches this signature (just take the first one available)
        const match = existingTransactions.find(tx => getTransactionSignature(tx) === signature); // This find is simplified; in a large set we might want a better lookup, but iterating for the match is okay here.
        // We really want to find one that hasn't been 'claimed' yet if we were tracking strictly, 
        // but for the purpose of the duplicate review UI, matching any valid one is helpful context.
        
        duplicates.push({
            newTx: transactionWithId,
            existingTx: match || existingTransactions[0], // Fallback shouldn't happen due to count check
        });
        signatureCounts.set(signature, existingCount - 1);
    }
    else {
      added.push(transactionWithId);
      // Add to map to prevent duplicates within the same batch
      existingTxMap.set(transactionWithId.id, transactionWithId); 
      // Also update signature count for the batch itself
      signatureCounts.set(signature, (signatureCounts.get(signature) || 0) + 1);
    }
  });

  return { added, duplicates };
};
