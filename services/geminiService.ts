
import { GoogleGenAI, Type } from '@google/genai';
import type { RawTransaction, Transaction, TransactionType, AuditFinding, Category, BusinessProfile, ChatMessage, FinancialGoal, Merchant, Location, User, Payee, ReconciliationRule } from '../types';

/**
 * Robust API Key Retrieval
 */
const getApiKey = (): string => {
    const key = (globalThis as any).process?.env?.API_KEY;
    if (key && key !== 'undefined' && key.trim() !== '') return key;
    
    const configKey = (globalThis as any).__FINPARSER_CONFIG__?.API_KEY;
    if (configKey && configKey !== 'undefined' && configKey.trim() !== '') return configKey;
    
    return '';
};

export const hasApiKey = (): boolean => {
    return getApiKey().length > 0;
};

/**
 * Connectivity Test
 */
export const validateApiKeyConnectivity = async (): Promise<{ success: boolean, message: string }> => {
    const key = getApiKey();
    if (!key) return { success: false, message: "No API Key found." };
    
    const ai = new GoogleGenAI({ apiKey: key });
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: "Respond with 'Pong'.",
            config: { 
                maxOutputTokens: 10,
                thinkingConfig: { thinkingBudget: 0 }
            }
        });
        
        if (response && response.text) {
            return { success: true, message: `Connection successful! Model replied: "${response.text.trim()}"` };
        }
        return { success: true, message: "Connection successful! Key is authorized." };
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
 * AI Logic Engine for Rule Generation
 * Switched to 'gemini-3-flash-preview' for higher rate limits (Fixes 429).
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
        sampleParts = [{ text: `DATA SAMPLE:\n${data}` }];
    } else {
        sampleParts = [await fileToGenerativePart(data)];
    }

    // Optimization: Slim down the context sent to the AI
    const slimCategories = categories.map(c => ({ id: c.id, name: c.name }));
    const slimPayees = payees.map(p => ({ id: p.id, name: p.name }));

    const systemInstruction = `You are a Senior Financial Systems Architect. 
    TASK: Generate atomic normalization rules for FinParser. 
    ANALYZE: Look for patterns in descriptions (e.g. "SQ *MERCHANT", "CHEVRON 1234").
    EXISTING SCHEMA: Categories: ${JSON.stringify(slimCategories)}, Payees: ${JSON.stringify(slimPayees)}.
    USER CONTEXT: ${promptContext || 'None'}.
    REQUIREMENT: If a merchant/payee is not in the schema, provide a "suggestedName".`;

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
                        suggestedPayeeName: { type: Type.STRING },
                        setMerchantId: { type: Type.STRING },
                        suggestedMerchantName: { type: Type.STRING },
                        setLocationId: { type: Type.STRING },
                        suggestedLocationName: { type: Type.STRING },
                        setUserId: { type: Type.STRING },
                        assignTagIds: { type: Type.ARRAY, items: { type: Type.STRING } }
                    }
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
            id: generateUUID_Local(),
            isAiDraft: true,
            conditions: (r.conditions || []).map((c: any) => ({ 
                ...c, 
                id: generateUUID_Local(), 
                type: 'basic', 
                nextLogic: 'AND' 
            }))
        }));
    } catch (e: any) {
        console.error("Gemini Rule Forge Error:", e);
        if (e.message?.includes("429")) throw new Error("AI Rate limit reached (429). Please wait 60 seconds and try again.");
        throw new Error(e.message || "AI extraction failed.");
    }
};

/**
 * Optimized UUID fallback for services
 */
const generateUUID_Local = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

/**
 * Streams financial analysis to the chatbot
 */
export const getAiFinancialAnalysis = async (query: string, contextData: any) => {
    const key = getApiKey();
    if (!key) throw new Error("API Key is missing.");
    const ai = new GoogleGenAI({ apiKey: key });
    
    const optimizedContext = {
        ...contextData,
        transactions: (contextData.transactions || []).slice(0, 100).map((t: any) => ({
            date: t.date,
            desc: t.description,
            amt: t.amount,
            cat: t.categoryId
        }))
    };

    const systemInstruction = `You are FinParser AI, a world-class financial analyst. Be concise. Use Markdown.`;

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
 * Extracts transactions from files using Gemini OCR and structured output
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
    onProgress("AI is performing forensic analysis of documents...");
    const fileParts = await Promise.all(files.map(fileToGenerativePart));
    
    const systemInstruction = `You are a Forensic Accountant. 
    TASK: Extract EVERY transaction found in the provided files.
    IGNORE: Headers, footers, summary tables, and advertising.
    FORMAT: Date (YYYY-MM-DD), Description (CLEANED), Amount (POSITIVE NUMBER), Type (income/expense).
    PRECISION: Ensure the amounts match exactly. If a line is ambiguous, do your best to extract it.`;

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
                        type: { type: Type.STRING, description: "income or expense" }
                    },
                    required: ["date", "description", "amount", "type"]
                }
            }
        },
        required: ["transactions"]
    };

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: { parts: fileParts },
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
    } catch (e: any) {
        if (e.message?.includes("429")) throw new Error("AI is busy (Rate Limit). Please wait 60s.");
        throw e;
    }
};

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
        contents: `Extract transactions from this text: ${text}`,
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
        contents: `Repair JSON: ${text}`,
        config: { 
            responseMimeType: "application/json",
            thinkingConfig: { thinkingBudget: 0 }
        }
    });
    return JSON.parse(response.text || 'null');
};

export const askAiAdvisor = async (prompt: string): Promise<string> => {
    const key = getApiKey();
    if (!key) return "AI Configuration required.";
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
        properties: {
            deductions: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["deductions"]
    };
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `List tax deductions for ${industry}.`,
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
            systemInstruction: `You are an expert Tax Advisor for a ${profile.info.businessType || 'business'}.`,
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
        contents: `Audit type ${auditType}: ${JSON.stringify(transactions.slice(0, 100))}. Examples: ${JSON.stringify(examples || [])}`,
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
        contents: { parts: [part, { text: "Analyze document." }] },
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
        model: 'gemini-3-pro-preview', // Pro is better for multi-year strategy
        contents: `Strategy for profile: ${JSON.stringify(profile)} with goals: ${JSON.stringify(goals)} and tx sample: ${JSON.stringify(transactions.slice(0, 50))}`,
        config: { 
            responseMimeType: "application/json", 
            responseSchema: schema,
            thinkingConfig: { thinkingBudget: 4000 }
        }
    });
    return JSON.parse(response.text || '{"strategy": "No strategy found."}');
};
