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
                    description: { type: Type.STRING },
                    amount: { type: Type.NUMBER, description: 'Absolute value of the transaction' },
                    category: { type: Type.STRING, description: 'Broad category like Groceries, Dining, etc.' },
                    isIncome: { type: Type.BOOLEAN, description: 'True if money in, false if money out' }
                },
                required: ['date', 'description', 'amount', 'isIncome']
            }
        }
    },
    required: ['transactions']
};

export const extractTransactionsFromFiles = async (files: File[], accountId: string, transactionTypes: TransactionType[], onProgress: (msg: string) => void): Promise<RawTransaction[]> => {
    onProgress("Preparing documents...");
    let allParts: any[] = [];
    for (const f of files) {
        const parts = await fileToGenerativePart(f);
        allParts = [...allParts, ...parts];
    }
    
    onProgress("AI analyzing statements...");
    const result = await callAi({
        model: 'gemini-3-flash-preview',
        contents: { 
            parts: [
                { text: "Extract every single transaction from the attached financial statements. Be precise with dates and amounts. Return ONLY a JSON object." }, 
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

export const extractTransactionsFromText = async (text: string, accountId: string, transactionTypes: TransactionType[], onProgress: (msg: string) => void): Promise<RawTransaction[]> => {
    onProgress("AI analyzing text...");
    const result = await callAi({
        model: 'gemini-3-flash-preview',
        contents: { parts: [{ text: `Extract transactions from this text and return as JSON: ${text}` }] },
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

export const generateFinancialStrategy = async (transactions: Transaction[], goals: FinancialGoal[], categories: Category[]) => {
    const result = await callAi({
        model: 'gemini-3-pro-preview',
        contents: { parts: [{ text: `Generate a financial strategy based on these goals: ${JSON.stringify(goals)}` }] },
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