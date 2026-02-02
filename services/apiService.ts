
const MAX_RETRIES = 3;
const INITIAL_DELAY = 1000;

const fetchWithRetry = async (url: string, options: RequestInit = {}, retries = MAX_RETRIES): Promise<Response> => {
    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            const errorBody = await response.text().catch(() => 'No response body');
            console.error(`[API] Failure: ${options.method || 'GET'} ${url} - Status: ${response.status}. Body: ${errorBody}`);
            
            if (retries > 0 && (response.status >= 500 || response.status === 429)) {
                const delay = INITIAL_DELAY * (MAX_RETRIES - retries + 1);
                console.log(`[API] Retrying in ${delay}ms... (${retries} attempts left)`);
                await new Promise(res => setTimeout(res, delay));
                return fetchWithRetry(url, options, retries - 1);
            }
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }
        return response;
    } catch (error) {
        console.error(`[API] Network or System Error for ${url}:`, error);
        if (retries > 0) {
            const delay = INITIAL_DELAY * (MAX_RETRIES - retries + 1);
            await new Promise(res => setTimeout(res, delay));
            return fetchWithRetry(url, options, retries - 1);
        }
        throw error;
    }
};

export const api = {
    loadAll: async (): Promise<Record<string, any>> => {
        const response = await fetchWithRetry('/api/data');
        return await response.json();
    },

    getDiagnostics: async (): Promise<any> => {
        const response = await fetchWithRetry('/api/admin/diagnose');
        return await response.json();
    },

    auditIntegrity: async (): Promise<any> => {
        const response = await fetchWithRetry('/api/admin/audit-integrity');
        return await response.json();
    },

    getTransactions: async (params: Record<string, any> = {}): Promise<{ data: any[], total: number }> => {
        const query = new URLSearchParams(params).toString();
        const response = await fetchWithRetry(`/api/transactions?${query}`);
        return await response.json();
    },

    getSummary: async (params: Record<string, any> = {}): Promise<Record<string, number>> => {
        const query = new URLSearchParams(params).toString();
        const response = await fetchWithRetry(`/api/analytics/summary?${query}`);
        return await response.json();
    },

    getBreakdown: async (params: Record<string, any> = {}): Promise<{ items: any[], total: number }> => {
        const query = new URLSearchParams(params).toString();
        const response = await fetchWithRetry(`/api/analytics/breakdown?${query}`);
        return await response.json();
    },

    getUsage: async (): Promise<any> => {
        const response = await fetchWithRetry('/api/analytics/usage');
        return await response.json();
    },

    saveTransactions: async (transactions: any[]): Promise<void> => {
        await fetchWithRetry('/api/transactions/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(transactions),
        });
    },

    deleteTransaction: async (id: string): Promise<void> => {
        await fetchWithRetry(`/api/transactions/${id}`, { method: 'DELETE' });
    },

    saveRule: async (rule: any): Promise<void> => {
        await fetchWithRetry('/api/reconciliation-rules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(rule),
        });
    },

    deleteRule: async (id: string): Promise<void> => {
        await fetchWithRetry(`/api/reconciliation-rules/${id}`, { method: 'DELETE' });
    },

    save: async (key: string, value: any): Promise<void> => {
        await fetchWithRetry(`/api/data/${key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(value),
        });
    },

    repairSystem: async (): Promise<boolean> => {
        const response = await fetchWithRetry('/api/admin/repair', { method: 'POST' });
        return response.ok;
    },

    resetDatabase: async (entities: string[] = ['all']): Promise<boolean> => {
        const response = await fetchWithRetry('/api/admin/reset', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entities })
        });
        return response.ok;
    }
};
