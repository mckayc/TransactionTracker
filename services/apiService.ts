
// Simple API client to replace localStorage functionality

export const api = {
    loadAll: async (): Promise<Record<string, any>> => {
        try {
            const response = await fetch('/api/data');
            if (!response.ok) {
                throw new Error('Failed to load data');
            }
            return await response.json();
        } catch (error) {
            console.error("API Load Error:", error);
            return {};
        }
    },

    save: async (key: string, value: any): Promise<void> => {
        try {
            await fetch(`/api/data/${key}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(value),
            });
        } catch (error) {
            console.error(`API Save Error (${key}):`, error);
        }
    }
};
