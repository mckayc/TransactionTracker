


import type { RawTransaction, TransactionType, AmazonMetric, AmazonReportType, YouTubeMetric } from '../types';
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

    // Standard JS Date parsing for other formats (e.g. "Dec 31, 2024", "Apr 1, 2023")
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

const parseCSVLine = (line: string, delimiter = ','): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];
        
        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === delimiter && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
};

export const readStringAsCSV = (text: string): CsvData => {
    const lines = text.split('\n');
    
    // Updated keywords to detect YouTube as well
    const keywords = [
        'asin', 'date', 'product title', 'title', 'name', 
        'ordered items', 'shipped items', 'clicks', 'conversion',
        'revenue', 'earnings', 'fees', 'commission', 'bonus', 
        'tracking id', 'tag', 'category', 'video title', 'content', 
        'watch time', 'subscribers', 'impressions'
    ];

    let bestHeaderIndex = -1;
    let maxScore = 0;

    for(let i=0; i<Math.min(lines.length, 50); i++) {
        const line = lines[i].toLowerCase().trim();
        if (line.length === 0) continue;

        let score = 0;
        keywords.forEach(k => {
            if (line.includes(k)) score++;
        });

        if (score > maxScore && line.length < 1000) {
            maxScore = score;
            bestHeaderIndex = i;
        }
    }

    if (bestHeaderIndex === -1) {
        // Fallback checks
        if (lines.findIndex(l => l.toLowerCase().includes('asin')) > -1) {
             bestHeaderIndex = lines.findIndex(l => l.toLowerCase().includes('asin'));
        } else if (lines.findIndex(l => l.toLowerCase().includes('video title')) > -1) {
             bestHeaderIndex = lines.findIndex(l => l.toLowerCase().includes('video title'));
        }
    }
    if (bestHeaderIndex === -1) bestHeaderIndex = 0;

    const headerLine = lines[bestHeaderIndex];

    const tabParts = parseCSVLine(headerLine, '\t');
    const commaParts = parseCSVLine(headerLine, ',');
    
    let delimiter = ',';
    let headers = commaParts;

    if (tabParts.length > commaParts.length) {
        delimiter = '\t';
        headers = tabParts;
    } else if (tabParts.length === commaParts.length && tabParts.length > 1) {
        if (headerLine.includes('\t')) {
            delimiter = '\t';
            headers = tabParts;
        }
    }

    const rows: string[][] = [];
    for(let i = bestHeaderIndex + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const values = parseCSVLine(line, delimiter);
        
        if (values.length >= Math.max(1, headers.length - 2)) { 
            rows.push(values);
        }
    }

    return { headers, rows };
};

export const readCSVRaw = async (file: File): Promise<CsvData> => {
    const text = await readFileAsText(file);
    return readStringAsCSV(text);
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

export const autoMapAmazonColumns = (headers: string[]): ColumnMapping => {
    const h = headers.map(h => h.toLowerCase().trim());
    
    const find = (...search: string[]) => h.findIndex(hdr => search.some(s => hdr === s || hdr.includes(s)));
    const findExact = (...search: string[]) => h.findIndex(hdr => search.includes(hdr));

    return {
        date: findExact('date', 'date shipped'),
        asin: findExact('asin'),
        title: find('product title', 'title', 'item name', 'name'),
        clicks: find('clicks'),
        ordered: find('ordered items', 'items ordered'),
        shipped: find('shipped items', 'items shipped'),
        revenue: find('ad fees', 'advertising fees', 'commission income', 'earnings', 'bounties', 'amount'),
        tracking: find('tracking id'),
        category: find('category', 'product group'),
        campaignTitle: find('campaign title')
    };
};

export const processAmazonData = (
    data: CsvData, 
    mapping: ColumnMapping, 
    forcedSource: AmazonReportType | 'auto' = 'auto'
): AmazonMetric[] => {
    const metrics: AmazonMetric[] = [];

    data.rows.forEach(values => {
        const dateRaw = mapping.date > -1 ? values[mapping.date] : '';
        const parsedDate = parseDate(dateRaw);
        
        if (!parsedDate) return;

        const dateStr = formatDate(parsedDate);
        const asin = mapping.asin > -1 ? values[mapping.asin] : 'Unknown';
        
        if (!asin || asin.length < 2 || asin.toLowerCase().includes('total')) return;

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

        let reportType: AmazonReportType = 'unknown';
        
        if (forcedSource !== 'auto') {
            reportType = forcedSource;
        } else {
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
            title: title || campaignTitle || asin,
            clicks: parseNum(mapping.clicks),
            orderedItems: parseNum(mapping.ordered),
            shippedItems: parseNum(mapping.shipped),
            revenue: parseNum(mapping.revenue),
            conversionRate: 0,
            trackingId: trackingId,
            category: mapping.category && mapping.category > -1 ? values[mapping.category] : undefined,
            reportType: reportType,
            campaignTitle: campaignTitle
        };

        if (metric.clicks > 0) {
            metric.conversionRate = (metric.orderedItems / metric.clicks) * 100;
        }

        metrics.push(metric);
    });

    return metrics;
};

// --- YouTube Logic ---

export interface YouTubeMapping {
    content: number;
    title: number;
    date: number;
    duration: number;
    views: number;
    watchTime: number;
    subscribers: number;
    revenue: number;
    impressions: number;
    ctr: number;
}

export const autoMapYouTubeColumns = (headers: string[]): YouTubeMapping => {
    const h = headers.map(h => h.toLowerCase().trim());
    const find = (...search: string[]) => h.findIndex(hdr => search.some(s => hdr === s || hdr.includes(s)));

    return {
        content: find('content', 'video id', 'video'),
        title: find('video title', 'title'),
        date: find('video publish time', 'publish time', 'date'),
        duration: find('duration'),
        views: find('views'),
        watchTime: find('watch time'),
        subscribers: find('subscribers'),
        revenue: find('estimated revenue', 'revenue', 'your estimated revenue'),
        impressions: find('impressions'),
        ctr: find('impressions click-through rate', 'click-through rate', 'ctr')
    };
};

export const processYouTubeData = (data: CsvData, mapping: YouTubeMapping): YouTubeMetric[] => {
    const metrics: YouTubeMetric[] = [];

    data.rows.forEach(values => {
        // Validation: YouTube report often has a 'Total' row at top or bottom. We skip it.
        const contentId = mapping.content > -1 ? values[mapping.content] : '';
        if (!contentId || contentId.toLowerCase().includes('total')) return;

        const dateRaw = mapping.date > -1 ? values[mapping.date] : '';
        const parsedDate = parseDate(dateRaw);
        
        // If no date, we can't chart it properly, but might display it.
        // For dashboard purposes, we default to today if missing or keep it for the record.
        // However, YouTube 'Content' reports usually have the Publish Date.
        const dateStr = parsedDate ? formatDate(parsedDate) : '';

        const parseNum = (idx: number | undefined) => {
            if (idx === undefined || idx === -1) return 0;
            const valStr = values[idx];
            if (!valStr) return 0;
            const val = valStr.replace(/[$,%\s]/g, '');
            return parseFloat(val) || 0;
        }

        const metric: YouTubeMetric = {
            id: generateUUID(), // Unique ID for our system
            videoId: contentId,
            title: mapping.title > -1 ? values[mapping.title] : 'Unknown Video',
            publishDate: dateStr,
            duration: parseNum(mapping.duration),
            views: parseNum(mapping.views),
            watchTimeHours: parseNum(mapping.watchTime),
            subscribers: parseNum(mapping.subscribers),
            revenue: parseNum(mapping.revenue),
            impressions: parseNum(mapping.impressions),
            ctr: parseNum(mapping.ctr)
        };

        metrics.push(metric);
    });

    return metrics;
};

// Legacy exports
export const parseAmazonReport = async (file: File, onProgress: (msg: string) => void): Promise<AmazonMetric[]> => {
    onProgress('Reading CSV...');
    const rawData = await readCSVRaw(file);
    const mapping = autoMapAmazonColumns(rawData.headers);

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
        const delimiter = lineLower.includes('\t') && !lineLower.includes(',') ? '\t' : ',';
        const parts = parseCSVLine(lineLower, delimiter);
        
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

    const headerLine = lines[headerIndex];
    const delimiter = headerLine.includes('\t') && (headerLine.match(/\t/g) || []).length > (headerLine.match(/,/g) || []).length ? '\t' : ',';

    for(let i=headerIndex + 1; i<lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const parts = parseCSVLine(line, delimiter);
        
        if (parts.length < 2) continue;

        const dateStr = colMap.date > -1 ? parts[colMap.date] : '';
        const parsedDate = parseDate(dateStr);
        if (!parsedDate) continue;

        const description = colMap.description > -1 ? cleanDescription(parts[colMap.description]) : 'Unspecified';
        let amount = 0;
        let isIncome = false;

        if (colMap.credit > -1 && colMap.debit > -1) {
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