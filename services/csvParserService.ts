import type { RawTransaction, TransactionType, AmazonMetric, YouTubeMetric, AmazonReportType, AmazonVideo, AmazonCCType, ReconciliationRule, RuleCondition, Account } from '../types';
import { generateUUID } from '../utils';
import * as XLSX from 'xlsx';

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
                curVal += '"';
                i++;
            } else {
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

/**
 * Sanitizes headers by removing Byte Order Marks (BOM) and invisible whitespace.
 */
const sanitizeHeader = (h: string): string => {
    return h.replace(/^\uFEFF/, '').trim().toLowerCase();
};

const parseDate = (dateStr: string): Date | null => {
  if (!dateStr || dateStr.length < 5) return null;
  const cleanedDateStr = dateStr.replace(/^"|"$/g, '').trim();

  // YYYY-MM-DD
  if (/^\d{4}-\d{1,2}-\d{1,2}/.test(cleanedDateStr)) {
    const datePart = cleanedDateStr.split(' ')[0];
    const date = new Date(datePart + 'T00:00:00');
    if (!isNaN(date.getTime())) return date;
  }

  // DD.MM.YYYY or DD/MM/YYYY (common in Europe)
  if (/^\d{1,2}[\/\.]\d{1,2}[\/\.]\d{4}/.test(cleanedDateStr)) {
      const sep = cleanedDateStr.includes('.') ? '.' : '/';
      const parts = cleanedDateStr.split(sep);
      const date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      if (!isNaN(date.getTime())) return date;
  }

  // Month Day, Year
  if (/[A-Za-z]{3}\s\d{1,2},?\s\d{4}/.test(cleanedDateStr)) {
      const date = new Date(cleanedDateStr);
      if (!isNaN(date.getTime())) return date;
  }

  // MM-DD-YYYY
  if (/^\d{1,2}-\d{1,2}-\d{2,4}/.test(cleanedDateStr)) {
    const parts = cleanedDateStr.split('-');
    let year = parseInt(parts[2], 10);
    if (year < 100) year += year < 70 ? 2000 : 1900;
    const date = new Date(year, parseInt(parts[0], 10) - 1, parseInt(parts[1], 10));
    if (!isNaN(date.getTime())) return date;
  }

  // MM/DD/YYYY
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

export const parseTransactionsFromText = async (
    text: string, 
    accountId: string, 
    transactionTypes: TransactionType[], 
    onProgress: (msg: string) => void,
    accountContext?: Account
): Promise<RawTransaction[]> => {
    onProgress("Deconstructing bank CSV stream...");
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 1) return [];
    
    const profile = accountContext?.parsingProfile;
    if (!profile) {
        throw new Error(`The account '${accountContext?.name || accountId}' does not have a Header Map. Please configure it in Identity Hub.`);
    }

    // Determine delimiter (Saved vs Detected)
    let delimiter = profile.delimiter || (lines[0].includes('\t') ? '\t' : (lines[0].includes(';') ? ';' : ','));
    
    // Sanitize headers to handle BOM and hidden chars
    const headerLine = lines[0];
    const firstLineParts = splitCsvLine(headerLine, delimiter).map(sanitizeHeader);
    
    const findIndexStrict = (profileField: string | number | undefined, label: string) => {
        if (profileField === undefined || profileField === null || profileField === '') return -1;
        if (typeof profileField === 'number') return profileField;
        
        const cleanTarget = profileField.toString().toLowerCase().trim();
        const idx = firstLineParts.findIndex(p => p === cleanTarget);
        
        if (idx === -1) {
            throw new Error(`Header '${profileField}' (mapped to ${label}) was not found in the file. Detected headers: ${firstLineParts.join(', ')}`);
        }
        return idx;
    };
    
    const dateIdx = findIndexStrict(profile.dateColumn, 'Transaction Date');
    const amountIdx = findIndexStrict(profile.amountColumn, 'Amount');
    const debitIdx = findIndexStrict(profile.debitColumn, 'Debit/Withdrawal');
    const creditIdx = findIndexStrict(profile.creditColumn, 'Credit/Deposit');
    const descIdx = findIndexStrict(profile.descriptionColumn, 'Statement Memo');
    
    const payeeIdx = findIndexStrict(profile.payeeColumn, 'Entity/Payee');
    const typeIdx = findIndexStrict(profile.typeColumn, 'Transaction Type');
    const catIdx = findIndexStrict(profile.categoryColumn, 'Category');
    const locIdx = findIndexStrict(profile.locationColumn, 'Location');
    const tagsIdx = findIndexStrict(profile.tagsColumn, 'Tags');
    const notesIdx = findIndexStrict(profile.notesColumn, 'Notes');

    const startIndex = profile.hasHeader ? 1 : 0;
    const txs: RawTransaction[] = [];
    const incomingType = transactionTypes.find(t => t.balanceEffect === 'incoming') || transactionTypes[0];
    const outgoingType = transactionTypes.find(t => t.balanceEffect === 'outgoing') || transactionTypes[0];

    let dateFailures = 0;
    let amountFailures = 0;

    for (let i = startIndex; i < lines.length; i++) {
        const parts = splitCsvLine(lines[i], delimiter);
        if (parts.length < 2) continue;

        const dateStr = parts[dateIdx];
        const rawDesc = parts[descIdx];
        
        let amount = 0;
        let forceType: string | null = null;

        if (debitIdx !== -1 || creditIdx !== -1) {
            const debitVal = debitIdx !== -1 ? parts[debitIdx]?.replace(/[^0-9.+-]/g, '') : '';
            const creditVal = creditIdx !== -1 ? parts[creditIdx]?.replace(/[^0-9.+-]/g, '') : '';
            
            const debitNum = parseFloat(debitVal) || 0;
            const creditNum = parseFloat(creditVal) || 0;

            if (Math.abs(debitNum) > 0) {
                amount = Math.abs(debitNum);
                forceType = outgoingType.id;
            } else if (Math.abs(creditNum) > 0) {
                amount = Math.abs(creditNum);
                forceType = incomingType.id;
            }
        } else if (amountIdx !== -1) {
            // FIX: Regex was stripping all numbers except 0 and 9 because of [^-0.9.]
            const rawAmount = parts[amountIdx]?.replace(/[^0-9.+-]/g, '') || '0';
            amount = parseFloat(rawAmount);
            if (isNaN(amount)) {
                amountFailures++;
                continue;
            }
        }
        
        if (!dateStr || (amount === 0 && !rawDesc && (!payeeIdx || !parts[payeeIdx]))) continue;

        // Intelligent Description Construction
        let finalDesc = rawDesc || '';
        const payee = (payeeIdx !== -1 && parts[payeeIdx]) ? parts[payeeIdx] : '';

        if (payee && payee !== finalDesc) {
            if (finalDesc) finalDesc = `${payee} - ${finalDesc}`;
            else finalDesc = payee;
        }

        // If after all that it's still empty, fallback to notes or 'Untitled'
        if (!finalDesc) {
            finalDesc = (notesIdx !== -1 ? parts[notesIdx] : '') || 'Untitled Transaction';
        }

        const date = parseDate(dateStr);
        if (!date) {
            dateFailures++;
            continue;
        }

        let selectedTypeId = forceType || (amount >= 0 ? incomingType.id : outgoingType.id);
        
        txs.push({
            date: formatDate(date),
            description: cleanDescription(finalDesc),
            originalDescription: finalDesc,
            amount: Math.abs(amount),
            accountId,
            category: catIdx !== -1 ? parts[catIdx] : 'Other',
            typeId: selectedTypeId,
            location: locIdx !== -1 ? parts[locIdx] : undefined,
            notes: notesIdx !== -1 ? parts[notesIdx] : undefined,
            tagIds: tagsIdx !== -1 ? parts[tagsIdx]?.split(',').map(t => t.trim()) : undefined,
            metadata: {
                raw_row: lines[i],
                file_line: i + 1
            }
        });
    }

    if (txs.length === 0) {
        if (dateFailures > 0) {
            throw new Error(`Extracted ${lines.length - startIndex} potential rows, but they ALL failed date parsing in column '${profile.dateColumn}'. Check your Date format in the CSV.`);
        }
        if (amountFailures > 0) {
            throw new Error(`Found data rows, but failed to parse amounts in column '${profile.amountColumn}'. Make sure it contains only numbers and symbols like $ or ,.`);
        }
        throw new Error(`Successfully found columns, but failed to extract any valid transaction rows. Check if the CSV uses headers but the 'Has Header' setting is incorrect.`);
    }

    return txs;
};

export const parseTransactionsFromFiles = async (
    files: File[], 
    accountId: string, 
    transactionTypes: TransactionType[], 
    onProgress: (msg: string) => void,
    accountContext?: Account
): Promise<RawTransaction[]> => {
    const allTxs: RawTransaction[] = [];
    for (const file of files) {
        onProgress(`Reading ${file.name}...`);
        const reader = new FileReader();
        const text = await new Promise<string>((res) => {
            reader.onload = () => res(reader.result as string);
            reader.readAsText(file);
        });
        try {
            const txs = await parseTransactionsFromText(text, accountId, transactionTypes, onProgress, accountContext);
            allTxs.push(...txs);
        } catch (e: any) {
            throw new Error(`File Error (${file.name}): ${e.message}`);
        }
    }
    return allTxs;
};

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
    const headerLine = lines[0].trim();
    const header = splitCsvLine(headerLine, delimiter).map(h => h.trim().toLowerCase());
    
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

// Fix: Adding missing rule template generator
export const generateRuleTemplate = (): string => {
    return "Rule Name,Match Field,Operator,Match Value,Target Category,Target Counterparty,Target Location,Target Type,Description Cleanup,Tags,Skip Import\n" +
           "Starbucks Logic,description,contains,STARBUCKS,Dining,Starbucks,Seattle,Purchase,Starbucks Coffee,coffee||morning,false\n";
};

// Fix: Adding missing rule format validator
export const validateRuleFormat = (lines: string[]): { isValid: boolean; error?: string } => {
    if (lines.length < 1) return { isValid: false, error: "File is empty." };
    const header = sanitizeHeader(lines[0]);
    if (!header.includes('rule name') || !header.includes('match value')) {
        return { isValid: false, error: "Missing required headers. Ensure 'Rule Name' and 'Match Value' are present." };
    }
    return { isValid: true };
};

// Fix: Adding missing rule logic parser
export const parseRulesFromLines = (lines: string[]): ReconciliationRule[] => {
    if (lines.length < 2) return [];
    const delimiter = lines[0].includes('\t') ? '\t' : (lines[0].includes(';') ? ';' : ',');
    const header = splitCsvLine(lines[0], delimiter).map(sanitizeHeader);
    
    const col = {
        name: header.indexOf('rule name'),
        field: header.indexOf('match field'),
        op: header.indexOf('operator'),
        val: header.indexOf('match value'),
        cat: header.indexOf('target category'),
        entity: header.indexOf('target counterparty'),
        loc: header.indexOf('target location'),
        type: header.indexOf('target type'),
        clean: header.indexOf('description cleanup'),
        tags: header.indexOf('tags'),
        skip: header.indexOf('skip import')
    };

    const rules: ReconciliationRule[] = [];
    for (let i = 1; i < lines.length; i++) {
        const row = splitCsvLine(lines[i], delimiter);
        if (row.length < 2) continue;

        const name = row[col.name] || 'Imported Rule';
        const field = (row[col.field] || 'description') as any;
        const operator = (row[col.op] || 'contains') as any;
        const value = row[col.val] || '';
        
        if (!value) continue;

        rules.push({
            id: generateUUID(),
            name,
            conditions: [{ id: generateUUID(), type: 'basic', field, operator, value, nextLogic: 'AND' }],
            suggestedCategoryName: row[col.cat],
            suggestedCounterpartyName: row[col.entity],
            suggestedLocationName: row[col.loc],
            suggestedTypeName: row[col.type],
            setDescription: row[col.clean],
            suggestedTags: row[col.tags] ? row[col.tags].split('||').map(t => t.trim()) : undefined,
            skipImport: row[col.skip]?.toLowerCase() === 'true'
        });
    }
    return rules;
};

// Fix: Adding missing rule file parser
export const parseRulesFromFile = async (file: File): Promise<ReconciliationRule[]> => {
    const reader = new FileReader();
    const text = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsText(file);
    });
    return parseRulesFromLines(text.split(/\r?\n/).filter(l => l.trim()));
};

// Fix: Adding missing amazon report multiplexer
export const parseAmazonReport = async (file: File, onProgress: (msg: string) => void): Promise<AmazonMetric[]> => {
    const name = file.name.toLowerCase();
    if (name.includes('creator') || name.includes('connection')) {
        return parseCreatorConnectionsReport(file, onProgress);
    }
    return parseAmazonEarningsReport(file, onProgress);
};

// Fix: Adding missing amazon video export wrapper
export const parseAmazonVideos = parseAmazonStorefrontVideos;

// Fix: Adding missing youtube report export wrapper
export const parseYouTubeReport = parseYouTubeDetailedReport;
