// Advanced API client with relational pagination support

export interface TransactionQueryParams {
    limit?: number;
    offset?: number;
    search?: string;
    startDate?: string;
    endDate?: string;
    sort?: string;
    order?: 'asc' | 'desc';
    categoryIds?: string[];
    typeIds?: string[];
    accountIds?: string[];
    userIds?: string[];
    payeeIds?: string[];
}

export const api = {
    loadKey: async <T>(key: string): Promise<T | null> => {
        try {
            const response = await fetch(`/api/data/${key}`);
            if (!response.ok) return null;
            return await response.json();
        } catch (error) {
            console.warn(`API Load Key Error (${key}):`, error);
            return null;
        }
    },

    save: async (key: string, value: any): Promise<void> => {
        try {
            await fetch(`/api/data/${key}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(value),
            });
        } catch (error) {
            console.error(`API Save Error (${key}):`, error);
        }
    },

    // NEW: Relational Transaction Methods
    getTransactions: async (params: TransactionQueryParams): Promise<{ data: any[], total: number }> => {
        const query = new URLSearchParams();
        Object.entries(params).forEach(([key, val]) => {
            if (val !== undefined && val !== null && val !== '') {
                query.append(key, Array.isArray(val) ? val.join(',') : String(val));
            }
        });
        const response = await fetch(`/api/transactions?${query.toString()}`);
        if (!response.ok) throw new Error("Failed to fetch transactions");
        return await response.json();
    },

    saveTransactions: async (transactions: any[]): Promise<void> => {
        await fetch('/api/transactions/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(transactions),
        });
    },

    deleteTransactions: async (ids: string[]): Promise<void> => {
        await fetch('/api/transactions', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids }),
        });
    }
};