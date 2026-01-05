
import { GoogleGenAI, Type } from '@google/genai';
import type { RawTransaction, TransactionType, BusinessDocument, Transaction, AuditFinding, Category, BusinessProfile, ChatMessage, FinancialGoal, FinancialPlan, Merchant, Location, User, Payee, ReconciliationRule } from '../types';

// Safe API Key retrieval
const getApiKey = (): string => {
    if (typeof process !== 'undefined' && process.env && process.env.API_KEY) return process.env.API_KEY;
    if (typeof window !== 'undefined' && (window as any).API_KEY) return (window as any).API_KEY;
    return '';
};

// Initialization of Gemini AI client
const ai = new GoogleGenAI({ apiKey: getApiKey() });

export const hasApiKey = (): boolean => !!getApiKey();

const fileToGenerativePart = async (file: File) => {
    const buffer = await file.arrayBuffer();
    const base64 = btoa(new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));
    return { inlineData: { data: base64, mimeType: file.type } };
};

/**
 * AI Logic Engine for Rule Generation
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
    
    let sampleParts: any[] = [];
    if (typeof data === 'string') {
        sampleParts = [{ text: `DATA SAMPLE:\n${data}` }];
    } else {
        sampleParts = [await fileToGenerativePart(data)];
    }

    const systemPrompt = `You are a Senior Financial Systems Architect.
    TASK: Analyze the provided financial data sample and generate atomic normalization rules for FinParser.
    
    GOAL: For EVERY distinct merchant or pattern found in the sample (e.g. Red 8, Costco, SP Crunchlabs), create a specific rule.
    
    RULE FORMAT REQUIREMENTS:
    1. 'name': Friendly descriptive name.
    2. 'scope': The primary field affected (e.g. 'description', 'merchantId', 'categoryId').
    3. 'conditions': At least one condition. Typically 'description' contains 'MERCHANT_NAME_IN_CAPS'.
    4. 'setCategoryId': Match to one of the provided category IDs.
    5. 'setMerchantId': Match to one of the provided merchant IDs if a strong match exists.
    6. 'setLocationId': Match to one of the provided location IDs.
    7. 'setUserId': Assign based on the member name/user in the data.
    
    AVAILABLE SCHEMA CONTEXT (IDs only):
    Categories: ${JSON.stringify(categories.map(c => ({id: c.id, name: c.name})))}
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
                        setMerchantId: { type: Type.STRING },
                        setLocationId: { type: Type.STRING },
                        setUserId: { type: Type.STRING },
                        assignTagIds: { type: Type.ARRAY, items: { type: Type.STRING } }
                    }
                }
            }
        },
        required: ['rules']
    };

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
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
        conditions: r.conditions.map((c: any) => ({ ...c, id: Math.random().toString(36).substring(7), type: 'basic', nextLogic: 'AND' }))
    }));
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
        model: 'gemini-3-flash-preview',
        contents: [{ parts: [{ text: prompt }, { text: "Generate a multi-year financial strategy." }] }],
        config: { responseMimeType: 'application/json', responseSchema: schema }
    });
    return JSON.parse(response.text || '{"strategy": "No strategy found."}');
};
