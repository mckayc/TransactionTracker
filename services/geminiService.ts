import { GoogleGenAI, Type } from '@google/genai';
import type { RawTransaction, Transaction, TransactionType, AuditFinding, Category, BusinessProfile, ChatMessage, FinancialGoal, Merchant, Location, User, Payee, ReconciliationRule, SystemSettings, BlueprintExample } from '../types';

const DEFAULT_MODEL = 'gemini-3-flash-preview';

/**
 * Generates the model name based on system settings.
 */
const getModel = (settings?: SystemSettings): string => {
    return settings?.aiModel || DEFAULT_MODEL;
};

/**
 * Generates configuration based on the model type.
 * Pro models allow thinking tokens; others disable them to save quota.
 */
const getModelConfig = (model: string, systemInstruction?: string) => {
    const config: any = {
        systemInstruction,
    };

    if (!model.includes('pro')) {
        config.thinkingConfig = { thinkingBudget: 0 };
    }

    return config;
};

/**
 * Checks if the API Key is present in the environment.
 */
export const hasApiKey = (): boolean => {
    return !!process.env.API_KEY;
};

/**
 * Connectivity Test for API Key and model accessibility.
 */
export const validateApiKeyConnectivity = async (settings?: SystemSettings): Promise<{ success: boolean, message: string }> => {
    if (!process.env.API_KEY) return { success: false, message: "No API Key found in environment." };
    
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = getModel(settings);
    
    try {
        const response = await ai.models.generateContent({
            model,
            contents: "hi",
            config: getModelConfig(model)
        });
        
        if (response && response.text) {
            return { success: true, message: `Connection successful using ${model}!` };
        }
        return { success: false, message: "Empty response." };
    } catch (e: any) {
        return { success: false, message: `API Error (${model}): ${e.message}` };
    }
};

/**
 * Converts a browser File object to a GenAI inlineData part.
 */
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
 * Shared schema for transaction extraction.
 */
const extractSchema = {
    type: Type.OBJECT,
    properties: {
        transactions: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    date: { type: Type.STRING, description: 'ISO 8601 date string YYYY-MM-DD' },
                    description: { type: Type.STRING, description: 'Cleaned transaction description' },
                    amount: { type: Type.NUMBER, description: 'Absolute amount value' },
                    category: { type: Type.STRING, description: 'Suggested category name' }
                },
                required: ['date', 'description', 'amount']
            }
        }
    }
};

/* Added extractTransactionsFromFiles to handle PDF and image statement extraction */
export const extractTransactionsFromFiles = async (
    files: File[], 
    accountId: string, 
    transactionTypes: TransactionType[], 
    categories: Category[], 
    onProgress: (msg: string) => void,
    settings?: SystemSettings
): Promise<RawTransaction[]> => {
    onProgress("Scanning statement contents...");
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = getModel(settings);
    
    const parts = await Promise.all(files.map(f => fileToGenerativePart(f)));
    const systemInstruction = "You are a precision financial data extractor. Extract every transaction from the provided files exactly as they appear.";
    
    const response = await ai.models.generateContent({
        model,
        contents: { parts: [...parts, { text: "Extract transactions in JSON format." }] },
        config: {
            ...getModelConfig(model, systemInstruction),
            responseMimeType: 'application/json',
            responseSchema: extractSchema
        }
    });
    
    const parsed = JSON.parse(response.text || '{"transactions":[]}');
    return parsed.transactions.map((tx: any) => ({ ...tx, accountId }));
};

/* Added extractTransactionsFromText to handle pasted text statement extraction */
export const extractTransactionsFromText = async (
    text: string, 
    accountId: string, 
    transactionTypes: TransactionType[], 
    categories: Category[], 
    onProgress: (msg: string) => void,
    settings?: SystemSettings
): Promise<RawTransaction[]> => {
    onProgress("Parsing text input...");
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = getModel(settings);
    
    const systemInstruction = "You are a financial data extractor. Extract all transactions from the provided text into a structured JSON list.";
    
    const response = await ai.models.generateContent({
        model,
        contents: text,
        config: {
            ...getModelConfig(model, systemInstruction),
            responseMimeType: 'application/json',
            responseSchema: extractSchema
        }
    });
    
    const parsed = JSON.parse(response.text || '{"transactions":[]}');
    return parsed.transactions.map((tx: any) => ({ ...tx, accountId }));
};

/**
 * AI Logic Engine for Rule Generation.
 */
export const generateRulesFromData = async (
    data: string | File, 
    categories: Category[], 
    payees: Payee[], 
    merchants: Merchant[], 
    locations: Location[], 
    users: User[],
    promptContext?: string,
    settings?: SystemSettings,
    existingRules: ReconciliationRule[] = [],
    blueprintExamples: BlueprintExample[] = []
): Promise<ReconciliationRule[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = getModel(settings);
    
    let sampleParts: any[] = [];
    if (typeof data === 'string') {
        const truncatedData = data.length > 5000 ? data.substring(0, 5000) + "... [truncated]" : data;
        sampleParts = [{ text: `DATA SAMPLE (VERBATIM LINES):\n${truncatedData}` }];
    } else {
        sampleParts = [await fileToGenerativePart(data)];
    }

    const slimCategories = categories.slice(0, 100).map(c => ({ id: c.id, name: c.name }));
    const slimPayees = payees.slice(0, 100).map(p => ({ id: p.id, name: p.name }));
    const slimRules = existingRules.slice(0, 50).map(r => ({ name: r.name, conditions: r.conditions.map(c => `${c.field} ${c.operator} ${c.value}`) }));

    const blueprintInstruction = blueprintExamples.length > 0 
        ? `STRICT BLUEPRINT REQUIREMENT: Use these examples as your logic template for classification style and naming:\n${JSON.stringify(blueprintExamples)}`
        : '';

    const systemInstruction = `You are a Senior Financial Architect & Data Normalizer.
    
    TASK: Generate classification rules in JSON.
    
    ${blueprintInstruction}

    CRITICAL: DUPLICATE PREVENTION
    - I have provided a list of EXISTING_RULES. 
    - DO NOT suggest a rule if the logic (Description Contains X) is already covered.
    
    CONTEXT: ${promptContext || 'Identify recurring patterns and merchants.'}
    CATEGORIES: ${JSON.stringify(slimCategories)}
    PAYEES: ${JSON.stringify(slimPayees)}
    EXISTING_RULES: ${JSON.stringify(slimRules)}`;

    const schema = {
        type: Type.OBJECT,
        properties: {
            rules: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING },
                        scope: { type: Type.STRING, description: "Must be 'locationId', 'merchantId', 'payeeId', or 'description'" },
                        conditions: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    field: { type: Type.STRING },
                                    operator: { type: Type.STRING },
                                    value: { type: Type.STRING },
                                    nextLogic: { type: Type.STRING }
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
                        originalDescription: { type: Type.STRING }
                    },
                    required: ['name', 'conditions', 'scope', 'originalDescription']
                }
            }
        },
        required: ['rules']
    };

    try {
        const response = await ai.models.generateContent({
            model,
            contents: { parts: sampleParts },
            config: { 
                ...getModelConfig(model, systemInstruction),
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
        throw new Error(e.message || "AI Analysis failed.");
    }
};

/* Added getAiFinancialAnalysis to stream chatbot responses with financial context */
export const getAiFinancialAnalysis = async (
    prompt: string, 
    contextData: object, 
    settings?: SystemSettings
) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = getModel(settings);
    const chat = ai.chats.create({
        model,
        config: {
            systemInstruction: `You are a helpful financial analytics assistant. Use the provided context data to answer the user's questions about their budget and performance. CONTEXT: ${JSON.stringify(contextData)}`,
            ...getModelConfig(model)
        },
    });
    return await chat.sendMessageStream({ message: prompt });
};

/* Added healDataSnippet to repair corrupted backup JSON via AI */
export const healDataSnippet = async (text: string, settings?: SystemSettings): Promise<any> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = getModel(settings);
    const response = await ai.models.generateContent({
        model,
        contents: `The following content is meant to be a valid backup of my accounting app. It is currently corrupted or unstructured. Repair it into a valid JSON object matching the app's structure.\n\nCONTENT:\n${text}`,
        config: {
            ...getModelConfig(model),
            responseMimeType: 'application/json'
        }
    });
    return JSON.parse(response.text || '{}');
};

/* Added askAiAdvisor for general step-by-step business guidance */
export const askAiAdvisor = async (prompt: string, settings?: SystemSettings): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = getModel(settings);
    const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: getModelConfig(model)
    });
    return response.text || '';
};

/* Added getIndustryDeductions to generate tax deduction lists for specific industries */
export const getIndustryDeductions = async (industry: string, settings?: SystemSettings): Promise<string[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = getModel(settings);
    const response = await ai.models.generateContent({
        model,
        contents: `What are common business tax deductions for someone in the ${industry} industry? Provide a concise list.`,
        config: {
            ...getModelConfig(model, "You are a professional business tax consultant."),
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    deductions: { type: Type.ARRAY, items: { type: Type.STRING } }
                }
            }
        }
    });
    const parsed = JSON.parse(response.text || '{"deductions": []}');
    return parsed.deductions;
};

/* Added streamTaxAdvice to handle multi-turn tax consultation chats */
export const streamTaxAdvice = async (
    messages: ChatMessage[], 
    profile: BusinessProfile, 
    settings?: SystemSettings
) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = getModel(settings);
    const chat = ai.chats.create({
        model,
        config: {
            systemInstruction: `You are a specialized tax advisor for business owners. Business profile: ${JSON.stringify(profile)}`,
            ...getModelConfig(model)
        },
    });
    
    const lastMsg = messages[messages.length - 1].content;
    return await chat.sendMessageStream({ message: lastMsg });
};

/* Added auditTransactions to scan ledger for discrepancies or missing links */
export const auditTransactions = async (
    transactions: Transaction[], 
    types: TransactionType[], 
    categories: Category[], 
    auditType: string, 
    examples?: Transaction[][],
    settings?: SystemSettings
): Promise<AuditFinding[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = getModel(settings);
    
    const slimTxs = transactions.slice(0, 150).map(t => ({ id: t.id, date: t.date, desc: t.description, amt: t.amount }));
    
    const prompt = `Task: Perform a ${auditType} audit on these transactions. Look for patterns, missing links, or errors. ${examples ? `Refer to these example groups for training your linking logic: ${JSON.stringify(examples)}` : ''}\n\nDATA:\n${JSON.stringify(slimTxs)}`;
    
    const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
            ...getModelConfig(model, "You are a meticulous financial auditor with an eye for patterns."),
            responseMimeType: 'application/json',
            responseSchema: {
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
                }
            }
        }
    });
    
    const parsed = JSON.parse(response.text || '{"findings":[]}');
    return parsed.findings;
};

/* Added analyzeBusinessDocument to summarize and extract key info from PDF/Image documents */
export const analyzeBusinessDocument = async (
    file: File, 
    onProgress: (msg: string) => void, 
    settings?: SystemSettings
) => {
    onProgress("Extracting document semantic data...");
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = getModel(settings);
    const filePart = await fileToGenerativePart(file);
    
    const response = await ai.models.generateContent({
        model,
        contents: { parts: [filePart, { text: "Analyze this business document, summarize it, and find important dates." }] },
        config: {
            ...getModelConfig(model, "You are an intelligent business document processor."),
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    documentType: { type: Type.STRING },
                    summary: { type: Type.STRING },
                    keyDates: { type: Type.ARRAY, items: { type: Type.STRING } }
                }
            }
        }
    });
    
    return JSON.parse(response.text || '{}');
};

/* Added generateFinancialStrategy to build custom roadmap based on goals and ledger data */
export const generateFinancialStrategy = async (
    transactions: Transaction[], 
    goals: FinancialGoal[], 
    categories: Category[], 
    profile: BusinessProfile, 
    settings?: SystemSettings
) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = getModel(settings);
    
    const prompt = `Develop a strategy for these goals: ${JSON.stringify(goals)}. Base it on this transaction history sample: ${JSON.stringify(transactions.slice(0, 75))}. Business profile: ${JSON.stringify(profile)}`;
    
    const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
            ...getModelConfig(model, "You are a world-class financial architect and strategy planner."),
            responseMimeType: 'application/json',
            responseSchema: {
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
                }
            }
        }
    });
    
    return JSON.parse(response.text || '{}');
};
