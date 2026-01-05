import type { RawTransaction, TransactionType, AccountCategory, Account, AccountType } from '../types';
import { generateUUID } from '../utils';
import * as XLSX from 'xlsx';

const cleanDescription = (string: string): string => {
  let cleaned = (string || '').trim();
  cleaned = cleaned.replace(/\s+/g, ' ');
  cleaned = cleaned.replace(/^["']+|["']+$/g, '');
  cleaned = cleaned.replace(/[,.]+$/, '');
  
  // Strip common bank prefix noises
  cleaned = cleaned.replace(/^(Pos Debit|Debit Purchase|Recurring Payment|Preauthorized Debit|Checkcard|Visa Purchase) - /i, '');
  
  // Strip merchant ID garbage
  cleaned = cleaned.replace(/PAYMENTS ID NBR:.*$/i, '');
  cleaned = cleaned.replace(/ID NBR:.*$/i, '');
  cleaned = cleaned.replace(/EDI PYMNTS.*$/i, '');
  cleaned = cleaned.replace(/ACH ITEMS.*$/i, '');
  
  return cleaned.trim();
};

const toTitleCase = (str: string): string => {
    return str.replace(
        /\w\S*/g,
        (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase()
    );
};

const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
};

const parseDate = (dateStr: any): string | null => {
    if (!dateStr) return null;
    const str = String(dateStr).replace(/^"|"$/g, '').trim();
    if (!str || str.length < 5) return null;

    // Excel Serial Date handling
    if (!isNaN(dateStr) && typeof dateStr === 'number') {
        const d = XLSX.SSF.parse_date_code(dateStr);
        return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
    }

    // Attempt various standard formats
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // Try MM/DD/YY or similar re-parsing if Date() failed
    const parts = str.split(/[-/]/);
    if (parts.length === 3) {
        let y = parts[2], m = parts[0], d = parts[1];
        if (y.length === 2) y = parseInt(y) > 70 ? '19' + y : '20' + y;
        const testD = new Date(`${y}-${m}-${d}`);
        if (!isNaN(testD.getTime())) return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }

    return null;
}

const semanticHeaderMap = {
    date: ['date', 'transaction date', 'trans date', 'posted date', 'post date', 'dt', 'date of income'],
    description: ['description', 'name', 'payee', 'transaction', 'merchant', 'income source', 'reference', 'memo'],
    amount: ['amount', 'transaction amount', 'income amount', 'value'],
    debit: ['debit', 'withdraw', 'spend', 'payment', 'charge'],
    credit: ['credit', 'deposit', 'receive', 'earnings'],
    balance: ['balance', 'running balance'],
    status: ['status', 'cleared', 'type'],
    memo: ['memo', 'notes', 'reference']
};

const detectHeaders = (headers: string[]): Record<string, number> => {
    const colMap: Record<string, number> = { date: -1, description: -1, amount: -1, credit: -1, debit: -1, balance: -1, status: -1, memo: -1 };
    const normalizedHeaders = headers.map(h => h.toLowerCase().trim());

    Object.entries(semanticHeaderMap).forEach(([key, matches]) => {
        colMap[key] = normalizedHeaders.findIndex(h => matches.some(m => h === m || h.includes(m)));
    });

    return colMap;
};

const parseRowsToCanonical = (
    rows: any[], 
    headers: string[], 
    accountId: string, 
    accountType: AccountCategory,
    transactionTypes: TransactionType[],
    sourceName: string
): RawTransaction[] => {
    const transactions: RawTransaction[] = [];
    const colMap = detectHeaders(headers);
    
    const expenseTypeId = transactionTypes.find(t => t.balanceEffect === 'expense')?.id || 'type_purchase';
    const incomeTypeId = transactionTypes.find(t => t.balanceEffect === 'income')?.id || 'type_income';

    rows.forEach((row, rowIndex) => {
        const rawValues = headers.map(h => row[h]);
        
        // Date Ingestion
        const dateRaw = colMap.date > -1 ? rawValues[colMap.date] : null;
        const normalizedDate = parseDate(dateRaw);
        
        if (!normalizedDate) return;

        // Description
        const descRaw = colMap.description > -1 ? String(rawValues[colMap.description] || '') : 'Unspecified';
        const cleanedDesc = cleanDescription(descRaw);

        // Amount & Direction
        let amount = 0;
        let direction: 'debit' | 'credit' = 'debit';

        if (colMap.credit > -1 && colMap.debit > -1) {
            const creditVal = parseFloat(String(rawValues[colMap.credit] || '0').replace(/[$,\s]/g, '') || '0');
            const debitVal = parseFloat(String(rawValues[colMap.debit] || '0').replace(/[$,\s]/g, '') || '0');
            if (Math.abs(creditVal) > 0) { amount = Math.abs(creditVal); direction = 'credit'; }
            else { amount = Math.abs(debitVal); direction = 'debit'; }
        } else if (colMap.amount > -1) {
            const valStr = String(rawValues[colMap.amount] || '0').replace(/[$,\s]/g, '');
            let val = parseFloat(valStr);
            if (valStr.includes('(') && valStr.includes(')')) val = -Math.abs(val);
            
            if (val < 0) { amount = Math.abs(val); direction = 'debit'; }
            else { amount = val; direction = 'credit'; }
        }

        if (amount === 0) return;

        // Payment & Transfer Detection
        const lowerDesc = cleanedDesc.toLowerCase();
        const isPayment = ['payment', 'thank you', 'cardmember', 'autopay'].some(k => lowerDesc.includes(k));
        const isInternal = ['transfer', 'allocate'].some(k => lowerDesc.includes(k));

        // Derived Effects
        let cashFlow: 'inflow' | 'outflow' | 'none' = 'none';
        let liability: 'increase' | 'decrease' | 'none' = 'none';

        if (accountType === 'credit_card') {
            if (direction === 'debit') {
                cashFlow = 'none';
                liability = 'increase';
            } else {
                cashFlow = 'outflow'; // Paying the card
                liability = 'decrease';
            }
        } else {
            // Checking / Savings
            if (direction === 'debit') {
                cashFlow = 'outflow';
                liability = 'none';
            } else {
                cashFlow = 'inflow';
                liability = 'none';
            }
        }

        const canonical: RawTransaction = {
            transaction_date: normalizedDate,
            post_date: normalizedDate,
            amount: amount,
            direction: direction,
            description_raw: descRaw,
            merchant_clean: toTitleCase(cleanedDesc),
            category: colMap.status > -1 ? String(rawValues[colMap.status]) : 'Uncategorized',
            account_id: accountId,
            account_type: accountType,
            balance: colMap.balance > -1 ? parseFloat(String(rawValues[colMap.balance]).replace(/[$,\s]/g, '')) : null,
            status: 'cleared',
            memo_raw: colMap.memo > -1 ? String(rawValues[colMap.memo]) : null,
            currency: 'USD',
            is_internal_transfer: isInternal,
            is_payment: isPayment,
            cash_flow_effect: cashFlow,
            liability_effect: liability,
            raw_import_row: row,

            // Legacy
            date: normalizedDate,
            description: toTitleCase(cleanedDesc),
            categoryId: '',
            typeId: direction === 'credit' ? incomeTypeId : expenseTypeId,
            sourceFilename: sourceName,
            metadata: row
        };

        transactions.push(canonical);
    });

    return transactions;
}

export const parseTransactionsFromText = async (
    text: string, 
    account: Account,
    accountTypeObj: AccountType,
    transactionTypes: TransactionType[], 
    onProgress: (msg: string) => void
): Promise<RawTransaction[]> => {
    onProgress('Parsing text...');
    const workbook = XLSX.read(text, { type: 'string' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    if (data.length < 2) return [];

    const headers = data[0] as string[];
    const rows = XLSX.utils.sheet_to_json(sheet);
    
    return parseRowsToCanonical(
        rows, 
        headers, 
        account.id, 
        accountTypeObj.category || 'checking', 
        transactionTypes, 
        'Pasted Text'
    );
};

export const parseTransactionsFromFiles = async (
    files: File[], 
    account: Account,
    accountTypeObj: AccountType,
    transactionTypes: TransactionType[], 
    onProgress: (msg: string) => void
): Promise<RawTransaction[]> => {
    const allTransactions: RawTransaction[] = [];
    for (const file of files) {
        onProgress(`Reading ${file.name}...`);
        const buffer = await readFileAsArrayBuffer(file);
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        
        if (data.length < 2) continue;
        
        const headers = data[0] as string[];
        const rows = XLSX.utils.sheet_to_json(sheet);
        
        const transactions = parseRowsToCanonical(
            rows, 
            headers, 
            account.id, 
            accountTypeObj.category || 'checking', 
            transactionTypes, 
            file.name
        );
        allTransactions.push(...transactions);
    }
    return allTransactions;
};

// Placeholder for remaining unused exports to maintain file integrity
export const parseAmazonReport = async (file: File, onProgress: (msg: string) => void) => { return []; };
export const parseAmazonVideos = async (file: File, onProgress: (msg: string) => void) => { return []; };
export const parseYouTubeReport = async (file: File, onProgress: (msg: string) => void) => { return []; };
