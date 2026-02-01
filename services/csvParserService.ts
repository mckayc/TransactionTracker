
import type { RawTransaction, TransactionType, AmazonMetric, YouTubeMetric, AmazonReportType, AmazonVideo, AmazonCCType, ReconciliationRule, RuleCondition } from '../types';
import { generateUUID } from '../utils';
import * as XLSX from 'xlsx';

declare const pdfjsLib: any;

/**
 * Robustly splits a CSV line, respecting quoted fields and escaped quotes.
 */
const splitCsvLine = (line: string, delimiter: string): string[] => {
    const result: string[] = [];
    let curVal = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                // Escaped quote
                curVal += '"';
                i++; // Skip next quote
            } else {
                // Toggle quote state
                inQuotes = !inQuotes;
            }
        } else if (char === delimiter && !inQuotes) {
            result.push(curVal.trim());
            curVal = '';
        } else {
            curVal += char;
        }
    }
    result.push(curVal.trim());
    return result;
};

const cleanDescription = (string: string): string => {
  let cleaned = string.trim();
  cleaned = cleaned.replace(/\s+/g, ' ');
  cleaned = cleaned.replace(/^["']+|["']+$/g, '');
  cleaned = cleaned.replace(/[,.]+$/, '');
  cleaned = cleaned.replace(/^(Pos Debit|Debit Purchase|Recurring Payment|Preauthorized Debit|Checkcard|Visa Purchase|ACH Withdrawal|ACH Deposit|Paper Payment to|Withdrawal from|Deposit from) -? /i, '');
  cleaned = cleaned.replace(/PAYMENTS ID NBR:.*$/i, '');
  cleaned = cleaned.replace(/ID NBR:.*$/i, '');
  cleaned = cleaned.replace(/EDI PYMNTS.*$/i, '');
  cleaned = cleaned.replace(/ACH ITEMS.*$/i, '');
  cleaned = cleaned.replace(/ \d{5,}.*$/g, ''); 
  cleaned = cleaned.replace(/\s+[A-Z]{2,}\s+[A-Z]{2}$/, '');
  return cleaned.trim();
};

const toTitleCase = (str: string): string => {
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());
};

const parseDate = (dateStr: string): Date | null => {
  if (!dateStr || dateStr.length < 5) return null;
  const cleanedDateStr = dateStr.replace(/^"|"$/g, '').trim();

  if (/^\d{4}-\d{1,2}-\d{1,2}/.test(cleanedDateStr)) {
    const datePart = cleanedDateStr.split(' ')[0];
    const date = new Date(datePart + 'T00:00:00');
    if (!isNaN(date.getTime())) return date;
  }

  // Handle formats like "Dec 31 2025 11:29 AM"
  if (/[A-Za-z]{3}\s\d{1,2},?\s\d{4}/.test(cleanedDateStr)) {
      const date = new Date(cleanedDateStr);
      if (!isNaN(date.getTime())) return date;
  }

  if (/^\d{1,2}-\d{1,2}-\d{2,4}/.test(cleanedDateStr)) {
    const parts = cleanedDateStr.split('-');
    let year = parseInt(parts[2], 10);
    if (year < 100) year += year < 70 ? 2000 : 1900;
    const date = new Date(year, parseInt(parts[0], 10) - 1, parseInt(parts[1], 10));
    if (!isNaN(date.getTime())) return date;
  }

  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(cleanedDateStr)) {
    const parts = cleanedDateStr.split('/');
    let year = parseInt(parts[2], 10);
    if (year < 100) year += year < 70 ? 2000 : 1900;
    const date = new Date(year, parseInt(parts[0], 10) - 1, parseInt(parts[1], 10));
    if (!isNaN(date.getTime())) return date;
  }

  const date = new Date(cleanedDateStr);
  if (!isNaN(date.getTime()) && date.getFullYear() > 1990 && date.getFullYear() < 2050) return date;
  return null;
};

const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * YouTube Detailed Video Report (Legacy Support)
 */
export const parseYouTubeDetailedReport = async (file: File, onProgress: (msg: string) => void): Promise<YouTubeMetric[]> => {
    onProgress(`Reading ${file.name}...`);
    const reader = new FileReader();
    const text = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsText(file);
    });
    const lines = text.split('\n');
    const metrics: YouTubeMetric[] = [];
    if (lines.length < 2) return [];

    const delimiter = lines[0].includes('\t') ? '\t' : ',';
    const headerLine = lines[0].trim();
    const header = splitCsvLine(headerLine, delimiter).map(h => h.toLowerCase());
    
    const colMap = {
        id: header.indexOf('content'),
        title: header.indexOf('video title'),
        date: header.indexOf('video publish time'),
        duration: header.indexOf('duration'),
        views: header.indexOf('views'),
        hours: header.indexOf('watch time (hours)'),
        subs: header.indexOf('subscribers'),
        revenue: header.indexOf('estimated revenue (usd)'),
        impressions: header.indexOf('impressions'),
        ctr: header.indexOf('impressions click-through rate (%)')
    };

    if (colMap.id === -1 || colMap.title === -1) throw new Error("Invalid YouTube report format.");

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.toLowerCase().startsWith('total')) continue;
        const values = splitCsvLine(line, delimiter);
        if (values.length < 3) continue;

        metrics.push({
            id: generateUUID(),
            videoId: values[colMap.id],
            videoTitle: values[colMap.title],
            publishDate: formatDate(parseDate(values[colMap.date]) || new Date()),
            duration: values[colMap.duration],
            views: parseInt(values[colMap.views]) || 0,
            watchTimeHours: parseFloat(values[colMap.hours]) || 0,
            subscribersGained: parseInt(values[colMap.subs]) || 0,
            estimatedRevenue: parseFloat(values[colMap.revenue]?.replace(/[$,]/g, '')) || 0,
            impressions: parseInt(values[colMap.impressions]) || 0,
            ctr: parseFloat(values[colMap.ctr]) || 0
        });
    }
    return metrics;
};

/**
 * Amazon Storefront Videos (Step 2 Joiner - Title, Views, Hearts, Avg_Pct_Viewed, Duration, Upload_Date, Video_URL)
 */
export const parseAmazonStorefrontVideos = async (file: File, onProgress: (msg: string) => void): Promise<AmazonVideo[]> => {
    onProgress(`Reading ${file.name}...`);
    const reader = new FileReader();
    const text = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsText(file);
    });
    const lines = text.split('\n');
    const videos: AmazonVideo[] = [];
    if (lines.length < 2) return [];

    const delimiter = lines[0].includes('\t') ? '\t' : ',';
    const headerLine = lines[0].trim();
    const header = splitCsvLine(headerLine, delimiter).map(h => h.toLowerCase());
    
    const colMap = {
        title: header.indexOf('title'),
        views: header.indexOf('views'),
        hearts: header.indexOf('hearts'),
        avgView: header.indexOf('avg_pct_viewed'),
        duration: header.indexOf('duration'),
        date: header.indexOf('upload_date'),
        url: header.indexOf('video_url')
    };

    if (colMap.title === -1) throw new Error("Invalid Amazon Storefront Video format. Header 'Title' is missing.");

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const values = splitCsvLine(line, delimiter);
        if (values.length < 1) continue;

        videos.push({
            id: generateUUID(),
            videoId: '', 
            videoTitle: values[colMap.title],
            views: parseInt(values[colMap.views]) || 0,
            hearts: parseInt(values[colMap.hearts]) || 0,
            avgPctViewed: parseFloat(values[colMap.avgView]?.replace('%', '')) || 0,
            duration: values[colMap.duration],
            uploadDate: formatDate(parseDate(values[colMap.date]) || new Date()),
            videoUrl: values[colMap.url]
        });
    }
    return videos;
};

/**
 * Video to ASIN Mapping (Step 3 Joiner - Title, ASINs, Duration, Video URL)
 */
export const parseVideoAsinMapping = async (file: File, onProgress: (msg: string) => void): Promise<Partial<AmazonVideo>[]> => {
    onProgress(`Reading ${file.name}...`);
    const reader = new FileReader();
    const text = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsText(file);
    });
    const lines = text.split('\n');
    const mappings: Partial<AmazonVideo>[] = [];
    if (lines.length < 2) return [];

    const delimiter = lines[0].includes('\t') ? '\t' : ',';
    const headerLine = lines[0].trim();
    const header = splitCsvLine(headerLine, delimiter).map(h => h.toLowerCase());
    
    const colMap = {
        title: header.indexOf('title'),
        asins: header.indexOf('asins'),
        duration: header.indexOf('duration'),
        url: header.indexOf('video url')
    };

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const values = splitCsvLine(line, delimiter);
        if (values.length < 1) continue;

        mappings.push({
            videoTitle: values[colMap.title],
            asins: values[colMap.asins] ? values[colMap.asins].split(/[\|,\s]+/).map(a => a.trim()).filter(Boolean) : [],
            duration: values[colMap.duration],
            videoUrl: values[colMap.url]
        });
    }
    return mappings;
};

/**
 * Amazon Earnings Report (Step 4 Joiner)
 */
export const parseAmazonEarningsReport = async (file: File, onProgress: (msg: string) => void): Promise<AmazonMetric[]> => {
    onProgress(`Reading ${file.name}...`);
    const reader = new FileReader();
    const text = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsText(file);
    });
    const lines = text.split('\n');
    const metrics: AmazonMetric[] = [];
    if (lines.length < 2) return [];

    let headerIdx = -1;
    for (let i = 0; i < lines.length; i++) {
        const lower = lines[i].toLowerCase();
        if (lower.includes('asin') && (lower.includes('revenue') || lower.includes('ordered'))) {
            headerIdx = i;
            break;
        }
    }

    if (headerIdx === -1) throw new Error("Could not find Amazon data headers.");

    const delimiter = lines[headerIdx].includes('\t') ? '\t' : ',';
    const header = splitCsvLine(lines[headerIdx], delimiter).map(h => h.trim().toLowerCase());
    
    const colMap = {
        category: header.indexOf('category'),
        name: header.indexOf('name'),
        asin: header.indexOf('asin'),
        tracking: header.indexOf('tracking id'),
        date: header.indexOf('date shipped'),
        items: header.indexOf('items shipped'),
        revenue: header.indexOf('revenue($)'),
        fees: header.indexOf('ad fees($)')
    };

    for (let i = headerIdx + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.toLowerCase().startsWith('total')) continue;
        const values = splitCsvLine(line, delimiter);
        if (values.length <= colMap.asin) continue;

        const trackingId = values[colMap.tracking] || '';
        metrics.push({
            id: generateUUID(),
            saleDate: formatDate(parseDate(values[colMap.date]) || new Date()),
            asin: values[colMap.asin],
            productTitle: values[colMap.name] || 'Unknown',
            category: values[colMap.category],
            trackingId,
            clicks: 0,
            orderedItems: parseInt(values[colMap.items]) || 0,
            shippedItems: parseInt(values[colMap.items]) || 0,
            revenue: parseFloat(values[colMap.revenue]?.replace(/[$,]/g, '')) || 0,
            conversionRate: 0,
            reportType: trackingId.includes('onamz') ? 'onsite' : 'offsite'
        });
    }
    return metrics;
};

/**
 * Creator Connections Report (Step 5 Joiner)
 */
export const parseCreatorConnectionsReport = async (file: File, onProgress: (msg: string) => void): Promise<AmazonMetric[]> => {
    onProgress(`Reading ${file.name}...`);
    const reader = new FileReader();
    const text = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsText(file);
    });
    const lines = text.split('\n');
    const metrics: AmazonMetric[] = [];
    if (lines.length < 2) return [];

    const delimiter = lines[0].includes('\t') ? '\t' : ',';
    const header = splitCsvLine(lines[0], delimiter).map(h => h.trim().toLowerCase());
    
    const colMap = {
        date: header.indexOf('date'),
        campaign: header.indexOf('campaign title'),
        asin: header.indexOf('asin'),
        clicks: header.indexOf('clicks'),
        items: header.indexOf('shipped items'),
        revenue: header.indexOf('revenue'),
        commission: header.indexOf('commission income')
    };

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.toLowerCase().startsWith('total')) continue;
        const values = splitCsvLine(line, delimiter);
        if (values.length < colMap.asin) continue;

        metrics.push({
            id: generateUUID(),
            saleDate: formatDate(parseDate(values[colMap.date]) || new Date()),
            asin: values[colMap.asin],
            productTitle: values[colMap.campaign] || 'CC Campaign',
            ccTitle: values[colMap.campaign],
            clicks: parseInt(values[colMap.clicks]) || 0,
            orderedItems: parseInt(values[colMap.items]) || 0,
            shippedItems: parseInt(values[colMap.items]) || 0,
            revenue: parseFloat(values[colMap.revenue]?.replace(/[$,]/g, '')) || 0,
            commissionIncome: parseFloat(values[colMap.commission]?.replace(/[$,]/g, '')) || 0,
            conversionRate: 0,
            trackingId: 'creator_connections',
            reportType: 'creator_connections'
        });
    }
    return metrics;
};

export const parseYouTubeReport = parseYouTubeDetailedReport;
export const parseAmazonReport = parseAmazonEarningsReport;
export const parseAmazonVideos = parseAmazonStorefrontVideos;

/**
 * Standard transaction parsers with intelligent header detection.
 */
export const parseTransactionsFromText = async (text: string, accountId: string, transactionTypes: TransactionType[], onProgress: (msg: string) => void): Promise<RawTransaction[]> => {
    onProgress("Parsing ledger data...");
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 1) return [];
    
    const delimiter = lines[0].includes('\t') ? '\t' : ',';
    const firstLineParts = splitCsvLine(lines[0], delimiter).map(p => p.trim().toLowerCase());
    
    // Identify column indices based on common headers
    const findIndex = (labels: string[]) => firstLineParts.findIndex(p => labels.some(l => p.includes(l.toLowerCase())));
    
    const dateIdx = findIndex(['date']);
    const amountIdx = findIndex(['amount', 'value', 'total', 'price']);
    const descIdx = findIndex(['description', 'memo', 'transaction', 'details']);
    const payeeIdx = findIndex(['payee', 'merchant', 'entity', 'name']);
    const typeIdx = findIndex(['type', 'category']);

    // Default mappings if headers aren't found or standard CSV structure
    const effectiveDateIdx = dateIdx !== -1 ? dateIdx : 0;
    const effectiveAmountIdx = amountIdx !== -1 ? amountIdx : 2;
    const effectiveDescIdx = descIdx !== -1 ? descIdx : (payeeIdx !== -1 ? payeeIdx : 1);
    
    // If we have a header row, start from index 1, otherwise 0
    const hasHeader = dateIdx !== -1 || amountIdx !== -1 || descIdx !== -1;
    const startIndex = hasHeader ? 1 : 0;
    
    const txs: RawTransaction[] = [];
    const incomingType = transactionTypes.find(t => t.balanceEffect === 'incoming') || transactionTypes[0];
    const outgoingType = transactionTypes.find(t => t.balanceEffect === 'outgoing') || transactionTypes[0];

    for (let i = startIndex; i < lines.length; i++) {
        const parts = splitCsvLine(lines[i], delimiter);
        if (parts.length < 2) continue;

        const dateStr = parts[effectiveDateIdx];
        const rawDesc = parts[effectiveDescIdx];
        const rawAmount = parts[effectiveAmountIdx]?.replace(/[$,]/g, '').trim();
        
        if (!dateStr || !rawAmount) continue;

        const amount = parseFloat(rawAmount) || 0;
        
        // Use Payee as secondary description if both exist
        let finalDesc = rawDesc;
        if (payeeIdx !== -1 && payeeIdx !== effectiveDescIdx && parts[payeeIdx]) {
            finalDesc = `${parts[payeeIdx]} - ${rawDesc}`.trim();
            if (finalDesc.endsWith(' -')) finalDesc = parts[payeeIdx];
            if (finalDesc.startsWith('- ')) finalDesc = rawDesc;
        }

        const date = parseDate(dateStr);
        if (!date) continue;

        // Auto-detect type based on amount sign or "Transaction Type" column
        let selectedTypeId = amount >= 0 ? incomingType.id : outgoingType.id;
        if (typeIdx !== -1 && parts[typeIdx]) {
            const rowType = parts[typeIdx].toLowerCase();
            if (rowType.includes('receive') || rowType.includes('credit') || rowType.includes('deposit')) {
                selectedTypeId = incomingType.id;
            } else if (rowType.includes('spend') || rowType.includes('debit') || rowType.includes('purchase')) {
                selectedTypeId = outgoingType.id;
            }
        }

        txs.push({
            date: formatDate(date),
            description: cleanDescription(finalDesc || 'Untitled Transaction'),
            originalDescription: finalDesc,
            amount: Math.abs(amount),
            accountId,
            category: 'Other',
            typeId: selectedTypeId,
            metadata: {
                raw_row: lines[i]
            }
        });
    }
    return txs;
};

export const parseTransactionsFromFiles = async (files: File[], accountId: string, transactionTypes: TransactionType[], onProgress: (msg: string) => void): Promise<RawTransaction[]> => {
    const allTxs: RawTransaction[] = [];
    for (const file of files) {
        onProgress(`Reading ${file.name}...`);
        const reader = new FileReader();
        const text = await new Promise<string>((res) => {
            reader.onload = () => res(reader.result as string);
            reader.readAsText(file);
        });
        const txs = await parseTransactionsFromText(text, accountId, transactionTypes, onProgress);
        allTxs.push(...txs);
    }
    return allTxs;
};

export const validateRuleFormat = (lines: string[]): { isValid: boolean; error?: string } => {
    if (lines.length === 0) return { isValid: false, error: "Empty file" };
    const header = lines[0].toLowerCase();
    if (!header.includes('rule name') || !header.includes('match field')) return { isValid: false, error: "Missing required headers" };
    return { isValid: true };
};

export const generateRuleTemplate = (): string => {
    return "Rule Name,Match Field,Operator,Match Value,Target Category,Target Entity,Target Location,Target Type,Set Description,Skip Import\n" +
           "Starbucks Coffee,description,contains,STARBUCKS,Dining,Starbucks,,Purchase,Starbucks,false";
};

export const parseRulesFromLines = (lines: string[]): ReconciliationRule[] => {
    const rules: ReconciliationRule[] = [];
    if (lines.length < 2) return [];
    const delimiter = lines[0].includes('\t') ? '\t' : ',';
    const header = splitCsvLine(lines[0], delimiter).map(h => h.trim().toLowerCase());
    const col = (name: string) => header.indexOf(name);
    for (let i = 1; i < lines.length; i++) {
        const row = splitCsvLine(lines[i], delimiter);
        if (row.length < 4) continue;
        rules.push({
            id: generateUUID(),
            name: row[col('rule name')] || 'Untitled Rule',
            conditions: [{ id: generateUUID(), type: 'basic', field: row[col('match field')] as any || 'description', operator: row[col('operator')] as any || 'contains', value: row[col('match value')] || '', nextLogic: 'AND' }],
            suggestedCategoryName: row[col('target category')],
            suggestedCounterpartyName: row[col('target entity')],
            suggestedLocationName: row[col('target location')],
            suggestedTypeName: row[col('target type')],
            setDescription: row[col('set description')],
            skipImport: row[col('skip import')] === 'true'
        });
    }
    return rules;
};

export const parseRulesFromFile = async (file: File): Promise<ReconciliationRule[]> => {
    const reader = new FileReader();
    const text = await new Promise<string>((res) => {
        reader.onload = () => res(reader.result as string);
        reader.readAsText(file);
    });
    return parseRulesFromLines(text.split('\n'));
};
