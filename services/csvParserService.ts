import type { RawTransaction, TransactionType, AmazonMetric, YouTubeMetric, AmazonReportType, AmazonVideo, AmazonCCType } from '../types';
import { generateUUID } from '../utils';
import * as XLSX from 'xlsx';

declare const pdfjsLib: any;

const cleanDescription = (string: string): string => {
  let cleaned = string.trim();
  cleaned = cleaned.replace(/\s+/g, ' ');
  cleaned = cleaned.replace(/^["']+|["']+$/g, '');
  cleaned = cleaned.replace(/[,.]+$/, '');
  cleaned = cleaned.replace(/^(Pos Debit|Debit Purchase|Recurring Payment|Preauthorized Debit|Checkcard|Visa Purchase|ACH Withdrawal|ACH Deposit From|ACH Deposit|ACH Transfer|ACH-Withdrawal|ACH-Deposit|Transfer From|Transfer To|Payment Thank You - Web|Payment Thank You)[\s-]*\s*/i, '');
  cleaned = cleaned.replace(/\*[A-Z0-9]{9,}$/i, ''); 
  return cleaned.trim();
};

const toTitleCase = (str: string): string => {
    if (!str) return '';
    if (str.toUpperCase().startsWith('AMAZON')) return str;
    return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());
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
    const cleanedDateStr = dateStr.replace(/^"|"$/g, '').trim();
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(cleanedDateStr)) {
        const date = new Date(cleanedDateStr + 'T00:00:00'); 
        if (!isNaN(date.getTime())) return date;
    }
    if (/^\d{1,2}-\d{1,2}-\d{2,4}$/.test(cleanedDateStr)) {
        const parts = cleanedDateStr.split('-');
        let year = parseInt(parts[2], 10);
        if (year < 100) year += year < 70 ? 2000 : 1900;
        const date = new Date(year, parseInt(parts[0], 10) - 1, parseInt(parts[1], 10));
        if (!isNaN(date.getTime())) return date;
    }
    if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(cleanedDateStr)) {
        const parts = cleanedDateStr.split('/');
        let year = parseInt(parts[2], 10);
        if (year < 100) year += year < 70 ? 2000 : 1900;
        const date = new Date(year, parseInt(parts[0], 10) - 1, parseInt(parts[1], 10));
        if (!isNaN(date.getTime())) return date;
    }
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
        text = XLSX.utils.sheet_to_csv(workbook.Sheets[workbook.SheetNames[0]]);
    } else {
        text = await readFileAsText(file);
    }
    const lines = text.split('\n');
    const metrics: AmazonMetric[] = [];
    if (lines.length < 2) return [];
    let headerIndex = -1;
    for (let i = 0; i < Math.min(lines.length, 10); i++) {
        if (lines[i].toLowerCase().includes('tracking id') && lines[i].toLowerCase().includes('asin')) { headerIndex = i; break; }
    }
    if (headerIndex === -1) throw new Error("Invalid Amazon Report format.");
    const header = lines[headerIndex].split(/[,;\t]/).map(h => h.trim().replace(/"/g, '').toLowerCase());
    const colMap = { date: header.findIndex(h => h === 'date'), asin: header.findIndex(h => h === 'asin'), title: header.findIndex(h => h === 'product title' || h === 'title'), clicks: header.findIndex(h => h === 'clicks'), ordered: header.findIndex(h => h === 'ordered items'), shipped: header.findIndex(h => h === 'shipped items'), revenue: header.findIndex(h => h.includes('earnings') || h.includes('ad fees')), conversion: header.findIndex(h => h.includes('conversion')), tracking: header.findIndex(h => h.includes('tracking id')), category: header.findIndex(h => h === 'category') };
    for (let i = headerIndex + 1; i < lines.length; i++) {
        let line = lines[i].trim();
        if (!line) continue;
        const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/"/g, ''));
        if (values.length < 3) continue;
        const parseNum = (idx: number) => idx === -1 ? 0 : parseFloat(values[idx]?.replace(/[$,%]/g, '')) || 0;
        metrics.push({
            id: generateUUID(),
            saleDate: formatDate(parseDate(values[colMap.date]) || new Date()),
            asin: values[colMap.asin] || 'Unknown',
            productTitle: values[colMap.title] || 'Unknown Product',
            clicks: parseNum(colMap.clicks),
            orderedItems: parseNum(colMap.ordered),
            shippedItems: parseNum(colMap.shipped),
            revenue: parseNum(colMap.revenue),
            conversionRate: parseNum(colMap.conversion),
            trackingId: values[colMap.tracking] || 'default',
            category: colMap.category > -1 ? values[colMap.category] : undefined,
            reportType: values[colMap.tracking]?.includes('onamz') ? 'onsite' : 'offsite'
        });
    }
    return metrics;
}

export const parseAmazonVideos = async (file: File, onProgress: (msg: string) => void): Promise<AmazonVideo[]> => {
    onProgress(`Reading ${file.name}...`);
    let text = await (file.name.match(/\.xlsx?$/) ? readFileAsArrayBuffer(file).then(b => XLSX.utils.sheet_to_csv(XLSX.read(b, {type:'array'}).Sheets[XLSX.read(b, {type:'array'}).SheetNames[0]])) : readFileAsText(file));
    const lines = text.split('\n');
    const videos: AmazonVideo[] = [];
    let headerIndex = lines.findIndex(l => l.toLowerCase().includes('title') && (l.toLowerCase().includes('asin') || l.toLowerCase().includes('duration')));
    if (headerIndex === -1) throw new Error("Invalid format.");
    const header = lines[headerIndex].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(h => h.trim().toLowerCase().replace(/ /g, '_'));
    const colMap = { title: header.indexOf('title'), asins: header.findIndex(h => h === 'asins' || h === 'asin'), duration: header.indexOf('duration'), url: header.findIndex(h => h === 'video_url' || h === 'url'), date: header.findIndex(h => h === 'upload_date' || h === 'date') };
    for (let i = headerIndex + 1; i < lines.length; i++) {
        const values = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/^"|"$/g, ''));
        if (values.length <= colMap.title) continue;
        videos.push({
            id: generateUUID(),
            asins: colMap.asins > -1 ? values[colMap.asins].split('|').map(a => a.trim()).filter(Boolean) : [],
            videoId: generateUUID().slice(0, 8),
            videoTitle: values[colMap.title] || 'Unknown Video',
            duration: colMap.duration > -1 ? values[colMap.duration] : undefined,
            videoUrl: colMap.url > -1 ? values[colMap.url] : undefined,
            uploadDate: colMap.date > -1 ? formatDate(parseDate(values[colMap.date]) || new Date()) : undefined
        });
    }
    return videos;
};

export const parseYouTubeReport = async (file: File, onProgress: (msg: string) => void): Promise<YouTubeMetric[]> => {
    onProgress(`Reading ${file.name}...`);
    let text = await (file.name.match(/\.xlsx?$/) ? readFileAsArrayBuffer(file).then(b => XLSX.utils.sheet_to_csv(XLSX.read(b, {type:'array'}).Sheets[XLSX.read(b, {type:'array'}).SheetNames[0]])) : readFileAsText(file));
    const lines = text.split('\n');
    let headerIndex = lines.findIndex(l => l.toLowerCase().includes('video title') || l.toLowerCase().includes('content'));
    if (headerIndex === -1) throw new Error("Invalid format.");
    const header = lines[headerIndex].split(/[,;\t]/).map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
    const colMap = { content: header.findIndex(h => h === 'content' || h === 'video id'), title: header.indexOf('video title'), date: header.findIndex(h => h.includes('publish')), views: header.indexOf('views'), rev: header.findIndex(h => h.includes('revenue')) };
    return lines.slice(headerIndex + 1).map(l => {
        const v = l.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(s => s.trim().replace(/^"|"$/g, ''));
        if (v.length <= colMap.title) return null;
        return {
            id: generateUUID(),
            videoId: colMap.content > -1 ? v[colMap.content] : 'unknown',
            videoTitle: v[colMap.title],
            publishDate: formatDate(parseDate(v[colMap.date]) || new Date()),
            views: parseFloat(v[colMap.views]) || 0,
            estimatedRevenue: parseFloat(v[colMap.rev]?.replace(/[$,%]/g, '')) || 0,
            watchTimeHours: 0, subscribersGained: 0, impressions: 0, ctr: 0
        };
    }).filter(Boolean) as YouTubeMetric[];
};

const parseCSV_Tx = (lines: string[], accountId: string, transactionTypes: TransactionType[], sourceName: string): RawTransaction[] => {
    const transactions: RawTransaction[] = [];
    const delimiter = lines[0].includes('\t') ? '\t' : ',';
    let headerIndex = -1;
    let rawHeaders: string[] = [];
    for(let i=0; i<Math.min(lines.length, 20); i++) {
        const parts = lines[i].toLowerCase().split(delimiter).map(p => p.trim().replace(/"/g, ''));
        if (parts.some(p => p.includes('date')) && (parts.some(p => p.includes('desc') || p.includes('name')) || parts.some(p => p.includes('amount')))) {
            headerIndex = i;
            rawHeaders = parts;
            break;
        }
    }
    if (headerIndex === -1) return transactions;
    const colMap = { date: rawHeaders.findIndex(p => p.includes('date')), description: rawHeaders.findIndex(h => (h.includes('desc') || h.includes('name') || h.includes('merchant')) && !h.includes('date')), amount: rawHeaders.findIndex(p => p.includes('amount')), credit: rawHeaders.findIndex(p => p.includes('credit') || p.includes('dep')), debit: rawHeaders.findIndex(p => p.includes('debit') || p.includes('pay') || p.includes('withdraw')) };
    const INTERESTING_METADATA_KEYS = ['merchant category code', 'mcc', 'sic', 'transaction type', 'status', 'reference'];
    for(let i=headerIndex + 1; i<lines.length; i++) {
        const parts = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(p => p.trim().replace(/^"|"$/g, ''));
        if (parts.length < 2) continue;
        const parsedDate = parseDate(parts[colMap.date]);
        if (!parsedDate) continue;
        const metadata: Record<string, string> = {};
        rawHeaders.forEach((h, idx) => { if (INTERESTING_METADATA_KEYS.some(k => h.includes(k)) && parts[idx]) metadata[h] = parts[idx]; });
        let amount = 0, isIncome = false;
        if (colMap.credit > -1 && colMap.debit > -1) {
            const c = parseFloat(parts[colMap.credit]?.replace(/[$,\s]/g, '') || '0');
            const d = parseFloat(parts[colMap.debit]?.replace(/[$,\s]/g, '') || '0');
            if (c > 0) { amount = c; isIncome = true; } else { amount = Math.abs(d); isIncome = false; }
        } else {
            const v = parseFloat(parts[colMap.amount]?.replace(/[$,\s]/g, '') || '0');
            amount = Math.abs(v); isIncome = v >= 0;
        }
        const cleanedDate = formatDate(parsedDate);
        transactions.push({
            date: cleanedDate,
            description: toTitleCase(cleanDescription(parts[colMap.description] || 'Unknown')),
            amount,
            category: 'Uncategorized',
            accountId,
            typeId: isIncome ? transactionTypes.find(t => t.balanceEffect === 'income')?.id || '' : transactionTypes.find(t => t.balanceEffect === 'expense')?.id || '',
            sourceFilename: sourceName,
            metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
            // Snapshot original values for audit
            originalDate: cleanedDate,
            originalAmount: amount,
            originalDescription: parts[colMap.description]
        });
    }
    return transactions;
};

export const parseTransactionsFromText = async (text: string, accountId: string, transactionTypes: TransactionType[], onProgress: (msg: string) => void) => parseCSV_Tx(text.split('\n'), accountId, transactionTypes, 'Pasted Text');
export const parseTransactionsFromFiles = async (files: File[], accountId: string, transactionTypes: TransactionType[], onProgress: (msg: string) => void) => {
    const all: RawTransaction[] = [];
    for (const f of files) {
        const text = await (f.name.match(/\.xlsx?$/) ? readFileAsArrayBuffer(f).then(b => XLSX.utils.sheet_to_csv(XLSX.read(b, {type:'array'}).Sheets[XLSX.read(b, {type:'array'}).SheetNames[0]])) : readFileAsText(f));
        all.push(...parseCSV_Tx(text.split('\n'), accountId, transactionTypes, f.name));
    }
    return all;
};