
import type { RawTransaction, TransactionType, AmazonMetric, AmazonReportType } from '../types';
import { generateUUID } from '../utils';

declare const pdfjsLib: any;

const cleanDescription = (string: string): string => {
  // Cleans up common noise from transaction descriptions for better readability.
  let cleaned = string.trim();
  cleaned = cleaned.replace(/\s+/g, ' ');
  cleaned = cleaned.replace(/^["']+|["']+$/g, '');
  cleaned = cleaned.replace(/[,.]+$/, '');
  cleaned = cleaned.replace(/^(Pos Debit|Debit Purchase|Recurring Payment|Preauthorized Debit|Checkcard|Visa Purchase) - /i, '');
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
    if (!dateStr || dateStr.length < 5) return null;

    // Sanitize: "2024-12-31 0:00:00" -> "2024-12-31"
    const cleanStr = dateStr.trim().split(/\s+|T/)[0];

    // Try YYYY-MM-DD
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(cleanStr)) {
        const date = new Date(cleanStr + 'T00:00:00'); 
        if (!isNaN(date.getTime())) return date;
    }
    
    // Try MM-DD-YYYY or MM-DD-YY
    if (/^\d{1,2}-\d{1,2}-\d{2,4}$/.test(cleanStr)) {
        const parts = cleanStr.split('-');
        let year = parseInt(parts[2], 10);
        if (year < 100) { 
            year += year < 70 ? 2000 : 1900;
        }
        const date = new Date(year, parseInt(parts[0], 10) - 1, parseInt(parts[1], 10));
        if (!isNaN(date.getTime())) return date;
    }

    // Try MM/DD/YY or MM/DD/YYYY
    if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(cleanStr)) {
        const parts = cleanStr.split('/');
        let year = parseInt(parts[2], 10);
        if (year < 100) { 
            year += year < 70 ? 2000 : 1900;
        }
        const date = new Date(year, parseInt(parts[0], 10) - 1, parseInt(parts[1], 10));
        if (!isNaN(date.getTime())) return date;
    }

    // Standard JS Date parsing for other formats (e.g. "Dec 31, 2024")
    const hasDateStructure = /[a-zA-Z]{3,}\s+\d{1,2},?\s+\d{4}/.test(dateStr) || /\d{1,2}\s+[a-zA-Z]{3,}\s+\d{4}/.test(dateStr);
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

export interface CsvData {
    headers: string[];
    rows: string[][];
}

export const readCSVRaw = async (file: File): Promise<CsvData> => {
    const text = await readFileAsText(file);
    const lines = text.split('\n');
    
    let headerIndex = -1;
    let headers: string[] = [];
    const rows: string[][] = [];

    // Heuristic: Find the header row (contains ASIN, Date, or similar)
    for(let i=0; i<Math.min(lines.length, 25); i++) {
        const line = lines[i].toLowerCase();
        if (line.includes('asin') || (line.includes('date') && (line.includes('commission') || line.includes('earnings') || line.includes('fees')))) {
            headerIndex = i;
            break;
        }
    }

    if (headerIndex === -1) {
        // Fallback: Assume first non-empty line is header
        headerIndex = lines.findIndex(l => l.trim().length > 0);
    }

    if (headerIndex === -1) return { headers: [], rows: [] };

    // Helper to split CSV line handling quotes
    const splitLine = (line: string) => {
        if (line.includes('\t')) return line.split('\t').map(v => v.trim().replace(/^"|"$/g, ''));
        return line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/^"|"$/g, ''));
    };

    headers = splitLine(lines[headerIndex]);

    for(let i = headerIndex + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const values = splitLine(line);
        // Basic consistency check
        if (values.length > 1) { 
            rows.push(values);
        }
    }

    return { headers, rows };
}

export interface ColumnMapping {
    date: number;
    asin: number;
    title: number;
    revenue: number;
    clicks?: number;
    ordered?: number;
    shipped?: number;
    tracking?: number;
    category?: number;
    campaignTitle?: number;
}

export const processAmazonData = (
    data: CsvData, 
    mapping: ColumnMapping, 
    forcedSource: AmazonReportType | 'auto' = 'auto'
): AmazonMetric[] => {
    const metrics: AmazonMetric[] = [];

    data.rows.forEach(values => {
        const dateRaw = mapping.date > -1 ? values[mapping.date] : '';
        const parsedDate = parseDate(dateRaw);
        
        // Skip invalid rows (summaries/footers often have empty dates)
        if (!parsedDate) return;

        const dateStr = formatDate(parsedDate);
        const asin = mapping.asin > -1 ? values[mapping.asin] : 'Unknown';
        
        if (!asin || asin.length < 5) return; // Skip invalid ASIN rows

        const parseNum = (idx: number | undefined) => {
            if (idx === undefined || idx === -1) return 0;
            const valStr = values[idx];
            if (!valStr) return 0;
            const val = valStr.replace(/[$,%\s]/g, '');
            if (val.startsWith('(') && val.endsWith(')')) {
                return -1 * parseFloat(val.replace(/[()]/g, ''));
            }
            return parseFloat(val) || 0;
        }

        const title = mapping.title > -1 ? values[mapping.title] : `Product ${asin}`;
        const trackingId = mapping.tracking && mapping.tracking > -1 ? values[mapping.tracking] : 'default';
        const campaignTitle = mapping.campaignTitle && mapping.campaignTitle > -1 ? values[mapping.campaignTitle] : undefined;

        // Determine Report Type
        let reportType: AmazonReportType = 'unknown';
        
        if (forcedSource !== 'auto') {
            reportType = forcedSource;
        } else {
            // Auto-detect logic
            if (campaignTitle) {
                reportType = 'creator_connections';
            } else if (trackingId.includes('onamz')) {
                reportType = 'onsite';
            } else {
                reportType = 'offsite';
            }
        }

        const metric: AmazonMetric = {
            id: generateUUID(),
            date: dateStr,
            asin: asin,
            title: title || campaignTitle || asin, // Fallback logic
            clicks: parseNum(mapping.clicks),
            orderedItems: parseNum(mapping.ordered),
            shippedItems: parseNum(mapping.shipped),
            revenue: parseNum(mapping.revenue),
            conversionRate: 0, // Calculated field if needed
            trackingId: trackingId,
            category: mapping.category && mapping.category > -1 ? values[mapping.category] : undefined,
            reportType: reportType,
            campaignTitle: campaignTitle
        };

        // Recalculate conversion if not mapped directly
        if (metric.clicks > 0) {
            metric.conversionRate = (metric.orderedItems / metric.clicks) * 100;
        }

        metrics.push(metric);
    });

    return metrics;
};

// Legacy support for direct parsing (still used by Drag-and-Drop if we bypass wizard, but ideally we route through wizard)
export const parseAmazonReport = async (file: File, onProgress: (msg: string) => void): Promise<AmazonMetric[]> => {
    onProgress('Reading CSV...');
    const rawData = await readCSVRaw(file);
    
    // Auto-map based on headers
    const h = rawData.headers.map(h => h.toLowerCase());
    
    // Helper to find index
    const find = (...search: string[]) => h.findIndex(hdr => search.some(s => hdr === s || hdr.includes(s)));
    const findExact = (...search: string[]) => h.findIndex(hdr => search.includes(hdr));

    const mapping: ColumnMapping = {
        date: findExact('date', 'date shipped'),
        asin: findExact('asin'),
        title: find('product title', 'title', 'item name'),
        clicks: find('clicks'),
        ordered: find('ordered items', 'items ordered'),
        shipped: find('shipped items', 'items shipped'),
        revenue: find('ad fees', 'advertising fees', 'commission income', 'earnings'),
        tracking: find('tracking id'),
        category: find('category', 'product group'),
        campaignTitle: find('campaign title')
    };

    if (mapping.asin === -1) throw new Error("Could not find ASIN column.");
    
    return processAmazonData(rawData, mapping, 'auto');
};

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
            // IMPORTANT: Remove commas here too for general CSVs
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
