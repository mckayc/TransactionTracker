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

  newTransactions.forEach(newTx => {
    // Sanitize amount to ensure it's a number, default to 0 if invalid
    const amount = typeof newTx.amount === 'number' ? newTx.amount : 0;
    
    // FIX: The 'category' property from RawTransaction is not part of the final
    // Transaction object, so we destructure it out. The rest of the properties,
    // including the added `categoryId`, are spread into the new object.
    const { category, ...transactionData } = newTx;
    const transactionWithId: Transaction = {
        ...transactionData,
        amount,
        id: generateTransactionId(newTx),
    };

    if (!existingTxMap.has(transactionWithId.id)) {
      added.push(transactionWithId);
      existingTxMap.set(transactionWithId.id, transactionWithId); // Add to map to prevent duplicates within the same batch
    } else {
      duplicates.push({
        newTx: transactionWithId,
        existingTx: existingTxMap.get(transactionWithId.id)!,
      });
    }
  });

  return { added, duplicates };
};