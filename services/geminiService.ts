
import { GoogleGenAI, Type } from '@google/genai';
// Added Transaction to the import list to resolve "Cannot find name 'Transaction'" errors
import type { RawTransaction, Transaction, TransactionType, AuditFinding, Category, BusinessProfile, ChatMessage, FinancialGoal, Merchant, Location, User, Payee, ReconciliationRule } from '../types';

/**
 * Robust API Key Retrieval
 * Prioritizes the custom runtime config object to bypass Vite's build-time replacement.
 */
const getApiKey = (): string => {
    try {
        const configKey = (globalThis as any).__FINPARSER_CONFIG__?.API_KEY;
        if (configKey && configKey !== 'undefined' && configKey !== '') return configKey;
        
        const processKey = (globalThis as any).process?.env?.API_KEY;
        if (processKey && processKey !== 'undefined' && processKey !== '') return processKey;
        
        return '';
    } catch {
        return '';
    }
};

/**
 * Returns true if the API_KEY is present and non-empty.
 */
export const hasApiKey = (): boolean => {
    return getApiKey() !== '';
};

/**
 * Connectivity Test: Performs a minimal call to verify the key is actually valid with Google.
 */
export const validateApiKeyConnectivity = async (): Promise<{ success: boolean, message: string }> => {
    const key = getApiKey();
    if (!key) return { success: false, message: "No API Key found in runtime config." };
    
    const ai = new GoogleGenAI({ apiKey: key });
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [{ parts: [{ text: "ping" }] }],
            config: { maxOutputTokens: 1 }
        });
        
        if (response.text) {
            return { success: true, message: "Connection successful! Key is active and authorized." };
        }
        return { success: false, message: "Empty response from API." };
    } catch (e: any) {
        console.error("Gemini Connectivity Test Error:", e);
        return { 
            success: false, 
            message: `API Error: ${e.message || "Unknown error"}. Check billing or quota.` 
        };
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
 * Using 'gemini-3-pro-preview' for complex logic tasks.
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
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    
    let sampleParts: any[] = [];
    if (typeof data === 'string') {
        sampleParts = [{ text: `DATA SAMPLE:\n${data}` }];
    } else {
        sampleParts = [await fileToGenerativePart(data)];
    }

    const systemPrompt = `You are a Senior Financial Systems Architect.
    TASK: Analyze the provided financial data sample and generate atomic normalization rules for FinParser.
    
    GOAL: For EVERY distinct merchant or pattern found in the sample (e.g. Red 8, Costco, SP Crunchlabs), create a specific rule.
    
    HIERARCHY & NAMING:
    - If you find a merchant or payee name that DOES NOT exist in the provided IDs, provide a "suggestedName" field.
    - Match categories to existing IDs where possible.
    
    RULE FORMAT REQUIREMENTS:
    1. 'name': Friendly descriptive name.
    2. 'scope': The primary field affected (e.g. 'description', 'merchantId', 'categoryId').
    3. 'conditions': At least one condition. Typically 'description' contains 'MERCHANT_NAME'.
    4. 'setCategoryId' / 'suggestedCategoryName': Existing ID or a new Name.
    5. 'setPayeeId' / 'suggestedPayeeName': Existing ID or a new Name.
    6. 'setMerchantId' / 'suggestedMerchantName': Existing ID or a new Name.
    7. 'setLocationId' / 'suggestedLocationName': Existing ID or a new Name.
    
    AVAILABLE SCHEMA CONTEXT (IDs only):
    Categories: ${JSON.stringify(categories.map(c => ({id: c.id, name: c.name})))}
    Payees: ${JSON.stringify(payees.map(p => ({id: p.id, name: p.name})))}
    Merchants: ${JSON.stringify(merchants.map(m => ({id: m.id, name: m.name})))}
    Locations: ${JSON.stringify(locations.map(l => ({id: l.id, name: l.name})))}
    Users: ${JSON.stringify(users.map(u => ({id: u.id, name: u.name})))}
    
    User Instructions: ${promptContext || 'Identify and normalize all recurring patterns.'}`;

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
            model: 'gemini-3-pro-preview',
            contents: [{ parts: [{ text: systemPrompt }, ...sampleParts] }],
            config: { 
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
        console.error("Gemini Rule Forge Error:", e);
        throw new Error(`AI analysis failed: ${e.message || "Unknown error"}`);
    }
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
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
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
                        date: { type: Type.STRING, description: "YYYY-MM-DD" },
                        description: { type: Type.STRING },
                        amount: { type: Type.NUMBER },
                        category: { type: Type.STRING },
                        type: { type: Type.STRING, description: "income or expense" }
                    },
                    required: ["date", "description", "amount"]
                }
            }
        },
        required: ["transactions"]
    };

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ parts: [...fileParts, { text: "Extract all financial transactions from these files." }] }],
        config: {
            responseMimeType: 'application/json',
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
 * Extracts transactions from pasted text
 */
export const extractTransactionsFromText = async (
    text: string, 
    accountId: string, 
    transactionTypes: TransactionType[], 
    categories: Category[], 
    onProgress: (msg: string) => void
): Promise<RawTransaction[]> => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
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
        model: 'gemini-3-flash-preview',
        contents: [{ parts: [{ text: `Extract transactions from this text: ${text}` }] }],
        config: {
            responseMimeType: 'application/json',
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
 * Streams financial analysis to the chatbot
 */
export const getAiFinancialAnalysis = async (query: string, contextData: object) => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const stream = await ai.models.generateContentStream({
        model: 'gemini-3-flash-preview',
        contents: [{ parts: [{ text: `Context: ${JSON.stringify(contextData)}\n\nQuery: ${query}` }] }],
    });
    return stream;
};

/**
 * Repairs malformed JSON data snippets
 */
export const healDataSnippet = async (text: string): Promise<any> => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ parts: [{ text: `Repair this malformed JSON snippet: ${text}. Return ONLY the repaired JSON object.` }] }],
        config: { responseMimeType: 'application/json' }
    });
    return JSON.parse(response.text || 'null');
};

/**
 * Ask AI Advisor for business advice
 */
export const askAiAdvisor = async (prompt: string): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ parts: [{ text: prompt }] }],
    });
    return response.text || "No response generated.";
};

/**
 * Get tax deductions for a specific industry
 */
export const getIndustryDeductions = async (industry: string): Promise<string[]> => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const schema = {
        type: Type.OBJECT,
        properties: {
            deductions: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["deductions"]
    };
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ parts: [{ text: `List common tax deductions for the ${industry} industry.` }] }],
        config: { responseMimeType: 'application/json', responseSchema: schema }
    });
    const parsed = JSON.parse(response.text || '{"deductions": []}');
    return parsed.deductions;
};

/**
 * Streams tax advice for a conversation
 */
export const streamTaxAdvice = async (messages: ChatMessage[], profile: BusinessProfile) => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const contents = messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
    }));
    const stream = await ai.models.generateContentStream({
        model: 'gemini-3-flash-preview',
        contents,
        config: {
            systemInstruction: `You are an expert Tax Advisor for a ${profile.info.businessType || 'business'}.`
        }
    });
    return stream;
};

/**
 * Audits transactions for issues
 */
export const auditTransactions = async (
    transactions: Transaction[], 
    types: TransactionType[], 
    categories: Category[], 
    auditType: string,
    examples?: Transaction[][]
): Promise<AuditFinding[]> => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const systemPrompt = `You are a Financial Auditor. Audit type: ${auditType}. Categories: ${JSON.stringify(categories.map(c => c.name))}.
    Examples of good grouping: ${JSON.stringify(examples)}`;
    
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
        contents: [{ parts: [{ text: `Audit these transactions: ${JSON.stringify(transactions)}` }, { text: systemPrompt }] }],
        config: { responseMimeType: 'application/json', responseSchema: schema }
    });

    const result = JSON.parse(response.text || '{"findings": []}');
    return result.findings;
};

/**
 * Analyzes a business document
 */
export const analyzeBusinessDocument = async (file: File, onProgress: (msg: string) => void): Promise<any> => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
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
        contents: [{ parts: [part, { text: "Analyze this document and provide a summary." }] }],
        config: { responseMimeType: 'application/json', responseSchema: schema }
    });
    return JSON.parse(response.text || '{}');
};

/**
 * Generates a financial strategy roadmap
 */
export const generateFinancialStrategy = async (
    transactions: Transaction[], 
    goals: FinancialGoal[], 
    categories: Category[],
    profile: BusinessProfile
): Promise<any> => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const prompt = `Profile: ${JSON.stringify(profile)}\nGoals: ${JSON.stringify(goals)}\nHistory: ${JSON.stringify(transactions.slice(0, 100))}`;
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
        model: 'gemini-3-pro-preview',
        contents: [{ parts: [{ text: prompt }, { text: "Generate a multi-year financial strategy." }] }],
        config: { responseMimeType: 'application/json', responseSchema: schema }
    });
    return JSON.parse(response.text || '{"strategy": "No strategy found."}');
};
