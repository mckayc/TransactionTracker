
import { Type } from '@google/genai';
import type { RawTransaction, TransactionType, BusinessDocument, Transaction, AuditFinding, Category, BusinessProfile, ChatMessage, FinancialGoal, FinancialPlan } from '../types';

// In self-hosted mode, we assume the server has the key
export const hasApiKey = (): boolean => true;

const callAi = async (params: { model: string; contents: any; config?: any }) => {
    const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "AI Request Failed");
    }
    return await response.json();
};

async function* callAiStream(params: { model: string; contents: any; config?: any }) {
    const response = await fetch('/api/ai/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
    });

    if (!response.ok) throw new Error("AI Stream Failed");

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    while (reader) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        for (const line of lines) {
            if (line.startsWith('data: ')) {
                try {
                    const data = JSON.parse(line.slice(6));
                    yield data;
                } catch (e) {}
            }
        }
    }
}

const fileToGenerativePart = async (file: File) => {
    if (file.type === 'application/pdf') {
        const buffer = await file.arrayBuffer();
        const base64 = btoa(new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));
        return [{ inlineData: { data: base64, mimeType: file.type } }];
    }
    const text = await file.text();
    return [{ text: `Content of ${file.name}:\n${text}` }];
};

const EXTRACTION_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        transactions: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    date: { type: Type.STRING, description: 'YYYY-MM-DD' },
                    description: { type: Type.STRING, description: 'Cleaned merchant or counterparty name' },
                    amount: { type: Type.NUMBER, description: 'The absolute numerical value of the transaction' },
                    category: { type: Type.STRING, description: 'The closest matching category from the provided list.' },
                    isIncome: { type: Type.BOOLEAN, description: 'True if money enters the account (Credit/Deposit), False if money leaves (Debit/Payment).' }
                },
                required: ['date', 'description', 'amount', 'isIncome']
            }
        }
    },
    required: ['transactions']
};

export const healDataSnippet = async (rawText: string): Promise<any> => {
    const prompt = `You are a high-fidelity data recovery assistant for "FinParser", a financial tracking app.
    The user has provided a snippet of data that is likely malformed or partial JSON. 
    
    YOUR TASK:
    Convert the input into a valid, strictly formatted JSON object. 
    
    SUPPORTED TOP-LEVEL KEYS: 
    - transactions
    - accounts
    - categories
    - payees
    - users
    - tags
    - reconciliationRules
    - businessProfile
    - amazonMetrics
    - youtubeMetrics
    
    DATA MAPPING RULES:
    1. If the input looks like '"key": [...]', wrap it in curly braces: '{"key": [...]}'.
    2. If the input is just an array, detect its type (e.g., if items have "asin", it's "amazonMetrics").
    3. Ensure all property names use camelCase (e.g. accountTypeId, parentId, isDefault).
    4. Ensure all IDs are preserved exactly as provided.
    5. Fix missing quotes, trailing commas, or curly brace mismatches.
    
    INPUT SNIPPET:
    ${rawText}`;

    const result = await callAi({
        model: 'gemini-3-flash-preview',
        contents: { parts: [{ text: prompt }] },
        config: { responseMimeType: 'application/json' }
    });
    
    return JSON.parse(result.text);
};

const SYSTEM_PROMPT = (categories: string[]) => `You are a World-Class Forensic Financial Accountant. 
Your task is to parse bank or credit card statements with 100% precision.

RULES:
1. Extract EVERY single line item. Do not summarize.
2. Carefully detect the transaction direction. 
   - Look for columns labeled "Credit", "Deposit", "Debit", "Withdrawal".
   - If a single "Amount" column exists, look for signs (-/+) or symbols.
3. Map the "category" field ONLY to one of these valid values: [${categories.join(', ')}]. 
   - If none fit perfectly, use your best professional judgment to find the logical ancestor.
4. Clean the description: Remove transaction IDs, city/state codes, and generic bank prefixes (e.g., "PURCHASE AT...").
5. Return ONLY a JSON object matching the requested schema.`;

export const extractTransactionsFromFiles = async (files: File[], accountId: string, transactionTypes: TransactionType[], categories: Category[], onProgress: (msg: string) => void): Promise<RawTransaction[]> => {
    onProgress("Initializing AI Financial Engine...");
    let allParts: any[] = [];
    for (const f of files) {
        const parts = await fileToGenerativePart(f);
        allParts = [...allParts, ...parts];
    }
    
    const categoryNames = categories.map(c => c.name);
    
    onProgress("AI is reading statements and detecting patterns...");
    const result = await callAi({
        model: 'gemini-3-flash-preview',
        contents: { 
            parts: [
                { text: SYSTEM_PROMPT(categoryNames) }, 
                ...allParts
            ] 
        },
        config: { 
            responseMimeType: 'application/json',
            responseSchema: EXTRACTION_SCHEMA
        }
    });
    
    const parsed = JSON.parse(result.text);
    
    const expenseType = transactionTypes.find(t => t.balanceEffect === 'expense') || transactionTypes[0];
    const incomeType = transactionTypes.find(t => t.balanceEffect === 'income') || transactionTypes[0];

    return (parsed.transactions || []).map((tx: any) => {
        const targetType = tx.isIncome ? incomeType : expenseType;
        return {
            ...tx,
            accountId,
            typeId: targetType?.id || 'unknown'
        };
    });
};

export const extractTransactionsFromText = async (text: string, accountId: string, transactionTypes: TransactionType[], categories: Category[], onProgress: (msg: string) => void): Promise<RawTransaction[]> => {
    onProgress("AI analyzing raw ledger text...");
    const categoryNames = categories.map(c => c.name);
    
    const result = await callAi({
        model: 'gemini-3-flash-preview',
        contents: { 
            parts: [
                { text: SYSTEM_PROMPT(categoryNames) },
                { text: `Parse this text: \n${text}` }
            ] 
        },
        config: { 
            responseMimeType: 'application/json',
            responseSchema: EXTRACTION_SCHEMA
        }
    });
    const parsed = JSON.parse(result.text);
    const expenseType = transactionTypes.find(t => t.balanceEffect === 'expense') || transactionTypes[0];
    const incomeType = transactionTypes.find(t => t.balanceEffect === 'income') || transactionTypes[0];

    return (parsed.transactions || []).map((tx: any) => {
        const targetType = tx.isIncome ? incomeType : expenseType;
        return {
            ...tx,
            accountId,
            typeId: targetType?.id || 'unknown'
        };
    });
};

export const getAiFinancialAnalysis = async (question: string, contextData: object) => {
    return callAiStream({
        model: 'gemini-3-flash-preview',
        contents: { parts: [{ text: `Analyze this data: ${JSON.stringify(contextData)}. User question: ${question}` }] }
    });
};

export const analyzeBusinessDocument = async (file: File, onProgress: (msg: string) => void): Promise<BusinessDocument['aiAnalysis']> => {
    const parts = await fileToGenerativePart(file);
    const result = await callAi({
        model: 'gemini-3-pro-preview',
        contents: { parts: [{ text: "Analyze this document for tax insights." }, ...parts] },
        config: { responseMimeType: 'application/json' }
    });
    return JSON.parse(result.text);
};

export const streamTaxAdvice = async (history: ChatMessage[], profile: BusinessProfile) => {
    return callAiStream({
        model: 'gemini-3-pro-preview',
        contents: history.map(m => ({ role: m.role === 'ai' ? 'model' : 'user', parts: [{ text: m.content }] }))
    });
};

export const generateFinancialStrategy = async (transactions: Transaction[], goals: FinancialGoal[], categories: Category[], businessProfile: BusinessProfile) => {
    // Collect 6 months of spending for better accuracy
    const categoryMap = new Map(categories.map(c => [c.id, c.name]));
    const last6Months = new Date();
    last6Months.setMonth(last6Months.getMonth() - 6);
    
    const spendingSummary = transactions
        .filter(tx => new Date(tx.date) >= last6Months && !tx.isParent && tx.typeId.includes('expense'))
        .reduce((acc, tx) => {
            const name = categoryMap.get(tx.categoryId) || 'Other';
            acc[name] = (acc[name] || 0) + tx.amount;
            return acc;
        }, {} as Record<string, number>);

    const prompt = `Act as a world-class financial planner and tax strategist.
    
    BUSINESS CONTEXT:
    ${JSON.stringify(businessProfile)}
    
    GOALS:
    ${JSON.stringify(goals)}
    
    SPENDING TRENDS:
    ${JSON.stringify(spendingSummary)}
    
    TASK:
    Generate a comprehensive financial roadmap. Focus on:
    1. TAX OPTIMIZATION: Suggest deductions or structures (like S-Corp or retirement plans) specifically for their business type.
    2. RETIREMENT PLANNING: Calculate projections based on current savings and goals.
    3. DEBT VS INVESTING: Provide a prioritized sequence for capital allocation.
    
    Return a JSON object with:
    - strategy: Markdown string.
    - suggestedBudgets: Array of { categoryId, monthlyLimit }.
    `;

    const result = await callAi({
        model: 'gemini-3-pro-preview',
        contents: { parts: [{ text: prompt }] },
        config: { responseMimeType: 'application/json' }
    });
    return JSON.parse(result.text);
};

export const askAiAdvisor = async (prompt: string): Promise<string> => {
    const result = await callAi({
        model: 'gemini-3-flash-preview',
        contents: { parts: [{ text: prompt }] }
    });
    return result.text;
};

export const getIndustryDeductions = async (industry: string): Promise<string[]> => {
    const result = await callAi({
        model: 'gemini-3-pro-preview',
        contents: { parts: [{ text: `List tax deductions for ${industry}` }] },
        config: { responseMimeType: 'application/json' }
    });
    return JSON.parse(result.text);
};

export const auditTransactions = async (transactions: Transaction[], transactionTypes: TransactionType[], categories: Category[], auditType: string, examples?: Transaction[][]): Promise<AuditFinding[]> => {
    const result = await callAi({
        model: 'gemini-3-pro-preview',
        contents: { parts: [{ text: `Audit these transactions: ${JSON.stringify(transactions.slice(0, 50))}. Audit type: ${auditType}${examples && examples.length > 0 ? `. Examples of existing patterns: ${JSON.stringify(examples)}` : ''}` }] },
        config: { responseMimeType: 'application/json' }
    });
    return JSON.parse(result.text).findings || [];
};
