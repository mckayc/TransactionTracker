import { GoogleGenAI, Type } from '@google/genai';
import type { RawTransaction, TransactionType, Transaction, Category, Payee, User, AuditFinding, FinancialGoal } from '../types';

/* Initialize AI using the process.env.API_KEY provided in the environment */
export const hasApiKey = (): boolean => !!process.env.API_KEY;

/**
 * Helper to convert a File object to a Gemini inlineData part for vision tasks.
 */
const fileToPart = async (file: File): Promise<any> => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = (reader.result as string).split(',')[1];
            resolve({
                inlineData: {
                    data: base64,
                    mimeType: file.type
                }
            });
        };
        reader.readAsDataURL(file);
    });
};

/**
 * AI-powered document parsing.
 */
export const extractTransactionsFromFiles = async (
    files: File[],
    accountId: string,
    transactionTypes: TransactionType[],
    onProgress: (msg: string) => void
): Promise<RawTransaction[]> => {
    onProgress("Optimizing document data for AI analysis...");
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const parts = await Promise.all(files.map(fileToPart));
    
    const prompt = `You are a financial parsing engine. Analyze the provided documents and extract all transactions. 
    Map each transaction to the most appropriate Type ID from this list: ${JSON.stringify(transactionTypes.map(t => ({ id: t.id, name: t.name, effect: t.balanceEffect })))}.
    
    For each transaction, return:
    - date: YYYY-MM-DD
    - description: Original name
    - amount: Numeric value (absolute)
    - typeId: The matched type ID
    - category: A suggested high-level category name
    - accountId: Must be "${accountId}"
    - location: Extracted city/state if available
    - notes: Any memo/reference found
    - metadata: A JSON object containing all raw columns/fields found for this row
    
    Return ONLY a valid JSON array of objects.`;

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [...parts, { text: prompt }] },
        config: { 
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        date: { type: Type.STRING },
                        description: { type: Type.STRING },
                        amount: { type: Type.NUMBER },
                        typeId: { type: Type.STRING },
                        category: { type: Type.STRING },
                        accountId: { type: Type.STRING },
                        location: { type: Type.STRING },
                        notes: { type: Type.STRING },
                        metadata: { type: Type.OBJECT }
                    },
                    required: ['date', 'description', 'amount', 'typeId', 'category', 'accountId']
                }
            }
        }
    });

    try {
        return JSON.parse(response.text || '[]');
    } catch (e) {
        console.error("AI parsing failed", e);
        return [];
    }
};

/**
 * AI-powered text parsing.
 */
export const extractTransactionsFromText = async (
    text: string,
    accountId: string,
    transactionTypes: TransactionType[],
    onProgress: (msg: string) => void
): Promise<RawTransaction[]> => {
    onProgress("Analyzing text patterns with Gemini...");
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const prompt = `Extract all financial transactions from the following text block. 
    Text: "${text}"
    
    Assign Account ID: ${accountId}.
    Available Types: ${JSON.stringify(transactionTypes)}.
    
    Return a JSON array.`;

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { 
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        date: { type: Type.STRING },
                        description: { type: Type.STRING },
                        amount: { type: Type.NUMBER },
                        typeId: { type: Type.STRING },
                        category: { type: Type.STRING },
                        accountId: { type: Type.STRING }
                    },
                    required: ['date', 'description', 'amount', 'typeId', 'category', 'accountId']
                }
            }
        }
    });

    try {
        return JSON.parse(response.text || '[]');
    } catch (e) {
        console.error("AI text parse failed", e);
        return [];
    }
};

/**
 * Suggests categorization for raw transactions based on existing rules and labels.
 */
export const suggestCategorization = async (
    rawTransactions: RawTransaction[],
    categories: Category[],
    payees: Payee[]
): Promise<Record<string, { categoryId: string, payeeId?: string, normalizedName: string, confidence: number }>> => {
    if (rawTransactions.length === 0) return {};
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const prompt = `
        Match these transactions to existing categories and payees.
        
        EXISTING CATEGORIES: ${JSON.stringify(categories.map(c => ({ id: c.id, name: c.name })))}
        EXISTING PAYEES: ${JSON.stringify(payees.map(p => ({ id: p.id, name: p.name })))}
        
        DATA: ${JSON.stringify(rawTransactions.map((tx, idx) => ({
            idx,
            desc: tx.description,
            amt: tx.amount
        })))}

        Return a JSON array of objects, each containing: { "index": number, "categoryId": string, "payeeId": string|null, "normalizedName": string, "confidence": number }
    `;

    try {
        const result = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: { 
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            index: { type: Type.INTEGER },
                            categoryId: { type: Type.STRING },
                            payeeId: { type: Type.STRING },
                            normalizedName: { type: Type.STRING },
                            confidence: { type: Type.NUMBER }
                        },
                        required: ['index', 'categoryId', 'normalizedName', 'confidence']
                    }
                }
            }
        });
        
        const suggestionsArray = JSON.parse(result.text || '[]');
        const resultMap: Record<string, any> = {};
        suggestionsArray.forEach((s: any) => {
            resultMap[s.index.toString()] = { 
                categoryId: s.categoryId, 
                payeeId: s.payeeId || undefined, 
                normalizedName: s.normalizedName, 
                confidence: s.confidence 
            };
        });
        return resultMap;
    } catch (e) {
        console.error("AI Categorization failed", e);
        return {};
    }
};

/**
 * Refactored to use generateContentStream directly for async iteration in Chatbot.tsx.
 */
export const getAiFinancialAnalysis = async (question: string, contextData: object) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContentStream({
        model: 'gemini-3-flash-preview',
        contents: `Analyze this dataset: ${JSON.stringify(contextData)}. User question: ${question}`
    });
    return response;
};

/**
 * Provides point-in-time answers to specific business questions.
 */
export const askAiAdvisor = async (prompt: string): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const result = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt
    });
    return result.text || '';
};

/**
 * Streams a coaching session for financial planning.
 */
export const streamFinancialCoaching = async (history: any[], context: { transactions: Transaction[], goals: FinancialGoal[] }) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const contents = history.map(m => ({ 
        role: (m.role === 'ai' || m.role === 'model') ? 'model' as const : 'user' as const, 
        parts: [{ text: m.content }] 
    }));
    
    return await ai.models.generateContentStream({
        model: 'gemini-3-pro-preview',
        contents,
        config: {
            systemInstruction: `You are an elite, fee-only financial coach and planner.
            Your goal is to guide the user through building a resilient financial plan.
            Current Goals: ${JSON.stringify(context.goals)}
            Transaction Volume: ${context.transactions.length} records.
            
            COACHING STYLE:
            1. Ask clarifying questions one at a time.
            2. Don't give general advice; be specific to their goals.
            3. Focus on: Debt hierarchy, Savings rate, Emergency fund coverage, and Asset allocation.
            4. Use markdown for structure.
            5. Encourage the user to define clear targets if they haven't.`
        }
    });
};

/**
 * Fetches tax-specific industry deductions.
 */
export const getIndustryDeductions = async (industry: string): Promise<string[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const result = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `List tax write-offs for the ${industry} industry. Return as a JSON array of strings.`,
        config: { 
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
            }
        }
    });
    try {
        return JSON.parse(result.text || '[]');
    } catch (e) {
        return [];
    }
};

/**
 * Generates a structured financial strategy based on goals and spending.
 */
export const generateFinancialStrategy = async (transactions: Transaction[], goals: FinancialGoal[], categories: Category[]) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Aggregating categorical spending for context
    const categoryMap = new Map(categories.map(c => [c.id, c.name]));
    const spendingSummary = transactions
        .filter(tx => !tx.isParent && tx.typeId.includes('expense'))
        .slice(0, 500) // Context limit
        .reduce((acc, tx) => {
            const name = categoryMap.get(tx.categoryId) || 'Other';
            acc[name] = (acc[name] || 0) + tx.amount;
            return acc;
        }, {} as Record<string, number>);

    const prompt = `Perform a deep financial health audit and generate a comprehensive strategy.
    Goals: ${JSON.stringify(goals)}
    Spending Profile: ${JSON.stringify(spendingSummary)}
    
    Return a JSON object with:
    - strategy: Comprehensive markdown strategy.
    - healthScore: Number 0-100.
    - insights: Array of 3-5 short, critical observation strings.
    - suggestedBudgets: Array of { categoryId: string, monthlyLimit: number }.`;

    const result = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: { 
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    strategy: { type: Type.STRING },
                    healthScore: { type: Type.NUMBER },
                    insights: { type: Type.ARRAY, items: { type: Type.STRING } },
                    suggestedBudgets: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                categoryId: { type: Type.STRING },
                                monthlyLimit: { type: Type.NUMBER }
                            }
                        }
                    }
                }
            }
        }
    });
    return JSON.parse(result.text || '{}');
};

/**
 * vision analysis of documents.
 */
export const analyzeBusinessDocument = async (file: File, onProgress?: (msg: string) => void): Promise<any> => {
    if (onProgress) onProgress("Running OCR and vision analysis...");
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const part = await fileToPart(file);
    
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [part, { text: "Provide a summary, document type, and key dates for this document." }] },
        config: { 
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    documentType: { type: Type.STRING },
                    summary: { type: Type.STRING },
                    keyDates: { type: Type.ARRAY, items: { type: Type.STRING } },
                    taxTips: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ['documentType', 'summary']
            }
        }
    });
    return JSON.parse(response.text || '{}');
};

/**
 * streams tax advice.
 */
export const streamTaxAdvice = async (history: any[], profile: any) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const contents = history.map(m => ({ 
        role: (m.role === 'ai' || m.role === 'model') ? 'model' as const : 'user' as const, 
        parts: [{ text: m.content }] 
    }));
    
    return await ai.models.generateContentStream({
        model: 'gemini-3-pro-preview',
        contents,
        config: {
            systemInstruction: `You are a professional tax advisor for a ${profile.info.businessType || 'small business'}.`
        }
    });
};

/**
 * AI-powered issue detection.
 */
export const auditTransactions = async (
    transactions: Transaction[],
    transactionTypes: TransactionType[],
    categories: Category[],
    auditType: string,
    examples: Transaction[][]
): Promise<AuditFinding[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Perform a financial audit of type: ${auditType}. 
    Transactions: ${JSON.stringify(transactions.slice(0, 50))}
    Reference Groups: ${JSON.stringify(examples)}
    
    Return a JSON array of AuditFinding objects.`;

    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: { 
            responseMimeType: 'application/json',
            responseSchema: {
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
                                typeId: { type: Type.STRING },
                                payeeName: { type: Type.STRING }
                            }
                        }
                    },
                    required: ['id', 'title', 'reason', 'affectedTransactionIds', 'suggestedChanges']
                }
            }
        }
    });

    try {
        return JSON.parse(response.text || '[]');
    } catch (e) {
        return [];
    }
};