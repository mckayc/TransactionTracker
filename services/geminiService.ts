
import { GoogleGenAI, Type } from '@google/genai';
import type { RawTransaction, Transaction, TransactionType, AuditFinding, Category, BusinessProfile, ChatMessage, FinancialGoal, Location, User, Counterparty, ReconciliationRule, AiConfig } from '../types';
// Added missing import for generateUUID
import { generateUUID } from '../utils';

// Default to Gemini 3 series as per instructions for standard text-based tasks
let currentAiConfig: AiConfig = {
    textModel: 'gemini-3-flash-preview',
    complexModel: 'gemini-3-pro-preview',
    thinkingBudget: 0
};

/**
 * Validates and updates the current AI configuration.
 * Uses strict model naming from the developer guidelines to prevent 404 errors.
 */
export const updateGeminiConfig = (config: AiConfig) => {
    const sanitizeModel = (modelId: string | undefined, fallback: string) => {
        if (!modelId || modelId === 'undefined' || modelId === 'null') return fallback;
        return modelId;
    };

    if (config.textModel) {
        currentAiConfig.textModel = sanitizeModel(config.textModel, 'gemini-3-flash-preview');
    }
    if (config.complexModel) {
        currentAiConfig.complexModel = sanitizeModel(config.complexModel, 'gemini-3-pro-preview');
    }
    if (config.thinkingBudget !== undefined) {
        currentAiConfig.thinkingBudget = config.thinkingBudget;
    }
    console.log("[GEMINI] Configuration active:", currentAiConfig);
};

export const getActiveModels = () => ({ ...currentAiConfig });

/**
 * Retrieves the API Key from the injected global environment.
 * The server serves /env.js which populates window.process.env.API_KEY.
 */
export const getApiKey = (): string => {
    const injectedProc = (window as any).process;
    const configObj = (window as any).__FINPARSER_CONFIG__;
    
    // Check multiple injection points for maximum resilience
    const key = configObj?.API_KEY || injectedProc?.env?.API_KEY || process.env.API_KEY;
    
    return (key && key !== 'undefined' && key !== 'null') ? key.trim() : '';
};

export const hasApiKey = (): boolean => {
    return getApiKey().length > 0;
};

/**
 * Tests connectivity using the currently configured text model.
 */
export const validateApiKeyConnectivity = async (): Promise<{ success: boolean, message: string }> => {
    const key = getApiKey();
    if (!key) return { success: false, message: "No API Key detected. Ensure the API_KEY environment variable is set in your container." };
    
    const ai = new GoogleGenAI({ apiKey: key });
    const model = currentAiConfig.textModel || 'gemini-3-flash-preview';
    
    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: "Respond with 'OK'.",
            config: { 
                maxOutputTokens: 5,
                thinkingConfig: { thinkingBudget: 0 }
            }
        });
        if (response && response.text) {
            return { success: true, message: `Handshake successful. Model ${model} responded: "${response.text.trim()}"` };
        }
        return { success: true, message: `Connected to ${model}. Ready for analysis.` };
    } catch (e: any) {
        console.error("Gemini Handshake Failure:", e);
        // Clean up common error messages for the user
        let msg = e.message || "Unknown error";
        if (msg.includes("404")) msg = `Model '${model}' not found or is restricted. Please select a verified Gemini 3 or Flash-latest model in Settings.`;
        if (msg.includes("403")) msg = "API Key restricted or invalid. Check your Google AI Studio project permissions.";
        
        return { success: false, message: `Engine Error: ${msg}` };
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
    if (!key) throw new Error("Missing API Key.");
    
    const ai = new GoogleGenAI({ apiKey: key });
    let sampleParts: any[] = [];
    if (typeof data === 'string') {
        sampleParts = [{ text: `DATA SAMPLE:\n${data}` }];
    } else {
        sampleParts = [await fileToGenerativePart(data)];
    }

    const systemInstruction = `You are a Senior Financial Systems Architect. Task: generate atomic normalization rules for FinParser.
    Analyze patterns in description and metadata to suggest category, counterparty, and location mapping.
    Contextual User Notes: ${promptContext || 'None provided'}.`;

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
                thinkingConfig: { thinkingBudget: Math.max(currentAiConfig.thinkingBudget || 0, 2000) }
            }
        });

        const parsed = JSON.parse(response.text || '{"rules": []}');
        return (parsed.rules || []).filter(Boolean).map((r: any) => ({
            ...r,
            id: generateUUID(),
            isAiDraft: true,
            conditions: (r.conditions || []).filter(Boolean).map((c: any) => ({ 
                ...c, 
                id: generateUUID(), 
                type: 'basic', 
                nextLogic: 'AND' 
            }))
        }));
    } catch (e: any) {
        console.error("Gemini Rule Forge Error:", e);
        throw new Error(e.message || "Rule synthesis failed.");
    }
};

export const forgeRulesWithCustomPrompt = async (
    customPrompt: string,
    data: string,
    transactionTypes: TransactionType[],
    onProgress?: (msg: string) => void
): Promise<ReconciliationRule[]> => {
    const key = getApiKey();
    if (!key) throw new Error("Missing API Key.");
    onProgress?.("Igniting Neural Core...");
    
    const ai = new GoogleGenAI({ apiKey: key });
    
    const typeNames = transactionTypes.map(t => t.name).join(', ');
    const systemInstruction = `You are a Lead Financial Engineering AI. 
    Analyze the provided raw transaction data based on the user's specific extraction protocol.
    Your output MUST be a JSON array of rules for a reconciliation engine.
    Rules should be atomic and precise.
    
    CRITICAL: For each rule, suggest a Transaction Type name. 
    You MUST prioritize these existing system types if they fit: [${typeNames}].
    
    PROTOCOL: ${customPrompt}`;

    const schema = {
        type: Type.OBJECT,
        properties: {
            rules: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING, description: "Display name of the rule" },
                        conditions: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    field: { type: Type.STRING, enum: ["description", "amount", "accountId", "metadata"] },
                                    operator: { type: Type.STRING, enum: ["contains", "equals", "starts_with", "ends_with"] },
                                    value: { type: Type.STRING }
                                },
                                required: ["field", "operator", "value"]
                            }
                        },
                        setDescription: { type: Type.STRING },
                        suggestedCategoryName: { type: Type.STRING },
                        suggestedCounterpartyName: { type: Type.STRING },
                        suggestedLocationName: { type: Type.STRING },
                        suggestedTypeName: { type: Type.STRING, description: "The name of the transaction type (e.g. Purchase, Income)" },
                        suggestedTags: { type: Type.ARRAY, items: { type: Type.STRING } },
                        skipImport: { type: Type.BOOLEAN }
                    },
                    required: ["name", "conditions"]
                }
            }
        },
        required: ['rules']
    };

    try {
        const response = await ai.models.generateContent({
            model: currentAiConfig.complexModel || 'gemini-3-pro-preview',
            contents: `RAW TRANSACTION DATA:\n${data}`,
            config: { 
                systemInstruction,
                responseMimeType: 'application/json',
                responseSchema: schema,
                thinkingConfig: { thinkingBudget: Math.max(currentAiConfig.thinkingBudget || 0, 4000) }
            }
        });

        const parsed = JSON.parse(response.text || '{"rules": []}');
        onProgress?.("Normalization logic synthesized.");
        return (parsed.rules || []).map((r: any) => ({
            ...r,
            id: generateUUID(),
            isAiDraft: true,
            conditions: (r.conditions || []).map((c: any) => ({ 
                ...c, 
                id: generateUUID(), 
                type: 'basic', 
                nextLogic: 'AND' 
            }))
        }));
    } catch (e: any) {
        console.error("Custom Rule Forge Error:", e);
        throw new Error(e.message || "Synthesis failed.");
    }
};

export const getAiFinancialAnalysis = async (query: string, contextData: any) => {
    const key = getApiKey();
    if (!key) throw new Error("Missing API Key.");
    const ai = new GoogleGenAI({ apiKey: key });
    
    const optimizedContext = {
        ...contextData,
        transactions: (contextData.transactions || []).filter(Boolean).slice(0, 100).map((t: any) => ({
            date: t.date,
            desc: t.description,
            amt: t.amount,
            cat: t.categoryId,
            ent: t.counterpartyId
        }))
    };

    const stream = await ai.models.generateContentStream({
        model: currentAiConfig.textModel || 'gemini-3-flash-preview',
        contents: `CONTEXT:\n${JSON.stringify(optimizedContext)}\n\nUSER QUERY: ${query}`,
        config: {
            systemInstruction: "You are FinParser AI, a world-class financial analyst. Use Markdown for reports.",
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
    if (!key) throw new Error("Missing API Key.");
    const ai = new GoogleGenAI({ apiKey: key });
    
    onProgress("AI is reading statements...");
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
                    required: ["date", "description", "amount"]
                }
            }
        },
        required: ["transactions"]
    };
    const response = await ai.models.generateContent({
        model: currentAiConfig.textModel || 'gemini-3-flash-preview',
        contents: { parts: [...fileParts, { text: "Extract transaction rows including date, description, amount, and type (income/purchase)." }] },
        config: {
            responseMimeType: "application/json",
            responseSchema: schema,
            thinkingConfig: { thinkingBudget: 0 }
        }
    });
    const result = JSON.parse(response.text || '{"transactions": []}');
    const txs = result.transactions || [];
    
    const incomingType = transactionTypes.find(t => t.balanceEffect === 'incoming') || transactionTypes[0];
    const outgoingType = transactionTypes.find(t => t.balanceEffect === 'outgoing') || transactionTypes[0];

    return txs.map((tx: any) => ({
        ...tx,
        accountId,
        typeId: tx.type?.toLowerCase().includes('income') ? incomingType.id : outgoingType.id
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
    if (!key) throw new Error("Missing API Key.");
    const ai = new GoogleGenAI({ apiKey: key });

    onProgress("AI is parsing stream...");
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
                        amount: { type: Type.NUMBER }
                    },
                    required: ["date", "description", "amount"]
                }
            }
        },
        required: ["transactions"]
    };
    const response = await ai.models.generateContent({
        model: currentAiConfig.textModel || 'gemini-3-flash-preview',
        contents: `Extract transactions from this raw data: ${text}`,
        config: {
            responseMimeType: "application/json",
            responseSchema: schema,
            thinkingConfig: { thinkingBudget: 0 }
        }
    });
    const result = JSON.parse(response.text || '{"transactions": []}');
    const txs = result.transactions || [];

    const outgoingType = transactionTypes.find(t => t.balanceEffect === 'outgoing') || transactionTypes[0];

    return txs.map((tx: any) => ({
        ...tx,
        accountId,
        typeId: outgoingType.id
    }));
};

export const askAiAdvisor = async (prompt: string): Promise<string> => {
    const key = getApiKey();
    if (!key) return "Configuration required.";
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
    if (!key) throw new Error("Missing API Key.");
    const ai = new GoogleGenAI({ apiKey: key });
    const contents = messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
    }));
    const stream = await ai.models.generateContentStream({
        model: currentAiConfig.textModel || 'gemini-3-flash-preview',
        contents,
        config: {
            systemInstruction: `You are a world-class financial strategy bot for a ${profile.info.businessType || 'business'}.`,
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
        contents: `Audit request: ${auditType} on data: ${JSON.stringify(transactions.slice(0, 50))}`,
        config: { responseMimeType: "application/json", responseSchema: schema, thinkingConfig: { thinkingBudget: 0 } }
    });
    const result = JSON.parse(response.text || '{"findings": []}');
    return (result.findings || []);
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
        contents: { parts: [part, { text: "Summarize this financial document." }] },
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
        contents: `Analyze data for wealth plan: ${JSON.stringify(profile)}. Goals: ${JSON.stringify(goals)}.`,
        config: { 
            responseMimeType: "application/json", 
            responseSchema: schema,
            thinkingConfig: { thinkingBudget: Math.max(currentAiConfig.thinkingBudget || 0, 4000) }
        }
    });
    return JSON.parse(response.text || '{"strategy": "No response."}');
};
