
// Simple API client to replace localStorage functionality

const MAX_RETRIES = 3;
const INITIAL_DELAY = 1000;

const fetchWithRetry = async (url: string, options: RequestInit = {}, retries = MAX_RETRIES): Promise<Response> => {
    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            // If it's a server error or rate limit, retry
            if (retries > 0 && (response.status >= 500 || response.status === 429)) {
                const delay = INITIAL_DELAY * (MAX_RETRIES - retries + 1);
                console.warn(`API Request failed with ${response.status}. Retrying in ${delay}ms... (${retries} left)`);
                await new Promise(res => setTimeout(res, delay));
                return fetchWithRetry(url, options, retries - 1);
            }
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }
        return response;
    } catch (error) {
        if (retries > 0) {
            const delay = INITIAL_DELAY * (MAX_RETRIES - retries + 1);
            console.warn(`Network error. Retrying in ${delay}ms... (${retries} left)`, error);
            await new Promise(res => setTimeout(res, delay));
            return fetchWithRetry(url, options, retries - 1);
        }
        throw error;
    }
};

export const api = {
    loadAll: async (): Promise<Record<string, any>> => {
        try {
            const response = await fetchWithRetry('/api/data');
            return await response.json();
        } catch (error) {
            console.error("API Load Final Failure:", error);
            throw error;
        }
    },

    get: async <T>(key: string): Promise<T | null> => {
        try {
            const response = await fetchWithRetry(`/api/data/${key}`);
            return await response.json();
        } catch (error) {
            console.error(`API Key Fetch Error (${key}):`, error);
            return null;
        }
    },

    save: async (key: string, value: any): Promise<void> => {
        try {
            await fetchWithRetry(`/api/data/${key}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(value),
            });
        } catch (error) {
            console.error(`API Save Error (${key}):`, error);
            throw error;
        }
    },

    resetDatabase: async (): Promise<boolean> => {
        try {
            const response = await fetchWithRetry('/api/admin/reset', {
                method: 'POST',
            });
            return response.ok;
        } catch (error) {
            console.error("API Reset Error:", error);
            return false;
        }
    }
};
