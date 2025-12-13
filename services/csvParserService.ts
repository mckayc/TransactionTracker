
import type { RawTransaction, TransactionType, AmazonMetric, AmazonReportType } from '../types';
import { generateUUID } from '../utils';

declare const pdfjsLib: any;

const cleanDescription = (string: string): string => {
  // Cleans up common noise from transaction descriptions for better readability.
  // "COSTCO WHSE #0733 " -> "COSTCO WHSE #0733"
  // "'AMAZON PRIME'," -> "AMAZON PRIME"
  let cleaned = string.trim();
  // Collapse multiple spaces into one
  cleaned = cleaned.replace(/\s+/g, ' ');
  // Remove one or more quotes from the start and end
  cleaned = cleaned.replace(/^["']+|["']+$/g, '');
  // Remove one or more trailing commas or periods
  cleaned = cleaned.replace(/[,.]+$/, '');
  
  // Clean up common bank statement noise prefixes
  cleaned = cleaned.replace(/^(Pos Debit|Debit Purchase|Recurring Payment|Preauthorized Debit|Checkcard|Visa Purchase) - /i, '');
  
  // Trim again in case the removals left whitespace at the ends
  return cleaned.trim();
};

const toTitleCase = (str: string): string => {
    return str.replace(
        /\w\S*/g,
        (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase()
    );
};

const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsText(file);
    });
};

const parseDate = (dateStr: string): Date | null => {
    if (!dateStr || dateStr.length < 5) return null; // Avoid tiny strings

    // Try YYYY-MM-DD
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(dateStr)) {
        const date = new Date(dateStr + 'T00:00:00'); // Add time to avoid timezone issues
        if (!isNaN(date.getTime())) return date;
    }
    
    // Try MM-DD-YYYY or MM-DD-YY
    if (/^\d{1,2}-\d{1,2}-\d{2,4}$/.test(dateStr)) {
        const parts = dateStr.split('-');
        let year = parseInt(parts[2], 10);
        if (year < 100) { // Handle 2-digit year
            year += year < 70 ? 2000 : 1900;
        }
        const date = new Date(year, parseInt(parts[0], 10) - 1, parseInt(parts[1], 10));
        if (!isNaN(date.getTime())) return date;
    }

    // Try MM/DD/YY or MM/DD/YYYY
    if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(dateStr)) {
        const parts = dateStr.split('/');
        let year = parseInt(parts[2], 10);
        if (year < 100) { // Handle 2-digit year
            year += year < 70 ? 2000 : 1900;
        }
        const date = new Date(year, parseInt(parts[0], 10) - 1, parseInt(parts[1], 10));
        if (!isNaN(date.getTime())) return date;
    }

    // Fallback for textual dates like "Nov 6, 2025" or "02-Nov-2024"
    // We add a strict check to ensure it contains a month name or looks date-like
    const hasDateStructure = /[a-zA-Z]{3,}\s+\d{1,2},?\s+\d{4}/.test(dateStr) || /\d{1,2}\s+[a-zA-Z]{3,}\s+\d{4}/.test(dateStr) || /\d{1,2}-[a-zA-Z]{3}-\d{4}/.test(dateStr);
    
    if (hasDateStructure) {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime()) && date.getFullYear() > 1990 && date.getFullYear() < 2050) return date;
    }
    
    return null;
}

const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export const parseAmazonReport = async (file: File, onProgress: (msg: string) => void): Promise<AmazonMetric[]> => {
    onProgress(`Reading ${file.name}...`);
    const text = await readFileAsText(file);
    const lines = text.split('\n');
    const metrics: AmazonMetric[] = [];

    if (lines.length < 2) return [];

    // Header Detection
    let headerIndex = -1;
    let isCreatorConnections = false;

    for (let i = 0; i < Math.min(lines.length, 10); i++) {
        const lower = lines[i].toLowerCase();
        if (lower.includes('campaign title')) {
            headerIndex = i;
            isCreatorConnections = true;
            break;
        }
        if (lower.includes('tracking id') && lower.includes('asin')) {
            headerIndex = i;
            break;
        }
    }

    if (headerIndex === -1) {
        throw new Error("Invalid Amazon Report format. Could not find recognizable header.");
    }

    const header = lines[headerIndex].split(/[,;\t]/).map(h => h.trim().replace(/"/g, '').toLowerCase());
    
    // Map Columns based on known schemas
    const colMap = {
        date: header.findIndex(h => h === 'date' || h === 'date shipped'),
        asin: header.findIndex(h => h === 'asin'),
        title: header.findIndex(h => h === 'product title' || h === 'title' || h === 'name'),
        clicks: header.findIndex(h => h === 'clicks'),
        ordered: header.findIndex(h => h === 'ordered items' || h === 'items shipped'),
        shipped: header.findIndex(h => h === 'shipped items'),
        income: header.findIndex(h => h.includes('earnings') || h.includes('ad fees') || h.includes('commission income') || h.includes('bounties')),
        conversion: header.findIndex(h => h.includes('conversion')),
        tracking: header.findIndex(h => h.includes('tracking id')),
        category: header.findIndex(h => h === 'category' || h === 'product group'),
        campaignTitle: header.findIndex(h => h === 'campaign title')
    };

    if (colMap.asin === -1) {
         throw new Error("Missing ASIN column.");
    }

    // Process rows
    for (let i = headerIndex + 1; i < lines.length; i++) {
        let line = lines[i].trim();
        if (!line) continue;

        let values: string[] = [];
        if (line.includes('\t')) {
             values = line.split('\t').map(v => v.trim().replace(/"/g, ''));
        } else {
             // Handle "inch" symbol edge case in CSVs
             // If a line has an odd number of quotes, it's likely broken by unescaped inches (e.g. 1.8")
             const quoteCount = (line.match(/"/g) || []).length;
             if (quoteCount % 2 !== 0) {
                 // Heuristic: Replace quotes preceded by a digit with "in" to normalize quotes
                 // matches 1.8" or 1/4"
                 line = line.replace(/(\d)"/g, '$1in');
             }

             // CSV regex
             values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/"/g, ''));
        }
        
        if (values.length < 3) continue; // Skip malformed lines

        // Date Parsing
        const dateRaw = colMap.date > -1 ? values[colMap.date] : '';
        const parsedDate = parseDate(dateRaw) || new Date();
        const dateStr = formatDate(parsedDate);
        
        // Skip summary rows (often missing ASIN or date)
        if ((!values[colMap.asin] || values[colMap.asin].length < 2) && !isCreatorConnections) continue;

        const parseNum = (idx: number) => {
            if (idx === -1) return 0;
            const val = values[idx]?.replace(/[$,%]/g, '');
            return parseFloat(val) || 0;
        }

        const asin = colMap.asin > -1 ? values[colMap.asin] : 'Unknown';
        const trackingId = colMap.tracking > -1 ? values[colMap.tracking] : 'creator-connections';
        const campaignTitle = colMap.campaignTitle > -1 ? values[colMap.campaignTitle] : undefined;

        // Determine Report Type
        let reportType: AmazonReportType = 'unknown';
        if (isCreatorConnections || campaignTitle) {
            reportType = 'creator_connections';
        } else if (trackingId.includes('onamz')) {
            reportType = 'onsite';
        } else {
            reportType = 'offsite';
        }

        const metric: AmazonMetric = {
            id: generateUUID(),
            date: dateStr,
            asin: asin,
            title: colMap.title > -1 ? values[colMap.title] : (campaignTitle || `Unknown Product (${asin})`),
            clicks: parseNum(colMap.clicks),
            orderedItems: parseNum(colMap.ordered),
            shippedItems: parseNum(colMap.shipped),
            revenue: parseNum(colMap.income),
            conversionRate: parseNum(colMap.conversion),
            trackingId: trackingId,
            category: colMap.category > -1 ? values[colMap.category] : undefined,
            reportType: reportType,
            campaignTitle: campaignTitle
        };

        metrics.push(metric);
    }

    onProgress(`Parsed ${metrics.length} amazon metrics.`);
    return metrics;
}

const parseCSV = (lines: string[], accountId: string, transactionTypes: TransactionType[], sourceName: string): RawTransaction[] => {
    const transactions: RawTransaction[] = [];
    if (lines.length === 0) return transactions;

    let headerIndex = -1;
    let colMap = { date: -1, description: -1, amount: -1, credit: -1, debit: -1, category: -1 };
    
    for(let i=0; i<Math.min(lines.length, 20); i++) {
        const lineLower = lines[i].toLowerCase();
        const parts = lineLower.split(/[,;\t]/).map(p => p.trim().replace(/"/g, ''));
        
        const dateIdx = parts.findIndex(p => p.includes('date') || p === 'dt');
        const descIdx = parts.findIndex(p => p.includes('description') || p.includes('merchant') || p.includes('payee') || p.includes('name') || p.includes('transaction'));
        const amtIdx = parts.findIndex(p => p === 'amount' || p.includes('amount'));
        const creditIdx = parts.findIndex(p => p.includes('credit') || p.includes('deposit'));
        const debitIdx = parts.findIndex(p => p.includes('debit') || p.includes('payment') || p.includes('withdraw'));
        const catIdx = parts.findIndex(p => p.includes('category'));

        if (dateIdx > -1 && (descIdx > -1 || amtIdx > -1 || (creditIdx > -1 && debitIdx > -1))) {
            headerIndex = i;
            colMap = { date: dateIdx, description: descIdx, amount: amtIdx, credit: creditIdx, debit: debitIdx, category: catIdx };
            break;
        }
    }

    if (headerIndex === -1) {
        return transactions;
    }

    const expenseType = transactionTypes.find(t => t.balanceEffect === 'expense') || transactionTypes[0];
    const incomeType = transactionTypes.find(t => t.balanceEffect === 'income') || transactionTypes[0];

    for(let i=headerIndex + 1; i<lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(p => p.trim().replace(/^"|"$/g, ''));
        
        if (parts.length < 2) continue;

        const dateStr = colMap.date > -1 ? parts[colMap.date] : '';
        const parsedDate = parseDate(dateStr);
        if (!parsedDate) continue;

        const description = colMap.description > -1 ? cleanDescription(parts[colMap.description]) : 'Unspecified';
        let amount = 0;
        let isIncome = false;

        if (colMap.credit > -1 && colMap.debit > -1) {
            // Handle Credit/Debit column format
            const creditStr = parts[colMap.credit] || '0';
            const debitStr = parts[colMap.debit] || '0';
            
            const creditVal = parseFloat(creditStr.replace(/[$,]/g, '') || '0');
            const debitVal = parseFloat(debitStr.replace(/[$,]/g, '') || '0');
            
            if (creditVal > 0) {
                amount = creditVal;
                isIncome = true;
            } else if (debitVal > 0) {
                amount = debitVal;
                isIncome = false;
            }
        } else if (colMap.amount > -1) {
            // Handle single Amount column
            const valStr = parts[colMap.amount].replace(/[$,\s]/g, '');
            const val = parseFloat(valStr);
            if (isNaN(val)) continue;
            
            if (val < 0) {
                amount = Math.abs(val);
                isIncome = false; 
            } else {
                amount = val;
                isIncome = true;
            }
        }

        if (amount === 0) continue;

        transactions.push({
            date: formatDate(parsedDate),
            description: toTitleCase(description),
            amount: amount,
            category: colMap.category > -1 ? parts[colMap.category] : 'Uncategorized',
            accountId: accountId,
            typeId: isIncome ? incomeType.id : expenseType.id,
            sourceFilename: sourceName
        });
    }

    return transactions;
};

export const parseTransactionsFromText = async (
    text: string, 
    accountId: string, 
    transactionTypes: TransactionType[], 
    onProgress: (msg: string) => void
): Promise<RawTransaction[]> => {
    onProgress('Parsing text...');
    const lines = text.split('\n');
    return parseCSV(lines, accountId, transactionTypes, 'Pasted Text');
};

export const parseTransactionsFromFiles = async (
    files: File[], 
    accountId: string, 
    transactionTypes: TransactionType[], 
    onProgress: (msg: string) => void
): Promise<RawTransaction[]> => {
    const allTransactions: RawTransaction[] = [];
    
    for (const file of files) {
        onProgress(`Reading ${file.name}...`);
        if (file.type === 'application/pdf') {
             console.warn("Local PDF parsing not fully implemented. Use AI mode for PDFs.");
             continue; 
        }
        
        const text = await readFileAsText(file);
        const lines = text.split('\n');
        const transactions = parseCSV(lines, accountId, transactionTypes, file.name);
        allTransactions.push(...transactions);
    }
    
    return allTransactions;
};
