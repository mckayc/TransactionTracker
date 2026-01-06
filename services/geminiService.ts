
import { GoogleGenAI, Type } from '@google/genai';
import type { RawTransaction, Transaction, TransactionType, AuditFinding, Category, BusinessProfile, ChatMessage, FinancialGoal, Merchant, Location, User, Payee, ReconciliationRule } from '../types';

/**
 * Robust API Key Retrieval.
 * Exclusively using process.env.API_KEY as per core requirements.
 */
const getApiKey = (): string => {
    const key = (globalThis as any).process?.env?.API_KEY || (window as any).__FINPARSER_CONFIG__?.API_KEY || '';
    return key.trim();
};

export const hasApiKey = (): boolean => {
    return getApiKey().length > 0;
};

/**
 * Connectivity Test
 */
export const validateApiKeyConnectivity = async (): Promise<{ success: boolean, message: string }> => {
    const key = getApiKey();
    if (!key) return { success: false, message: "No API Key found in environment." };
    
    const ai = new GoogleGenAI({ apiKey: key });
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: "hi",
            config: { maxOutputTokens: 5 }
        });
        
        if (response && response.text) {
            return { success: true, message: "Connection successful!" };
        }
        return { success: false, message: "Empty response." };
    } catch (e: any) {
        return { success: false, message: `API Error: ${e.message}` };
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
 * Instructed to consolidate merchant variants using OR logic.
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
        const truncatedData = data.length > 5000 ? data.substring(0, 5000) + "... [truncated]" : data;
        sampleParts = [{ text: `DATA SAMPLE:\n${truncatedData}` }];
    } else {
        sampleParts = [await fileToGenerativePart(data)];
    }

    const slimCategories = categories.slice(0, 100).map(c => ({ id: c.id, name: c.name }));
    const slimPayees = payees.slice(0, 100).map(p => ({ id: p.id, name: p.name }));

    const systemInstruction = `You are a Senior Financial Architect. Generate classification rules in JSON.
    CONTEXT: ${promptContext || 'Identify recurring patterns and merchants.'}
    CATEGORIES: ${JSON.stringify(slimCategories)}
    PAYEES: ${JSON.stringify(slimPayees)}
    
    CRITICAL LOGIC:
    1. If you detect multiple naming variants for the same real-world entity (e.g., 'Walmart', 'WM Supercenter', 'WalmartSC'), consolidate them into a SINGLE rule.
    2. Use 'OR' logic in the nextLogic field for variants.
    3. Suggest names for categories/payees if they don't exist in the provided lists.`;

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
                                    value: { type: Type.STRING },
                                    nextLogic: { type: Type.STRING, description: "Use 'OR' to group merchant variants, 'AND' for constraints." }
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
                type: 'basic'
            }))
        }));
    } catch (e: any) {
        console.error("Rule Forge Error:", e);
        if (e.message?.includes("429")) throw new Error("AI Rate limit reached. Wait 60s.");
        throw new Error(e.message || "AI Analysis failed.");
    }
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
    
    onProgress("AI is performing forensic analysis of documents...");
    const fileParts = await Promise.all(files.map(fileToGenerativePart));
    
    const categoryNames = categories.map(c => c.name).join(', ');
    const systemInstruction = `You are a Forensic Accountant. 
    TASK: Please look over the document and based on the data assign an appropriate description, merchant or payee and category.
    AVAILABLE CATEGORIES: ${categoryNames}.
    FORMAT: Date (YYYY-MM-DD), cleaned Description, exact Amount, Type (income/expense).
    PRECISION: Match amounts exactly. Group multi-line entries if they represent one charge.`;

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
                        type: { type: Type.STRING, description: "income or expense" }
                    },
                    required: ["date", "description", "amount", "type"]
                }
            }
        },
        required: ["transactions"]
    };

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [...fileParts, { text: "Extract all financial records from these documents." }] },
        config: {
            systemInstruction,
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
 * AI Transaction Extraction from Text.
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
    onProgress("AI is parsing text records...");
    
    const categoryNames = categories.map(c => c.name).join(', ');
    const systemInstruction = `You are an Expert Accountant. 
    TASK: Please look over the text and based on the data assign an appropriate description, merchant or payee and category.
    AVAILABLE CATEGORIES: ${categoryNames}.`;

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
                    required: ["date", "description", "amount", "type"]
                }
            }
        },
        required: ["transactions"]
    };

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analyze and extract from: ${text}`,
        config: {
            systemInstruction,
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

export const getAiFinancialAnalysis = async (query: string, contextData: any) => {
    const key = getApiKey();
    if (!key) throw new Error("API Key is missing.");
    const ai = new GoogleGenAI({ apiKey: key });
    
    const optimizedContext = {
        transactions: (contextData.transactions || []).slice(0, 50).map((t: any) => ({
            date: t.date,
            desc: t.description,
            amt: t.amount,
            cat: t.categoryId
        }))
    };

    const systemInstruction = "You are FinParser AI. Analyze the user data and provide helpful financial guidance. Use Markdown.";

    const stream = await ai.models.generateContentStream({
        model: 'gemini-3-flash-preview',
        contents: `CONTEXT:\n${JSON.stringify(optimizedContext)}\n\nUSER QUERY: ${query}`,
        config: { systemInstruction }
    });
    return stream;
};

export const healDataSnippet = async (text: string): Promise<any> => {
    const key = getApiKey();
    if (!key) throw new Error("API Key is missing.");
    const ai = new GoogleGenAI({ apiKey: key });
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Repair this malformed JSON snippet or extract valid JSON from it: ${text}`,
        config: { responseMimeType: 'application/json' }
    });
    return JSON.parse(response.text || '{}');
};

export const askAiAdvisor = async (prompt: string): Promise<string> => {
    const key = getApiKey();
    if (!key) return "API Key required.";
    const ai = new GoogleGenAI({ apiKey: key });
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt
    });
    return response.text || '';
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
        contents: `List tax deductions for the ${industry} industry.`,
        config: { responseMimeType: 'application/json', responseSchema: schema }
    });
    const parsed = JSON.parse(response.text || '{"deductions": []}');
    return parsed.deductions;
};

export const streamTaxAdvice = async (messages: ChatMessage[], profile: BusinessProfile) => {
    const key = getApiKey();
    if (!key) throw new Error("API Key is missing.");
    const ai = new GoogleGenAI({ apiKey: key });
    
    const systemInstruction = `You are a tax advisor for a ${profile.info.businessType || 'business'}. Use the context provided. Use Markdown.`;

    const stream = await ai.models.generateContentStream({
        model: 'gemini-3-flash-preview',
        contents: messages.map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content }] })),
        config: { systemInstruction }
    });
    return stream;
};

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
        contents: `Audit these transactions for ${auditType}: ${JSON.stringify(slimTxs)}`,
        config: {
            systemInstruction: "You are a forensic auditor. Find duplicates, errors, or linked payments.",
            responseMimeType: "application/json",
            responseSchema: schema
        }
    });

    const parsed = JSON.parse(response.text || '{"findings": []}');
    return parsed.findings;
};

export const analyzeBusinessDocument = async (file: File, onProgress: (msg: string) => void) => {
    const key = getApiKey();
    if (!key) throw new Error("API Key is missing.");
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
        contents: { parts: [part, { text: "Analyze document purposes." }] },
        config: {
            responseMimeType: "application/json",
            responseSchema: schema
        }
    });

    return JSON.parse(response.text || '{}');
};

export const generateFinancialStrategy = async (
    transactions: Transaction[], 
    goals: FinancialGoal[], 
    categories: Category[], 
    profile: BusinessProfile
) => {
    const key = getApiKey();
    if (!key) throw new Error("API Key is missing.");
    const ai = new GoogleGenAI({ apiKey: key });
    
    const context = { spending: transactions.slice(0, 40).map(t => ({ d: t.date, a: t.amount, c: t.categoryId })), goals, profile };

    const schema = {
        type: Type.OBJECT,
        properties: {
            strategy: { type: Type.STRING },
            suggestedBudgets: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: { categoryId: { type: Type.STRING }, limit: { type: Type.NUMBER } }
                }
            }
        },
        required: ["strategy", "suggestedBudgets"]
    };

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Generate strategy for: ${JSON.stringify(context)}`,
        config: {
            systemInstruction: "You are a high-level CFO.",
            responseMimeType: "application/json",
            responseSchema: schema
        }
    });

    return JSON.parse(response.text || '{}');
};
