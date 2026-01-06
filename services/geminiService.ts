
import { GoogleGenAI, Type } from '@google/genai';
import type { RawTransaction, Transaction, TransactionType, AuditFinding, Category, BusinessProfile, ChatMessage, FinancialGoal, Merchant, Location, User, Payee, ReconciliationRule } from '../types';

/**
 * Robust API Key Retrieval.
 * Exclusively using process.env.API_KEY as per core requirements.
 */
const getApiKey = (): string => {
    return process.env.API_KEY || '';
};

export const hasApiKey = (): boolean => {
    return getApiKey().trim().length > 0;
};

/**
 * Connectivity Test: Minimal call to verify the key and model are reachable.
 */
export const validateApiKeyConnectivity = async (): Promise<{ success: boolean, message: string }> => {
    const key = getApiKey();
    if (!key) return { success: false, message: "No API Key found in environment." };
    
    const ai = new GoogleGenAI({ apiKey: key });
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: "Pong",
            config: { 
                thinkingConfig: { thinkingBudget: 0 }
            }
        });
        
        if (response && response.text) {
            return { success: true, message: "Connection successful!" };
        }
        return { success: false, message: "Empty response from API." };
    } catch (e: any) {
        return { success: false, message: `API Error: ${e.message || "Unknown error"}` };
    }
};

const fileToGenerativePart = async (file: File) => {
    return new Promise<{ inlineData: { data: string, mimeType: string } }>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            const base64 = result.split(',')[1];
            resolve({ inlineData: { data: base64, mimeType: file.type } });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

/**
 * AI Logic Engine for Rule Generation.
 * Optimized for 'gemini-3-flash-preview' for stability and high speed.
 */
export const generateRulesFromData = async (
    data: string | File, 
    categories: Category[], 
    payees: Payee[], 
    merchants: Merchant[], 
    locations: Location[], 
    users: User[],
    promptContext?: string
): Promise<ReconciliationRule[]> => {
    const key = getApiKey();
    if (!key) throw new Error("API Key is missing.");
    
    const ai = new GoogleGenAI({ apiKey: key });
    
    let sampleParts: any[] = [];
    if (typeof data === 'string') {
        // Truncate large text inputs to avoid payload limits and timeouts
        const truncatedData = data.length > 5000 ? data.substring(0, 5000) + "... [truncated]" : data;
        sampleParts = [{ text: `DATA SAMPLE:\n${truncatedData}` }];
    } else {
        sampleParts = [await fileToGenerativePart(data)];
    }

    const slimCategories = categories.slice(0, 50).map(c => ({ id: c.id, name: c.name }));
    const slimPayees = payees.slice(0, 50).map(p => ({ id: p.id, name: p.name }));

    const systemInstruction = `You are a Senior Financial Architect. Generate categorization rules for FinParser. 
    Analyze patterns. Return JSON list of rules. 
    Context: ${promptContext || 'None'}. 
    Categories: ${JSON.stringify(slimCategories)}. 
    Payees: ${JSON.stringify(slimPayees)}.`;

    const schema = {
        type: Type.OBJECT,
        properties: {
            rules: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING },
                        scope: { type: Type.STRING },
                        conditions: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    field: { type: Type.STRING },
                                    operator: { type: Type.STRING },
                                    value: { type: Type.STRING }
                                }
                            }
                        },
                        setCategoryId: { type: Type.STRING },
                        suggestedCategoryName: { type: Type.STRING },
                        setPayeeId: { type: Type.STRING },
                        suggestedPayeeName: { type: Type.STRING }
                    },
                    required: ['name', 'conditions']
                }
            }
        },
        required: ['rules']
    };

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: { parts: sampleParts },
            config: { 
                systemInstruction,
                responseMimeType: 'application/json',
                responseSchema: schema,
                thinkingConfig: { thinkingBudget: 0 }
            }
        });

        const parsed = JSON.parse(response.text || '{"rules": []}');
        return (parsed.rules || []).map((r: any) => ({
            ...r,
            id: Math.random().toString(36).substring(7),
            isAiDraft: true,
            conditions: (r.conditions || []).map((c: any) => ({ 
                ...c, 
                id: Math.random().toString(36).substring(7), 
                type: 'basic', 
                nextLogic: 'AND' 
            }))
        }));
    } catch (e: any) {
        console.error("Gemini Rule Error:", e);
        throw new Error(e.message || "AI Analysis failed.");
    }
};

/**
 * Streams financial analysis to the chatbot.
 * Standardized on 'gemini-3-flash-preview'.
 */
export const getAiFinancialAnalysis = async (query: string, contextData: any) => {
    const key = getApiKey();
    if (!key) throw new Error("API Key is missing.");
    const ai = new GoogleGenAI({ apiKey: key });
    
    // Prune context to keep prompt lean and responsive
    const optimizedContext = {
        transactions: (contextData.transactions || []).slice(0, 50).map((t: any) => ({
            d: t.date,
            des: t.description,
            a: t.amount,
            c: t.categoryId
        })),
        goals: (contextData.financialGoals || []).slice(0, 10)
    };

    const systemInstruction = `You are FinParser AI. Answer based on recent 50 transactions. Use Markdown. Be direct and helpful.`;

    const stream = await ai.models.generateContentStream({
        model: 'gemini-3-flash-preview',
        contents: `CONTEXT:\n${JSON.stringify(optimizedContext)}\n\nUSER QUERY: ${query}`,
        config: {
            systemInstruction,
            thinkingConfig: { thinkingBudget: 0 }
        }
    });
    return stream;
};

/**
 * AI Transaction Extraction from Documents.
 */
export const extractTransactionsFromFiles = async (
    files: File[], 
    accountId: string, 
    transactionTypes: TransactionType[], 
    categories: Category[], 
    onProgress: (msg: string) => void
): Promise<RawTransaction[]> => {
    const key = getApiKey();
    if (!key) throw new Error("API Key is missing.");
    const ai = new GoogleGenAI({ apiKey: key });
    
    onProgress("AI is reading files...");
    const fileParts = await Promise.all(files.map(fileToGenerativePart));
    
    const systemInstruction = `Extract ALL transactions. Date, Description, Amount, Type (income/expense).`;

    const schema = {
        type: Type.OBJECT,
        properties: {
            transactions: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        date: { type: Type.STRING },
                        description: { type: Type.STRING },
                        amount: { type: Type.NUMBER },
                        type: { type: Type.STRING }
                    },
                    required: ["date", "description", "amount", "type"]
                }
            }
        },
        required: ["transactions"]
    };

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [...fileParts, { text: "Extract list." }] },
        config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: schema,
            thinkingConfig: { thinkingBudget: 0 }
        }
    });

    const result = JSON.parse(response.text || '{"transactions": []}');
    return result.transactions.map((tx: any) => ({
        ...tx,
        accountId,
        typeId: tx.type === 'income' ? (transactionTypes.find(t => t.balanceEffect === 'income')?.id || 'income') : (transactionTypes.find(t => t.balanceEffect === 'expense')?.id || 'expense')
    }));
};

/**
 * Text-based extraction.
 */
export const extractTransactionsFromText = async (
    text: string, 
    accountId: string, 
    transactionTypes: TransactionType[], 
    categories: Category[], 
    onProgress: (msg: string) => void
): Promise<RawTransaction[]> => {
    const key = getApiKey();
    if (!key) throw new Error("API Key is missing.");
    const ai = new GoogleGenAI({ apiKey: key });
    onProgress("AI is parsing text...");
    
    const schema = {
        type: Type.OBJECT,
        properties: {
            transactions: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        date: { type: Type.STRING },
                        description: { type: Type.STRING },
                        amount: { type: Type.NUMBER },
                        type: { type: Type.STRING }
                    },
                    required: ["date", "description", "amount", "type"]
                }
            }
        },
        required: ["transactions"]
    };

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Extract: ${text}`,
        config: {
            responseMimeType: "application/json",
            responseSchema: schema,
            thinkingConfig: { thinkingBudget: 0 }
        }
    });

    const result = JSON.parse(response.text || '{"transactions": []}');
    return result.transactions.map((tx: any) => ({
        ...tx,
        accountId,
        typeId: tx.type === 'income' ? (transactionTypes.find(t => t.balanceEffect === 'income')?.id || 'income') : (transactionTypes.find(t => t.balanceEffect === 'expense')?.id || 'expense')
    }));
};

export const healDataSnippet = async (text: string): Promise<any> => {
    const key = getApiKey();
    if (!key) throw new Error("API Key is missing.");
    const ai = new GoogleGenAI({ apiKey: key });
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Fix JSON: ${text}`,
        config: { 
            responseMimeType: "application/json",
            thinkingConfig: { thinkingBudget: 0 }
        }
    });
    return JSON.parse(response.text || 'null');
};

export const askAiAdvisor = async (prompt: string): Promise<string> => {
    const key = getApiKey();
    if (!key) return "API Key required.";
    const ai = new GoogleGenAI({ apiKey: key });
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { thinkingConfig: { thinkingBudget: 0 } }
    });
    return response.text || "No response.";
};

export const getIndustryDeductions = async (industry: string): Promise<string[]> => {
    const key = getApiKey();
    if (!key) return [];
    const ai = new GoogleGenAI({ apiKey: key });
    const schema = {
        type: Type.OBJECT,
        properties: { deductions: { type: Type.ARRAY, items: { type: Type.STRING } } },
        required: ["deductions"]
    };
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Tax deductions for ${industry}.`,
        config: { responseMimeType: "application/json", responseSchema: schema, thinkingConfig: { thinkingBudget: 0 } }
    });
    const parsed = JSON.parse(response.text || '{"deductions": []}');
    return parsed.deductions;
};

export const streamTaxAdvice = async (messages: ChatMessage[], profile: BusinessProfile) => {
    const key = getApiKey();
    if (!key) throw new Error("API Key is missing.");
    const ai = new GoogleGenAI({ apiKey: key });
    const contents = messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
    }));
    const stream = await ai.models.generateContentStream({
        model: 'gemini-3-flash-preview',
        contents,
        config: {
            systemInstruction: `You are a Tax Advisor for ${profile.info.businessType || 'business'}.`,
            thinkingConfig: { thinkingBudget: 0 }
        }
    });
    return stream;
};

export const auditTransactions = async (
    transactions: Transaction[], 
    types: TransactionType[], 
    categories: Category[], 
    auditType: string,
    examples?: Transaction[][]
): Promise<AuditFinding[]> => {
    const key = getApiKey();
    if (!key) return [];
    const ai = new GoogleGenAI({ apiKey: key });
    const schema = {
        type: Type.OBJECT,
        properties: {
            findings: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        id: { type: Type.STRING },
                        title: { type: Type.STRING },
                        reason: { type: Type.STRING },
                        affectedTransactionIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                        suggestedChanges: {
                            type: Type.OBJECT,
                            properties: {
                                categoryId: { type: Type.STRING },
                                typeId: { type: Type.STRING }
                            }
                        }
                    }
                }
            }
        },
        required: ["findings"]
    };

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Audit ${auditType}: ${JSON.stringify(transactions.slice(0, 50))}`,
        config: { responseMimeType: "application/json", responseSchema: schema, thinkingConfig: { thinkingBudget: 0 } }
    });

    const result = JSON.parse(response.text || '{"findings": []}');
    return result.findings;
};

export const analyzeBusinessDocument = async (file: File, onProgress: (msg: string) => void): Promise<any> => {
    const key = getApiKey();
    if (!key) return {};
    const ai = new GoogleGenAI({ apiKey: key });
    onProgress("AI is reading document...");
    const part = await fileToGenerativePart(file);
    const schema = {
        type: Type.OBJECT,
        properties: {
            documentType: { type: Type.STRING },
            summary: { type: Type.STRING },
            keyDates: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["documentType", "summary"]
    };
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [part, { text: "Analyze." }] },
        config: { responseMimeType: "application/json", responseSchema: schema, thinkingConfig: { thinkingBudget: 0 } }
    });
    return JSON.parse(response.text || '{}');
};

export const generateFinancialStrategy = async (
    transactions: Transaction[], 
    goals: FinancialGoal[], 
    categories: Category[],
    profile: BusinessProfile
): Promise<any> => {
    const key = getApiKey();
    if (!key) return { strategy: "API Key required." };
    const ai = new GoogleGenAI({ apiKey: key });
    const schema = {
        type: Type.OBJECT,
        properties: {
            strategy: { type: Type.STRING },
            suggestedBudgets: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        categoryId: { type: Type.STRING },
                        limit: { type: Type.NUMBER }
                    }
                }
            }
        },
        required: ["strategy"]
    };
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Strategy for ${JSON.stringify(profile)}: ${JSON.stringify(goals)}.`,
        config: { 
            responseMimeType: "application/json", 
            responseSchema: schema,
            thinkingConfig: { thinkingBudget: 0 }
        }
    });
    return JSON.parse(response.text || '{"strategy": "Analysis complete."}');
};
