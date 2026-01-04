const MAX_RETRIES = 3;
const INITIAL_DELAY = 1000;

const fetchWithRetry = async (url: string, options: RequestInit = {}, retries = MAX_RETRIES): Promise<Response> => {
    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            if (retries > 0 && (response.status >= 500 || response.status === 429)) {
                await new Promise(res => setTimeout(res, INITIAL_DELAY * (MAX_RETRIES - retries + 1)));
                return fetchWithRetry(url, options, retries - 1);
            }
            throw new Error(`API Error: ${response.status}`);
        }
        return response;
    } catch (error) {
        if (retries > 0) {
            await new Promise(res => setTimeout(res, INITIAL_DELAY));
            return fetchWithRetry(url, options, retries - 1);
        }
        throw error;
    }
};

export const api = {
    // Loads small entities (accounts, categories, config)
    loadBootData: async (): Promise<Record<string, any>> => {
        const response = await fetchWithRetry('/api/boot');
        return await response.json();
    },

    /**
     * Fix for: Error in file App.tsx on line 97: Property 'loadAll' does not exist
     */
    loadAll: async (): Promise<Record<string, any>> => {
        const data = await api.loadBootData();
        // server.js /api/boot returns { accounts, categories, ..., config: { ... } }
        // App.tsx expects a flat object containing all state keys.
        return { ...data, ...data.config };
    },

    // Paged transaction fetching
    getTransactions: async (params: { limit: number, offset: number, search?: string, startDate?: string, endDate?: string }): Promise<{ items: any[], total: number }> => {
        const query = new URLSearchParams(params as any).toString();
        const response = await fetchWithRetry(`/api/transactions?${query}`);
        return await response.json();
    },

    // Fast stats for dashboard
    getStats: async (params: { startDate?: string, endDate?: string }): Promise<any[]> => {
        const query = new URLSearchParams(params as any).toString();
        const response = await fetchWithRetry(`/api/stats?${query}`);
        return await response.json();
    },

    saveTransaction: async (tx: any): Promise<void> => {
        await fetchWithRetry('/api/transactions/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify([tx]),
        });
    },

    saveBulkTransactions: async (txs: any[]): Promise<void> => {
        await fetchWithRetry('/api/transactions/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(txs),
        });
    },

    deleteTransaction: async (id: string): Promise<void> => {
        await fetchWithRetry(`/api/transactions/${id}`, { method: 'DELETE' });
    },

    saveEntity: async (table: string, data: any): Promise<void> => {
        await fetchWithRetry(`/api/data/${table}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
    },

    /**
     * Fix for: Error in file App.tsx on line 143/239: Property 'save' does not exist
     * Fix for settings page errors on lines 210-221
     */
    save: async (key: string, value: any): Promise<void> => {
        if (key === 'transactions') {
            return api.saveBulkTransactions(value);
        }
        // Generic entity save
        return api.saveEntity(key, value);
    },

    resetDatabase: async (): Promise<boolean> => {
        const response = await fetch('/api/admin/reset', { method: 'POST' });
        return response.ok;
    }
};