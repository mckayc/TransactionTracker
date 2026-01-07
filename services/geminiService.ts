
import { GoogleGenAI, Type } from '@google/genai';
import type { RawTransaction, Transaction, TransactionType, AuditFinding, Category, BusinessProfile, ChatMessage, FinancialGoal, Location, User, Counterparty, ReconciliationRule, AiConfig } from '../types';

let currentAiConfig: AiConfig = {
    textModel: 'gemini-3-flash-preview',
    complexModel: 'gemini-3-pro-preview',
    thinkingBudget: 0
};

export const updateGeminiConfig = (config: AiConfig) => {
    if (config.textModel) currentAiConfig.textModel = config.textModel;
    if (config.complexModel) currentAiConfig.complexModel = config.complexModel;
    if (config.thinkingBudget !== undefined) currentAiConfig.thinkingBudget = config.thinkingBudget;
    console.log("[GEMINI] Configuration updated:", currentAiConfig);
};

export const getActiveModels = () => ({ ...currentAiConfig });

// Guideline: The API key must be obtained exclusively from the environment variable process.env.API_KEY.
// In this architecture, the server injects it into window.process.env.API_KEY at runtime.
export const getApiKey = (): string => {
    const key = (window as any).process?.env?.API_KEY || process.env.API_KEY;
    return (key && key !== 'undefined') ? key.trim() : '';
};

export const hasApiKey = (): boolean => {
    return getApiKey().length > 0;
};

export const validateApiKeyConnectivity = async (): Promise<{ success: boolean, message: string }> => {
    const key = getApiKey();
    if (!key) return { success: false, message: "No API Key detected in runtime environment." };
    
    const ai = new GoogleGenAI({ apiKey: key });
    const model = currentAiConfig.textModel || 'gemini-3-flash-preview';
    
    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: "Respond with exactly the word 'Pong'.",
            config: { 
                maxOutputTokens: 10,
                thinkingConfig: { thinkingBudget: 0 }
            }
        });
        if (response && response.text) {
            return { success: true, message: `Connected to ${model}! Replied: "${response.text.trim()}"` };
        }
        return { success: true, message: `Connected to ${model}. Key is authorized.` };
    } catch (e: any) {
        console.error("Gemini Connectivity Test Error:", e);
        return { success: false, message: `API Error: ${e.message || "Unknown error"}. Verify your key and model access.` };
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

export const generateRulesFromData = async (
    data: string | File, 
    categories: Category[], 
    counterparties: Counterparty[], 
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

    const systemInstruction = `You are a Senior Financial Systems Architect. Task: generate atomic normalization rules for FinParser.
    Analyze patterns in description and metadata to suggest category, counterparty, and location mapping.
    Contextual User Notes: ${promptContext || 'None provided'}.
    Schema context available: ${categories.length} categories, ${counterparties.length} counterparties.`;

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
                        setCounterpartyId: { type: Type.STRING },
                        suggestedCounterpartyName: { type: Type.STRING },
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
            model: currentAiConfig.complexModel || 'gemini-3-pro-preview',
            contents: { parts: sampleParts },
            config: { 
                systemInstruction,
                responseMimeType: 'application/json',
                responseSchema: schema,
                thinkingConfig: { thinkingBudget: currentAiConfig.thinkingBudget || 2000 }
            }
        });

        const parsed = JSON.parse(response.text || '{"rules": []}');
        return (parsed.rules || []).filter(Boolean).map((r: any) => ({
            ...r,
            id: Math.random().toString(36).substring(7),
            isAiDraft: true,
            conditions: (r.conditions || []).filter(Boolean).map((c: any) => ({ 
                ...c, 
                id: Math.random().toString(36).substring(7), 
                type: 'basic', 
                nextLogic: 'AND' 
            }))
        }));
    } catch (e: any) {
        console.error("Gemini Rule Forge Error:", e);
        throw new Error(e.message || "AI extraction failed.");
    }
};

export const getAiFinancialAnalysis = async (query: string, contextData: any) => {
    const key = getApiKey();
    if (!key) throw new Error("API Key is missing.");
    const ai = new GoogleGenAI({ apiKey: key });
    const optimizedContext = {
        ...contextData,
        transactions: (contextData.transactions || []).filter(Boolean).slice(0, 100).map((t: any) => ({
            date: t.date,
            desc: t.description,
            amt: t.amount,
            cat: t.categoryId,
            ent: t.counterpartyId
        })),
        amazonMetrics: (contextData.amazonMetrics || []).filter(Boolean).slice(0, 20),
        youtubeMetrics: (contextData.youtubeMetrics || []).filter(Boolean).slice(0, 20)
    };
    const systemInstruction = `You are FinParser AI, a world-class financial analyst. 
    You have access to the user's recent 100 transactions and financial profiles.
    Use Markdown for formatting. Be concise.`;

    const stream = await ai.models.generateContentStream({
        model: currentAiConfig.textModel || 'gemini-3-flash-preview',
        contents: `CONTEXT:\n${JSON.stringify(optimizedContext)}\n\nUSER QUERY: ${query}`,
        config: {
            systemInstruction,
            thinkingConfig: { thinkingBudget: 0 }
        }
    });
    return stream;
};

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
    
    if (!transactionTypes || transactionTypes.length === 0) {
        throw new Error("System Error: No transaction types available.");
    }

    onProgress("AI is analyzing files...");
    const fileParts = await Promise.all(files.map(fileToGenerativePart));
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
                        category: { type: Type.STRING },
                        type: { type: Type.STRING }
                    },
                    required: ["date", "description", "amount"]
                }
            }
        },
        required: ["transactions"]
    };
    const response = await ai.models.generateContent({
        model: currentAiConfig.textModel || 'gemini-3-flash-preview',
        contents: { parts: [...fileParts, { text: "Extract all financial transactions from these files." }] },
        config: {
            responseMimeType: "application/json",
            responseSchema: schema,
            thinkingConfig: { thinkingBudget: 0 }
        }
    });
    const result = JSON.parse(response.text || '{"transactions": []}');
    const txs = result.transactions || [];
    
    const validTransactionTypes = Array.isArray(transactionTypes) ? transactionTypes.filter(Boolean) : [];
    const incomingType = validTransactionTypes.find(t => t.balanceEffect === 'incoming') || validTransactionTypes[0];
    const outgoingType = validTransactionTypes.find(t => t.balanceEffect === 'outgoing') || validTransactionTypes[0];

    return txs.filter((tx: any) => tx && tx.date).map((tx: any) => ({
        ...tx,
        accountId,
        typeId: tx.type === 'income' ? incomingType.id : outgoingType.id
    }));
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

    if (!transactionTypes || transactionTypes.length === 0) {
        throw new Error("System Error: No transaction types available.");
    }

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
                    required: ["date", "description", "amount"]
                }
            }
        },
        required: ["transactions"]
    };
    const response = await ai.models.generateContent({
        model: currentAiConfig.textModel || 'gemini-3-flash-preview',
        contents: `Extract transactions from this text: ${text}`,
        config: {
            responseMimeType: "application/json",
            responseSchema: schema,
            thinkingConfig: { thinkingBudget: 0 }
        }
    });
    const result = JSON.parse(response.text || '{"transactions": []}');
    const txs = result.transactions || [];

    const validTransactionTypes = Array.isArray(transactionTypes) ? transactionTypes.filter(Boolean) : [];
    const incomingType = validTransactionTypes.find(t => t.balanceEffect === 'incoming') || validTransactionTypes[0];
    const outgoingType = validTransactionTypes.find(t => t.balanceEffect === 'outgoing') || validTransactionTypes[0];

    return txs.filter((tx: any) => tx && tx.date).map((tx: any) => ({
        ...tx,
        accountId,
        typeId: tx.type === 'income' ? incomingType.id : outgoingType.id
    }));
};

export const askAiAdvisor = async (prompt: string): Promise<string> => {
    const key = getApiKey();
    if (!key) return "AI Configuration required.";
    const ai = new GoogleGenAI({ apiKey: key });
    const response = await ai.models.generateContent({
        model: currentAiConfig.complexModel || 'gemini-3-pro-preview',
        contents: prompt,
        config: { thinkingConfig: { thinkingBudget: currentAiConfig.thinkingBudget || 0 } }
    });
    return response.text || "No response.";
};

export const streamTaxAdvice = async (messages: ChatMessage[], profile: BusinessProfile) => {
    const key = getApiKey();
    if (!key) throw new Error("API Key is missing.");
    const ai = new GoogleGenAI({ apiKey: key });
    const contents = messages.filter(Boolean).map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
    }));
    const stream = await ai.models.generateContentStream({
        model: currentAiConfig.textModel || 'gemini-3-flash-preview',
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
        model: currentAiConfig.textModel || 'gemini-3-flash-preview',
        contents: `Audit type ${auditType}: ${JSON.stringify(transactions.filter(Boolean).slice(0, 100))}. Training Examples: ${JSON.stringify((examples || []).filter(Boolean))}`,
        config: { responseMimeType: "application/json", responseSchema: schema, thinkingConfig: { thinkingBudget: 0 } }
    });
    const result = JSON.parse(response.text || '{"findings": []}');
    return (result.findings || []).filter(Boolean);
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
        model: currentAiConfig.textModel || 'gemini-3-flash-preview',
        contents: { parts: [part, { text: "Analyze this document and provide a summary with key dates." }] },
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
        model: currentAiConfig.complexModel || 'gemini-3-pro-preview',
        contents: `Strategy for profile: ${JSON.stringify(profile)} with goals: ${JSON.stringify(goals.filter(Boolean))} and tx sample: ${JSON.stringify(transactions.filter(Boolean).slice(0, 50))}`,
        config: { 
            responseMimeType: "application/json", 
            responseSchema: schema,
            thinkingConfig: { thinkingBudget: currentAiConfig.thinkingBudget || 4000 }
        }
    });
    return JSON.parse(response.text || '{"strategy": "No strategy found."}');
};
