
import { GoogleGenAI, Type } from '@google/genai';
import type { RawTransaction, Transaction, TransactionType, AuditFinding, Category, BusinessProfile, ChatMessage, FinancialGoal, Merchant, Location, User, Payee, ReconciliationRule } from '../types';

/**
 * Robust API Key Retrieval.
 * Exclusively using process.env.API_KEY as per core requirements.
 * Checks multiple global locations due to shim variance in browser environments.
 */
const getApiKey = (): string => {
    const key = (globalThis as any).process?.env?.API_KEY || (window as any).__FINPARSER_CONFIG__?.API_KEY || '';
    return key.trim();
};

export const hasApiKey = (): boolean => {
    return getApiKey().length > 0;
};

/**
 * Connectivity Test: Minimal call to verify the key and model are reachable.
 */
export const validateApiKeyConnectivity = async (): Promise<{ success: boolean, message: string }> => {
    const key = getApiKey();
    if (!key) return { success: false, message: "No API Key found in environment variables." };
    
    const ai = new GoogleGenAI({ apiKey: key });
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: "hi",
            config: { 
                maxOutputTokens: 5,
            }
        });
        
        if (response && response.text) {
            return { success: true, message: "Connection successful!" };
        }
        return { success: false, message: "Received empty response from AI." };
    } catch (e: any) {
        console.error("API Connectivity Test Failed:", e);
        return { success: false, message: `API Error: ${e.message || "Unknown connectivity error"}` };
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
 * Standardized on 'gemini-3-flash-preview' for best availability.
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
        const truncatedData = data.length > 4000 ? data.substring(0, 4000) + "... [truncated]" : data;
        sampleParts = [{ text: `DATA SAMPLE:\n${truncatedData}` }];
    } else {
        sampleParts = [await fileToGenerativePart(data)];
    }

    const slimCategories = categories.slice(0, 100).map(c => ({ id: c.id, name: c.name }));
    const slimPayees = payees.slice(0, 100).map(p => ({ id: p.id, name: p.name }));

    const systemInstruction = `You are a financial architect. Generate classification rules in JSON.
    Categories: ${JSON.stringify(slimCategories)}
    Payees: ${JSON.stringify(slimPayees)}
    User Request: ${promptContext || 'Identify recurring patterns and merchants.'}`;

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
                responseSchema: schema
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
        console.error("Rule Forge Error:", e);
        if (e.message?.includes("429")) throw new Error("AI is currently overloaded (Rate limit). Please wait a moment.");
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
        transactions: (contextData.transactions || []).slice(0, 40).map((t: any) => ({
            date: t.date,
            desc: t.description,
            amt: t.amount,
            cat: t.categoryId
        })),
        goals: (contextData.financialGoals || []).slice(0, 5)
    };

    const systemInstruction = "You are FinParser AI. Answer financial questions based on the provided context. Use Markdown. Be direct.";

    const stream = await ai.models.generateContentStream({
        model: 'gemini-3-flash-preview',
        contents: `CONTEXT:\n${JSON.stringify(optimizedContext)}\n\nUSER QUERY: ${query}`,
        config: {
            systemInstruction
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
    
    onProgress("AI is extracting data from documents...");
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
        contents: { parts: [...fileParts, { text: "Extract all transactions into JSON." }] },
        config: {
            systemInstruction: "Forensic extraction of financial rows.",
            responseMimeType: "application/json",
            responseSchema: schema
        }
    });

    const result = JSON.parse(response.text || '{"transactions": []}');
    return result.transactions.map((tx: any) => ({
        ...tx,
        accountId,
        typeId: tx.type === 'income' ? (transactionTypes.find(t => t.balanceEffect === 'income')?.id || 'income') : (transactionTypes.find(t => t.balanceEffect === 'expense')?.id || 'expense')
    }));
};

// Fix: Added missing return value in extractTransactionsFromText
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
        contents: `Extract transactions from: ${text}`,
        config: {
            responseMimeType: "application/json",
            responseSchema: schema
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
 * Fix: Implemented healDataSnippet to fix malformed JSON snippets using AI.
 */
export const healDataSnippet = async (text: string): Promise<any> => {
    const key = getApiKey();
    if (!key) throw new Error("API Key is missing.");
    const ai = new GoogleGenAI({ apiKey: key });
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Fix this malformed JSON snippet or extract the data into valid JSON format: ${text}`,
        config: { responseMimeType: 'application/json' }
    });
    return JSON.parse(response.text || '{}');
};

/**
 * Fix: Implemented askAiAdvisor for general financial queries.
 */
export const askAiAdvisor = async (prompt: string): Promise<string> => {
    const key = getApiKey();
    if (!key) throw new Error("API Key is missing.");
    const ai = new GoogleGenAI({ apiKey: key });
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
    });
    return response.text || '';
};

/**
 * Fix: Implemented getIndustryDeductions for identifying common tax deductions.
 */
export const getIndustryDeductions = async (industry: string): Promise<string[]> => {
    const key = getApiKey();
    if (!key) throw new Error("API Key is missing.");
    const ai = new GoogleGenAI({ apiKey: key });
    const schema = {
        type: Type.OBJECT,
        properties: {
            deductions: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
            }
        },
        required: ["deductions"]
    };
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `List common tax deductions for the following industry: ${industry}`,
        config: { 
            responseMimeType: 'application/json',
            responseSchema: schema
        }
    });
    const parsed = JSON.parse(response.text || '{"deductions": []}');
    return parsed.deductions;
};

/**
 * Fix: Implemented streamTaxAdvice for interactive chat sessions.
 */
export const streamTaxAdvice = async (messages: ChatMessage[], profile: BusinessProfile) => {
    const key = getApiKey();
    if (!key) throw new Error("API Key is missing.");
    const ai = new GoogleGenAI({ apiKey: key });
    
    const promptContext = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
    
    const systemInstruction = `You are an expert tax advisor for a ${profile.info.businessType || 'business'} in ${profile.info.stateOfFormation || 'the US'}. 
    Industry: ${profile.info.industry || 'General'}. 
    Use the context of previous messages. Be specific and helpful. Use Markdown.`;

    const stream = await ai.models.generateContentStream({
        model: 'gemini-3-flash-preview',
        contents: `CONVERSATION HISTORY:\n${promptContext}\n\nLATEST QUERY: ${messages[messages.length - 1].content}`,
        config: {
            systemInstruction
        }
    });
    return stream;
};

/**
 * Fix: Implemented auditTransactions for forensic financial auditing.
 */
export const auditTransactions = async (
    transactions: Transaction[], 
    transactionTypes: TransactionType[], 
    categories: Category[], 
    auditType: string,
    examples?: Transaction[][]
): Promise<AuditFinding[]> => {
    const key = getApiKey();
    if (!key) throw new Error("API Key is missing.");
    const ai = new GoogleGenAI({ apiKey: key });
    
    const slimTxs = transactions.slice(0, 100).map(t => ({
        id: t.id,
        date: t.date,
        desc: t.description,
        amt: t.amount,
        cat: categories.find(c => c.id === t.categoryId)?.name || 'Other'
    }));

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
                        affectedTransactionIds: { 
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                        },
                        suggestedChanges: {
                            type: Type.OBJECT,
                            properties: {
                                categoryId: { type: Type.STRING },
                                typeId: { type: Type.STRING }
                            }
                        }
                    },
                    required: ["id", "title", "reason", "affectedTransactionIds", "suggestedChanges"]
                }
            }
        },
        required: ["findings"]
    };

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Audit these transactions for ${auditType}. 
        Examples of groups: ${JSON.stringify(examples || [])}
        DATA: ${JSON.stringify(slimTxs)}`,
        config: {
            systemInstruction: "You are a forensic accountant. Find errors, duplicates, or patterns to link transactions.",
            responseMimeType: "application/json",
            responseSchema: schema
        }
    });

    const parsed = JSON.parse(response.text || '{"findings": []}');
    return parsed.findings;
};

/**
 * Fix: Implemented analyzeBusinessDocument for automated document insights.
 */
export const analyzeBusinessDocument = async (file: File, onProgress: (msg: string) => void) => {
    const key = getApiKey();
    if (!key) throw new Error("API Key is missing.");
    const ai = new GoogleGenAI({ apiKey: key });
    
    onProgress("AI is analyzing document...");
    const part = await fileToGenerativePart(file);
    
    const schema = {
        type: Type.OBJECT,
        properties: {
            documentType: { type: Type.STRING },
            summary: { type: Type.STRING },
            keyDates: { 
                type: Type.ARRAY,
                items: { type: Type.STRING }
            }
        },
        required: ["documentType", "summary"]
    };

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [part, { text: "Analyze this document and summarize its financial purpose." }] },
        config: {
            responseMimeType: "application/json",
            responseSchema: schema
        }
    });

    return JSON.parse(response.text || '{}');
};

/**
 * Fix: Implemented generateFinancialStrategy for multi-year strategy generation.
 */
export const generateFinancialStrategy = async (
    transactions: Transaction[], 
    goals: FinancialGoal[], 
    categories: Category[], 
    profile: BusinessProfile
) => {
    const key = getApiKey();
    if (!key) throw new Error("API Key is missing.");
    const ai = new GoogleGenAI({ apiKey: key });
    
    const context = {
        spending: transactions.slice(0, 50).map(t => ({ d: t.date, a: t.amount, c: t.categoryId })),
        goals,
        profile
    };

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
                    },
                    required: ["categoryId", "limit"]
                }
            }
        },
        required: ["strategy", "suggestedBudgets"]
    };

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Context: ${JSON.stringify(context)}. Generate a financial strategy and suggested budgets.`,
        config: {
            systemInstruction: "You are a high-level CFO advisor.",
            responseMimeType: "application/json",
            responseSchema: schema
        }
    });

    return JSON.parse(response.text || '{}');
};
