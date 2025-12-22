import { GoogleGenAI, Type } from '@google/genai';
import type { RawTransaction, TransactionType, BusinessDocument, Transaction, AuditFinding, Category, BusinessProfile, ChatMessage } from '../types';
import * as XLSX from 'xlsx';

declare const pdfjsLib: any;

// API key is strictly obtained from environment variable per guidelines
export const hasApiKey = (): boolean => {
    let envKey = '';
    try {
        envKey = process.env.API_KEY || '';
    } catch (e) {}
    return (!!envKey && envKey.trim() !== '');
};

// Centralized function to get the AI client strictly from environment variables.
const getAiClient = () => {
    let apiKey = '';
    try {
        apiKey = process.env.API_KEY || '';
    } catch (e) {}
    
    if (!apiKey || apiKey.trim() === '') {
        throw new Error("API Key is missing. Please check your environment variables.");
    }
    return new GoogleGenAI({ apiKey });
};

const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsText(file);
    });
};

const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
};

const fileToGenerativePart = async (file: File, onProgress: (msg: string) => void) => {
    // Handle CSV files as text
    if (file.type === 'text/csv') {
        onProgress(`Reading CSV ${file.name}...`);
        const textContent = await readFileAsText(file);
        return [{ text: `\n\n--- CSV Data from ${file.name} ---\n${textContent}` }];
    }

    // Handle Excel files as text (converted via XLSX)
    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.type.includes('spreadsheet') || file.type.includes('excel')) {
        onProgress(`Reading Excel ${file.name}...`);
        const buffer = await readFileAsArrayBuffer(file);
        const workbook = XLSX.read(buffer, { type: 'array' });
        let fullText = `\n\n--- Excel Workbook Data from ${file.name} ---\n`;
        
        workbook.SheetNames.forEach((sheetName: string) => {
            const worksheet = workbook.Sheets[sheetName];
            const csv = XLSX.utils.sheet_to_csv(worksheet);
            fullText += `\n[Sheet: ${sheetName}]\n${csv}\n`;
        });
        
        return [{ text: fullText }];
    }

    // Handle PDFs as images
    onProgress(`Reading PDF ${file.name}...`);
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
    const numPages = pdf.numPages;
    const imageParts = [];

    const maxPages = 5;
    const pagesToProcess = Math.min(numPages, maxPages);

    for (let i = 1; i <= pagesToProcess; i++) {
        onProgress(`Processing page ${i} of ${pagesToProcess} from ${file.name}...`);
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        if (!context) {
            throw new Error('Could not get canvas context');
        }

        await page.render({ canvasContext: context, viewport: viewport }).promise;

        const base64Data = canvas.toDataURL('image/jpeg').split(',')[1];
        imageParts.push({
            inlineData: {
                data: base64Data,
                mimeType: 'image/jpeg'
            }
        });
    }
    const parts = [
        { text: `\n\n--- Document Start: ${file.name} ---` },
        ...imageParts,
        { text: `\n\n--- Document End: ${file.name} ---` }
    ];
    return parts;
};

const getBasePrompt = (transactionTypes: TransactionType[]) => {
    const getNames = (effect: 'income' | 'expense' | 'transfer') =>
        transactionTypes.filter(t => t.balanceEffect === effect).map(t => `"${t.name}"`).join(', ');

    return `
    You are an expert financial analyst. Your primary goal is to accurately extract transactions from financial statements. It is crucial to first determine if the document is a **Credit Card Statement** or a **Bank Statement (Checking/Savings)**, as the rules for transaction type classification depend on this.

    **Analysis Steps:**
    1.  **Identify Document Type:** Read the document title and content to determine its type. Look for keywords like "Credit Card Statement", "Mastercard", "Visa" vs. "Checking Account", "Savings Account", "Bank Statement". This is the most important step.
    2.  **Extract Transactions:** For each individual transaction, extract the following details:
        - **date**: The date of the transaction (e.g., YYYY-MM-DD).
        - **description**: A clean description of the merchant or transaction. **CRITICAL**: If the description contains a city/state (e.g. "STARBUCKS AUSTIN TX"), REMOVE the location from this field so it is just "STARBUCKS".
        - **amount**: The transaction amount, as a positive number.
        - **category**: A relevant category from this list: "Groceries", "Dining", "Shopping", "Travel", "Entertainment", "Utilities", "Health", "Services", "Transportation", "Income", "Other".
        - **transactionType**: **This is critical.** Apply the correct logic based on the document type, and then assign the best matching type name from the lists below.
            - **If it's a Credit Card Statement:**
                - Purchases, debits, or charges are **expenses**. These increase what the user owes. Use one of these types: ${getNames('expense')}.
                - Payments made to the credit card (e.g., "PAYMENT RECEIVED, THANK YOU", "AUTOPAY", "ONLINE PAYMENT") are **transfers** between accounts. Use one of these types: ${getNames('transfer')}.
                - Credits from merchants for returned items are **income-like refunds**. Use one of these types: ${getNames('income')}.
            - **If it's a Bank Statement (Checking/Savings):**
                - Withdrawals, debits, checks, or debit card purchases are **expenses**. These decrease the account balance. Use one of these types: ${getNames('expense')}.
                - Deposits or credits into the account (e.g., "Direct Deposit", "Interest Paid") are **income**. These increase the account balance. Use one of these types: ${getNames('income')}.
                - Money moved between the user's accounts (e.g., a payment to a credit card like "ONLINE PAYMENT TO VISA") is a **transfer**. Use one of these types: ${getNames('transfer')}.
        - **location**: Extract the City and State (e.g., "Austin, TX", "San Francisco, CA") if present in the raw description text.
        - **sourceFilename**: The name of the file this transaction was extracted from. Use the '--- Document Start: [filename] ---' or '--- CSV Data from [filename] ---' markers to identify it.
    
    **Important Rules:**
    - Ignore summary sections, cache advance details, interest charges, fees, and other non-transactional items unless a specific "Fee" or "Interest Charge" type is available.
    - The final 'amount' in the JSON must always be a positive number. The \`transactionType\` you choose indicates the money flow.
    - Return ONLY the specified JSON format. Do not include any other text or explanations.
`;
}

const getResponseSchema = () => ({
    type: Type.OBJECT,
    properties: {
        transactions: {
            type: Type.ARRAY,
            description: "A list of all extracted transactions.",
            items: {
                type: Type.OBJECT,
                properties: {
                    date: { type: Type.STRING, description: 'Transaction date in YYYY-MM-DD format.' },
                    description: { type: Type.STRING, description: 'Clean merchant or transaction description (without location).' },
                    category: { type: Type.STRING, description: 'The most relevant expense category.' },
                    amount: { type: Type.NUMBER, description: 'Transaction amount as a positive number.' },
                    transactionType: { type: Type.STRING, description: 'The name of the transaction type that best fits.' },
                    location: { type: Type.STRING, description: 'City and State (e.g. Austin, TX) extracted from text.' },
                    sourceFilename: { type: Type.STRING, description: 'The name of the source file, if available.' },
                },
                required: ['date', 'description', 'category', 'amount', 'transactionType']
            },
        },
    },
    required: ['transactions']
});

const processApiResponse = (response: any, accountId: string, transactionTypes: TransactionType[], sourceName?: string): RawTransaction[] => {
    // text is a property, not a function
    const jsonText = response.text?.trim() || '';
    if (!jsonText) {
        throw new Error("AI returned an empty response.");
    }
    
    const typeNameToIdMap = new Map(transactionTypes.map(t => [t.name.toLowerCase(), t.id]));
    const defaultExpenseId = transactionTypes.find(t => t.name === 'Other Expense')?.id || transactionTypes[0].id;

    try {
        const parsedResponse = JSON.parse(jsonText);
        const transactions = parsedResponse.transactions || [];
        return transactions.map((tx: any) => ({
            date: tx.date,
            description: tx.description,
            category: tx.category,
            amount: tx.amount,
            location: tx.location,
            accountId,
            typeId: typeNameToIdMap.get(tx.transactionType?.toLowerCase()) || defaultExpenseId,
            sourceFilename: tx.sourceFilename || sourceName,
        }));
    } catch (e) {
        console.error("Failed to parse JSON response:", jsonText);
        throw new Error("The AI returned data in an invalid format. Please try again.");
    }
};

export const extractTransactionsFromFiles = async (files: File[], accountId: string, transactionTypes: TransactionType[], onProgress: (msg: string) => void): Promise<RawTransaction[]> => {
    onProgress(`Preparing ${files.length} file(s) for analysis...`);

    const generativeParts = (await Promise.all(files.map(file => fileToGenerativePart(file, onProgress)))).flat();
    
    onProgress('Sending data to AI for analysis. This may take a moment...');
    
    const ai = getAiClient();
    // Use modern model and correct content structure
    const contents = { parts: [{ text: getBasePrompt(transactionTypes) }, ...generativeParts] };

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview', 
        contents,
        config: {
            responseMimeType: 'application/json',
            responseSchema: getResponseSchema(),
        },
    });

    onProgress('Finalizing results...');
    return processApiResponse(response, accountId, transactionTypes);
};

export const extractTransactionsFromText = async (text: string, accountId: string, transactionTypes: TransactionType[], onProgress: (msg: string) => void): Promise<RawTransaction[]> => {
    onProgress('Sending text to AI for analysis...');

    const ai = getAiClient();
    const prompt = getBasePrompt(transactionTypes);
    const contents = { parts: [{ text: prompt }, { text: `\n\n--- User Pasted Data ---\n${text}` }] };

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents,
        config: {
            responseMimeType: 'application/json',
            responseSchema: getResponseSchema(),
        },
    });

    onProgress('Finalizing results...');
    return processApiResponse(response, accountId, transactionTypes, 'Pasted Text');
};

const sanitizeContextData = (contextData: any): string => {
    // Create a simplified version of the data to avoid token limits and circular references
    try {
        const simplified = {
            transactions_count: contextData.transactions?.length || 0,
            recent_transactions: contextData.transactions?.slice(0, 100).map((t: any) => ({
                date: t.date,
                desc: t.description,
                amt: t.amount,
                cat: t.category
            })) || [],
            accounts: contextData.accounts?.map((a: any) => a.name) || [],
            business_profile: contextData.businessProfile || {},
            upcoming_tasks: contextData.tasks?.filter((t: any) => !t.isCompleted).map((t: any) => t.title) || []
        };
        return JSON.stringify(simplified, null, 2);
    } catch (e) {
        console.error("Failed to sanitize context data", e);
        return "{}";
    }
};

export const getAiFinancialAnalysis = async (question: string, contextData: object) => {
    const date = new Date().toLocaleDateString();
    const ai = getAiClient();
    
    const safeJson = sanitizeContextData(contextData);

    const prompt = `
        You are a helpful and friendly financial AI assistant for an app called FinParser.
        The current date is ${date}.
        The user has asked the following question: "${question}"

        Here is a summary of the user's financial data (JSON). Use this data to answer the user's question.
        Do not mention that you are using JSON data, just answer the question naturally.
        Format your response using Markdown.

        Context Data:
        ${safeJson}
    `;

    const contents = { parts: [{ text: prompt }] };

    const responseStream = await ai.models.generateContentStream({
        model: 'gemini-3-flash-preview', 
        contents,
    });
    
    return responseStream;
};


export const analyzeBusinessDocument = async (file: File, onProgress: (msg: string) => void): Promise<BusinessDocument['aiAnalysis']> => {
    onProgress('Analyzing document structure...');
    const parts = await fileToGenerativePart(file, (msg) => console.log(msg));
    
    onProgress('Asking AI for tax insights...');
    const ai = getAiClient();
    
    const prompt = `
        You are a professional tax consultant and business advisor.
        Analyze the attached document. 
        
        Extract the following information in JSON format:
        1. "documentType": What is this document? (e.g., "IRS Letter CP-575", "Articles of Organization", "Invoice", "Contract").
        2. "summary": A concise 1-2 sentence summary of what this document is about.
        3. "keyDates": An array of strings representing any important dates, deadlines, or effective dates found in the text.
        4. "taxTips": An array of 1-3 actionable tips or next steps for a small business owner relevant to this document type. If it's an IRS letter, explain what to do. If it's an invoice, mention record keeping.
    `;

    const contents = { parts: [{ text: prompt }, ...parts] };

    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview', 
        contents,
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    documentType: { type: Type.STRING },
                    summary: { type: Type.STRING },
                    keyDates: { type: Type.ARRAY, items: { type: Type.STRING } },
                    taxTips: { type: Type.ARRAY, items: { type: Type.STRING } }
                }
            }
        }
    });

    const json = JSON.parse(response.text || '{}');
    return json;
};

export const streamTaxAdvice = async (history: ChatMessage[], profile: BusinessProfile) => {
    const ai = getAiClient();
    
    const systemPrompt = `
        You are an expert US Tax Consultant and Business Advisor.
        Your goal is to help a small business owner maximize their tax returns, ensure compliance, and organize their finances.
        
        **Business Context:**
        - Legal Name: ${profile.info.llcName || 'Not Set'}
        - Business Type: ${profile.info.businessType || 'Not Set'}
        - State of Formation: ${profile.info.stateOfFormation || 'Not Set'}
        - Industry: ${profile.info.industry || 'Not Set'}
        - Tax Filing Status: ${profile.tax.filingStatus || 'Not Set'}
        - Tax Year End: ${profile.tax.taxYearEnd || 'Not Set'}

        **Instructions:**
        - Use the Business Context above to tailor your advice.
        - If the business type or state implies specific forms (e.g. Schedule C for Sole Props, Form 1065 for Partnership), mention them.
        - Be concise, professional, and encouraging.
        - Use Markdown for formatting (bolding key terms, lists).
        - Disclaimer: Always remind the user that you are an AI and they should consult a certified professional for final decisions.
    `;

    const contents = [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: "Understood. I have reviewed your business profile and am ready to act as your tax advisor." }] },
        ...history.map(msg => ({
            role: msg.role === 'ai' ? 'model' : 'user',
            parts: [{ text: msg.content }]
        }))
    ];

    const responseStream = await ai.models.generateContentStream({
        model: 'gemini-3-pro-preview',
        contents: contents as any, 
    });

    return responseStream;
};

// Legacy single-turn (keep for backward compatibility if needed)
export const askAiAdvisor = async (prompt: string): Promise<string> => {
    const ai = getAiClient();
    const result = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
    });
    return result.text || "I couldn't find an answer right now.";
};

export const getIndustryDeductions = async (industry: string): Promise<string[]> => {
    const ai = getAiClient();
    const prompt = `
        List 5-10 potential tax deductions specifically for a "${industry}" business in the US.
        Return only a JSON array of strings.
    `;
    const result = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
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
        console.error("Error parsing deductions:", e);
        return [];
    }
};

export const auditTransactions = async (
    transactions: Transaction[], 
    transactionTypes: TransactionType[], 
    categories: Category[],
    auditType: 'transfers' | 'subscriptions' | 'mortgage_splits' | 'smart_match' | 'general' | string,
    trainingExamples?: Transaction[][]
): Promise<AuditFinding[]> => {
    const ai = getAiClient();
    
    // Minimize data sent to AI to save tokens and improve speed
    const simplify = (tx: Transaction) => ({
        id: tx.id,
        date: tx.date,
        desc: tx.description,
        amt: tx.amount,
        type: transactionTypes.find(t => t.id === tx.typeId)?.name,
        cat: categories.find(c => c.id === tx.categoryId)?.name
    });

    const simplifiedTransactions = transactions.map(simplify);

    let promptInstruction = "";
    if (auditType === 'transfers') {
        promptInstruction = "Identify transactions that appear to be transfers between accounts (e.g., Credit Card Payments, Venmo transfers, Zelle, 'Transfer to') but are currently categorized as Income or Expense. Ignore small amounts under $10.";
    } else if (auditType === 'subscriptions') {
        promptInstruction = "Identify recurring subscription payments (e.g., Netflix, Spotify, Adobe, Gym) that might be miscategorized or hidden in 'General'.";
    } else if (auditType === 'smart_match') {
        promptInstruction = `
            Scan for 'Smart Match' opportunities. 
            You are looking for a specific pattern: A single large payment transaction (often a credit card payment, reimbursement, or transfer) that roughly equals the sum of several smaller expense transactions (within $0.05). 
            
            IMPORTANT: 'Payment' refers to the transfer transaction (often positive if it's a payment to a card, or negative if it's a withdrawal from checking, depends on context). 'Expenses' are the individual purchases.
            
            1. Identify the 'Payment' transaction (typically a large amount). 
            2. Identify the group of 'Expense' transactions whose combined total roughly equals the Payment amount. 
            3. Create a finding that includes ALL their IDs (Payment + Expenses) in 'affectedTransactionIds'. 
            4. Title the finding 'Smart Match: Payment for [X] items'.
        `;
        
        if (trainingExamples && trainingExamples.length > 0) {
            const examplesJson = trainingExamples.map(group => group.map(simplify));
            promptInstruction += `
            
            **TRAINING EXAMPLES:**
            The user has provided the following examples of correctly linked groups. Use these to understand the patterns they are looking for (e.g. Date proximity, Payee naming conventions, Ratio of payment to expenses).
            ${JSON.stringify(examplesJson)}
            `;
        }
    } else {
        promptInstruction = `Perform a general audit or answer this specific query: "${auditType}". Look for anomalies, misclassifications, or transfers marked as expenses.`;
    }

    const prompt = `
        You are a strict financial auditor.
        Analyze the following list of transactions JSON.
        
        Task: ${promptInstruction}
        
        Available Transaction Types to suggest: ${transactionTypes.map(t => t.name).join(', ')}
        Available Categories to suggest: ${categories.map(c => c.name).join(', ')}

        Return a JSON object with a "findings" array.
        Each finding must have:
        - id: unique string
        - title: Short title of the issue (e.g., "Potential Credit Card Payment")
        - reason: Why you flagged this.
        - affectedTransactionIds: Array of strings (ids from input)
        - suggestedChanges: Object containing ANY of these optional fields if a change is needed: { categoryId: string (ID from list below), typeId: string (ID from list below), payeeName: string }
        
        Map the suggested category/type names to these IDs:
        Categories Map: ${JSON.stringify(Object.fromEntries(categories.map(c => [c.name, c.id])))}
        Transaction Types Map: ${JSON.stringify(Object.fromEntries(transactionTypes.map(t => [t.name, t.id])))}
    `;

    const contents = { 
        parts: [
            { text: prompt }, 
            { text: JSON.stringify(simplifiedTransactions) }
        ] 
    };

    const result = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents,
        config: {
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
                                        typeId: { type: Type.STRING },
                                        payeeName: { type: Type.STRING }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    try {
        const response = JSON.parse(result.text || '{ "findings": [] }');
        return response.findings || [];
    } catch (e) {
        console.error("Audit parsing error", e);
        return [];
    }
};