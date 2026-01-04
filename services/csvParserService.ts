
import type { RawTransaction, TransactionType, AmazonMetric, YouTubeMetric, AmazonReportType, AmazonVideo, AmazonCCType } from '../types';
import { generateUUID } from '../utils';
import * as XLSX from 'xlsx';

declare const pdfjsLib: any;

const cleanDescription = (string: string): string => {
  // Cleans up common noise from transaction descriptions for better readability.
  let cleaned = string.trim();
  cleaned = cleaned.replace(/\s+/g, ' ');
  cleaned = cleaned.replace(/^["']+|["']+$/g, '');
  cleaned = cleaned.replace(/[,.]+$/, '');
  
  // Strip common bank prefix noises that clutter the UI
  cleaned = cleaned.replace(/^(Pos Debit|Debit Purchase|Recurring Payment|Preauthorized Debit|Checkcard|Visa Purchase|ACH Withdrawal|ACH Deposit From|ACH Deposit|ACH Transfer|ACH-Withdrawal|ACH-Deposit|Transfer From|Transfer To|Payment Thank You - Web|Payment Thank You)[\s-]*\s*/i, '');
  
  // Strip merchant ID garbage if detected (common in Amazon/CC exports)
  cleaned = cleaned.replace(/\*[A-Z0-9]{9,}$/i, ''); // Strip trailing Amazon ID like *8T2PH2CU3
  cleaned = cleaned.replace(/PAYMENTS ID NBR:.*$/i, '');
  cleaned = cleaned.replace(/ID NBR:.*$/i, '');
  cleaned = cleaned.replace(/EDI PYMNTS.*$/i, '');
  cleaned = cleaned.replace(/ACH ITEMS.*$/i, '');
  
  return cleaned.trim();
};

const toTitleCase = (str: string): string => {
    if (!str) return '';
    // Special case for Amazon and common abbreviations
    if (str.toUpperCase().startsWith('AMAZON')) return str;
    
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

const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
};

const parseDate = (dateStr: string): Date | null => {
    if (!dateStr || dateStr.length < 5) return null;

    // Remove quotes if present
    const cleanedDateStr = dateStr.replace(/^"|"$/g, '').trim();

    // Try YYYY-MM-DD
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(cleanedDateStr)) {
        const date = new Date(cleanedDateStr + 'T00:00:00'); 
        if (!isNaN(date.getTime())) return date;
    }
    
    // Try MM-DD-YYYY or MM-DD-YY
    if (/^\d{1,2}-\d{1,2}-\d{2,4}$/.test(cleanedDateStr)) {
        const parts = cleanedDateStr.split('-');
        let year = parseInt(parts[2], 10);
        if (year < 100) { 
            year += year < 70 ? 2000 : 1900;
        }
        const date = new Date(year, parseInt(parts[0], 10) - 1, parseInt(parts[1], 10));
        if (!isNaN(date.getTime())) return date;
    }

    // Try MM/DD/YY or MM/DD/YYYY
    if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(cleanedDateStr)) {
        const parts = cleanedDateStr.split('/');
        let year = parseInt(parts[2], 10);
        if (year < 100) { 
            year += year < 70 ? 2000 : 1900;
        }
        const date = new Date(year, parseInt(parts[0], 10) - 1, parseInt(parts[1], 10));
        if (!isNaN(date.getTime())) return date;
    }

    // Fallback for textual dates like "Apr 1, 2023" or "Nov 6, 2025"
    const date = new Date(cleanedDateStr);
    if (!isNaN(date.getTime()) && date.getFullYear() > 1990 && date.getFullYear() < 2050) return date;
    
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
    let text = '';
    
    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const buffer = await readFileAsArrayBuffer(file);
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        text = XLSX.utils.sheet_to_csv(worksheet);
    } else {
        text = await readFileAsText(file);
    }

    const lines = text.split('\n');
    const metrics: AmazonMetric[] = [];

    if (lines.length < 2) return [];

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

    for (let i = headerIndex + 1; i < lines.length; i++) {
        let line = lines[i].trim();
        if (!line) continue;

        let values: string[] = [];
        if (line.includes('\t')) {
             values = line.split('\t').map(v => v.trim().replace(/"/g, ''));
        } else {
             const quoteCount = (line.match(/"/g) || []).length;
             if (quoteCount % 2 !== 0) {
                 line = line.replace(/(\d)"/g, '$1in');
             }
             values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/"/g, ''));
        }
        
        if (values.length < 3) continue;

        const dateRaw = colMap.date > -1 ? values[colMap.date] : '';
        const parsedDate = parseDate(dateRaw) || new Date();
        const saleDate = formatDate(parsedDate);
        
        if ((!values[colMap.asin] || values[colMap.asin].length < 2) && !isCreatorConnections) continue;

        const parseNum = (idx: number) => {
            if (idx === -1) return 0;
            const val = values[idx]?.replace(/[$,%]/g, '');
            return parseFloat(val) || 0;
        }

        const asin = colMap.asin > -1 ? values[colMap.asin] : 'Unknown';
        const trackingId = colMap.tracking > -1 ? values[colMap.tracking] : '';
        const campaignTitle = colMap.campaignTitle > -1 ? values[colMap.campaignTitle] : undefined;

        let reportType: AmazonReportType = 'unknown';
        let ccType: AmazonCCType | undefined = undefined;

        if (isCreatorConnections || campaignTitle) {
            reportType = 'creator_connections';
            if (trackingId.includes('onamz')) ccType = 'onsite';
            else if (trackingId.length > 2) ccType = 'offsite';
        } else if (trackingId.includes('onamz')) {
            reportType = 'onsite';
        } else {
            reportType = 'offsite';
        }

        const productTitle = colMap.title > -1 ? values[colMap.title] : (campaignTitle || `Unknown Product (${asin})`);

        metrics.push({
            id: generateUUID(),
            saleDate: saleDate,
            asin: asin,
            productTitle: productTitle,
            ccTitle: campaignTitle,
            clicks: parseNum(colMap.clicks),
            orderedItems: parseNum(colMap.ordered),
            shippedItems: parseNum(colMap.shipped),
            revenue: parseNum(colMap.income),
            conversionRate: parseNum(colMap.conversion),
            trackingId: trackingId || 'default',
            category: colMap.category > -1 ? values[colMap.category] : undefined,
            reportType: reportType,
            creatorConnectionsType: ccType
        });
    }

    onProgress(`Parsed ${metrics.length} amazon metrics.`);
    return metrics;
}

export const parseAmazonVideos = async (file: File, onProgress: (msg: string) => void): Promise<AmazonVideo[]> => {
    onProgress(`Reading ${file.name}...`);
    let text = '';
    
    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const buffer = await readFileAsArrayBuffer(file);
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        text = XLSX.utils.sheet_to_csv(worksheet);
    } else {
        text = await readFileAsText(file);
    }

    const lines = text.split('\n');
    const videos: AmazonVideo[] = [];

    if (lines.length < 2) return [];

    let headerIndex = -1;
    for (let i = 0; i < Math.min(lines.length, 20); i++) {
        const lower = lines[i].toLowerCase();
        if (lower.includes('title') && (lower.includes('asin') || lower.includes('duration') || lower.includes('video_url'))) {
            headerIndex = i;
            break;
        }
    }

    if (headerIndex === -1) {
        throw new Error("Invalid format. Could not find header with 'Title' and either 'ASINs' or 'Duration'.");
    }

    const splitLine = (line: string) => {
        if (line.includes('\t')) return line.split('\t').map(v => v.trim().replace(/^"|"$/g, ''));
        return line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/^"|"$/g, ''));
    };

    const header = splitLine(lines[headerIndex]).map(h => h.toLowerCase().replace(/ /g, '_'));
    
    const colMap = {
        title: header.findIndex(h => h === 'title'),
        asins: header.findIndex(h => h === 'asins' || h === 'asin'),
        duration: header.findIndex(h => h === 'duration'),
        url: header.findIndex(h => h === 'video_url' || h === 'url'),
        date: header.findIndex(h => h === 'upload_date' || h === 'date')
    };

    if (colMap.title === -1) throw new Error("Missing 'Title' column.");

    for (let i = headerIndex + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = splitLine(line);
        if (values.length <= colMap.title) continue;

        const asinsRaw = colMap.asins > -1 ? values[colMap.asins] : '';
        const asins = asinsRaw ? Array.from(new Set(asinsRaw.split('|').map(a => a.trim()).filter(Boolean))) : [];

        const dateRaw = colMap.date > -1 ? values[colMap.date] : '';
        const parsedDate = parseDate(dateRaw);

        videos.push({
            id: generateUUID(),
            asins: asins.length > 0 ? asins : undefined,
            videoId: generateUUID().slice(0, 8),
            videoTitle: values[colMap.title] || 'Unknown Video',
            duration: colMap.duration > -1 ? values[colMap.duration] : undefined,
            videoUrl: colMap.url > -1 ? values[colMap.url] : undefined,
            uploadDate: parsedDate ? formatDate(parsedDate) : undefined
        });
    }

    onProgress(`Parsed ${videos.length} video records.`);
    return videos;
};

export const parseYouTubeReport = async (file: File, onProgress: (msg: string) => void): Promise<YouTubeMetric[]> => {
    onProgress(`Reading ${file.name}...`);
    let text = '';
    
    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const buffer = await readFileAsArrayBuffer(file);
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        text = XLSX.utils.sheet_to_csv(worksheet);
    } else {
        text = await readFileAsText(file);
    }

    const lines = text.split('\n');
    const metrics: YouTubeMetric[] = [];

    if (lines.length < 2) return [];

    let headerIndex = -1;
    for (let i = 0; i < Math.min(lines.length, 20); i++) {
        const lower = lines[i].toLowerCase();
        if ((lower.includes('video title') && lower.includes('video publish time')) || (lower.includes('content') && lower.includes('views'))) {
            headerIndex = i;
            break;
        }
    }

    if (headerIndex === -1) {
        throw new Error("Invalid YouTube Report format. Could not find header row.");
    }

    const headerLine = lines[headerIndex];
    const separator = headerLine.includes('\t') ? '\t' : ',';
    
    const splitLine = (line: string) => {
        if (separator === '\t') return line.split('\t').map(v => v.trim().replace(/^"|"$/g, ''));
        return line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/^"|"$/g, ''));
    };

    const header = splitLine(headerLine).map(h => h.toLowerCase());

    const colMap = {
        content: header.findIndex(h => h === 'content' || h === 'video id'),
        title: header.findIndex(h => h === 'video title'),
        publishTime: header.findIndex(h => h === 'video publish time' || h === 'publish date'),
        views: header.findIndex(h => h === 'views'),
        watchTime: header.findIndex(h => h.includes('watch time')),
        subscribers: header.findIndex(h => h === 'subscribers'),
        revenue: header.findIndex(h => h.includes('estimated revenue') || h.includes('revenue') || h.includes('your estimated revenue')),
        impressions: header.findIndex(h => h === 'impressions'),
        ctr: header.findIndex(h => h.includes('click-through rate'))
    };

    if (colMap.title === -1 || colMap.views === -1) {
        throw new Error("Missing critical columns (Video title or Views).");
    }

    for (let i = headerIndex + 1; i < lines.length; i++) {
        let line = lines[i].trim();
        if (!line) continue;

        let values = splitLine(line);
        if (values[0]?.toLowerCase() === 'total') continue;
        if (values.length <= colMap.title) continue;

        const parseNum = (idx: number) => {
            if (idx === -1) return 0;
            const val = values[idx]?.replace(/[$,%]/g, '');
            const parsed = parseFloat(val);
            return isNaN(parsed) ? 0 : parsed;
        }

        const dateRaw = colMap.publishTime > -1 ? values[colMap.publishTime] : '';
        const parsedDate = parseDate(dateRaw);
        if (!parsedDate) continue; 
        
        metrics.push({
            id: generateUUID(),
            videoId: colMap.content > -1 ? values[colMap.content] : 'unknown',
            videoTitle: values[colMap.title] || 'Unknown Video',
            publishDate: formatDate(parsedDate),
            views: parseNum(colMap.views),
            watchTimeHours: parseNum(colMap.watchTime),
            subscribersGained: parseNum(colMap.subscribers),
            estimatedRevenue: parseNum(colMap.revenue),
            impressions: parseNum(colMap.impressions),
            ctr: parseNum(colMap.ctr)
        });
    }

    onProgress(`Parsed ${metrics.length} videos.`);
    return metrics;
};

const parseCSV_Tx = (lines: string[], accountId: string, transactionTypes: TransactionType[], sourceName: string): RawTransaction[] => {
    const transactions: RawTransaction[] = [];
    if (lines.length === 0) return transactions;

    let headerIndex = -1;
    let rawHeaders: string[] = [];
    
    // Determine delimiter (Tab or Comma)
    const delimiter = lines[0].includes('\t') ? '\t' : ',';

    // Find the header row
    for(let i=0; i<Math.min(lines.length, 20); i++) {
        const lineLower = lines[i].toLowerCase();
        const parts = lineLower.split(delimiter).map(p => p.trim().replace(/"/g, ''));
        
        const dateIdx = parts.findIndex(p => p.includes('date') || p === 'dt' || p === 'date of income');
        
        /**
         * REFINED DESCRIPTION DETECTION
         * Problem: Many banks use "Transaction Date". 
         * Fix: Avoid matching a column that contains "date" as a description column.
         */
        const descIdx = parts.findIndex(p => 
            (p.includes('description') || p.includes('merchant') || p.includes('payee') || p.includes('name') || p.includes('transaction') || p === 'income source' || p === 'reference')
            && !p.includes('date') && !p.includes('type')
        );

        const amtIdx = parts.findIndex(p => p === 'amount' || p.includes('amount') || p === 'income amount');
        const debitIdx = parts.findIndex(p => p.includes('debit') || p.includes('payment') || p.includes('withdraw') || p.includes('spend'));
        const creditIdx = parts.findIndex(p => p.includes('credit') || p.includes('deposit') || p.includes('receive'));
        
        if (dateIdx > -1 && (descIdx > -1 || amtIdx > -1 || (debitIdx > -1 && creditIdx > -1))) {
            headerIndex = i;
            rawHeaders = lines[i].split(delimiter).map(h => h.trim().replace(/"/g, ''));
            break;
        }
    }

    if (headerIndex === -1) return transactions;

    const lowerHeaders = rawHeaders.map(h => h.toLowerCase());
    const colMap = { 
        date: lowerHeaders.findIndex(p => p.includes('date') || p === 'dt' || p === 'date of income'), 
        description: lowerHeaders.findIndex(p => 
            (p.includes('description') || p.includes('merchant') || p.includes('payee') || p.includes('name') || p.includes('transaction') || p === 'income source')
            && !p.includes('date') && !p.includes('type')
        ), 
        reference: lowerHeaders.findIndex(p => p.includes('reference') || p.includes('memo') || p.includes('notes')),
        payee: lowerHeaders.findIndex(p => p === 'payee' || p === 'income source'),
        amount: lowerHeaders.findIndex(p => p === 'amount' || p.includes('amount') || p === 'income amount'), 
        credit: lowerHeaders.findIndex(p => p.includes('credit') || p.includes('deposit') || p.includes('receive')), 
        debit: lowerHeaders.findIndex(p => p.includes('debit') || p.includes('payment') || p.includes('withdraw') || p.includes('spend')), 
        category: lowerHeaders.findIndex(p => p.includes('category') || (p.includes('type') && !p.includes('transaction'))),
        transactionType: lowerHeaders.findIndex(p => p === 'transaction type')
    };

    const expenseType = transactionTypes.find(t => t.balanceEffect === 'expense') || transactionTypes[0];
    const incomeType = transactionTypes.find(t => t.balanceEffect === 'income') || transactionTypes[0];

    for(let i=headerIndex + 1; i<lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        let parts: string[] = [];
        if (delimiter === '\t') {
            parts = line.split('\t').map(p => p.trim().replace(/^"|"$/g, ''));
        } else {
            parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(p => p.trim().replace(/^"|"$/g, ''));
        }
        
        if (parts.length < 2) continue;

        const dateStr = colMap.date > -1 ? parts[colMap.date] : '';
        const parsedDate = parseDate(dateStr);
        if (!parsedDate) continue;

        // Build Metadata for all columns
        const metadata: Record<string, string> = {};
        rawHeaders.forEach((header, idx) => {
            if (parts[idx] !== undefined) {
                metadata[header] = parts[idx];
            }
        });

        // Determine Description with fallbacks
        let description = 'Unspecified';
        if (colMap.description > -1 && parts[colMap.description]) {
            description = parts[colMap.description];
        } else if (colMap.reference > -1 && parts[colMap.reference]) {
            description = parts[colMap.reference];
        } else if (colMap.payee > -1 && parts[colMap.payee]) {
            description = parts[colMap.payee];
        }
        
        description = cleanDescription(description);

        let amount = 0;
        let isIncome = false;

        if (colMap.credit > -1 && colMap.debit > -1) {
            const creditVal = parseFloat((parts[colMap.credit] || '0').replace(/[$,\s]/g, '') || '0');
            const debitVal = parseFloat((parts[colMap.debit] || '0').replace(/[$,\s]/g, '') || '0');
            if (Math.abs(creditVal) > 0) { amount = Math.abs(creditVal); isIncome = true; }
            else if (Math.abs(debitVal) > 0) { amount = Math.abs(debitVal); isIncome = false; }
        } else if (colMap.amount > -1) {
            const valStr = (parts[colMap.amount] || '0').replace(/[$,\s]/g, '');
            const val = parseFloat(valStr);
            if (isNaN(val)) continue;
            if (val < 0) { amount = Math.abs(val); isIncome = false; }
            else { amount = val; isIncome = true; }
        }

        if (amount === 0) continue;
        const rawType = colMap.transactionType > -1 ? parts[colMap.transactionType] : '';

        transactions.push({
            date: formatDate(parsedDate),
            description: toTitleCase(description),
            amount: amount,
            categoryId: '', 
            category: rawType || (colMap.category > -1 ? parts[colMap.category] : 'Uncategorized'),
            accountId: accountId,
            typeId: isIncome ? incomeType.id : expenseType.id,
            sourceFilename: sourceName,
            metadata // Inject the raw source data for future rules
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
    return parseCSV_Tx(lines, accountId, transactionTypes, 'Pasted Text');
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
        
        // Handle Excel specifically
        if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
            const buffer = await readFileAsArrayBuffer(file);
            const workbook = XLSX.read(buffer, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const csvText = XLSX.utils.sheet_to_csv(worksheet);
            const lines = csvText.split('\n');
            const transactions = parseCSV_Tx(lines, accountId, transactionTypes, file.name);
            allTransactions.push(...transactions);
            continue;
        }

        if (file.type === 'application/pdf') continue; 
        const text = await readFileAsText(file);
        const lines = text.split('\n');
        const transactions = parseCSV_Tx(lines, accountId, transactionTypes, file.name);
        allTransactions.push(...transactions);
    }
    return allTransactions;
};
