
import type { RawTransaction, TransactionType, AmazonMetric, YouTubeMetric, AmazonReportType, AmazonVideo, AmazonCCType, ReconciliationRule, RuleCondition } from '../types';
import { generateUUID } from '../utils';
import * as XLSX from 'xlsx';

declare const pdfjsLib: any;

/**
 * Returns a CSV template string for rule imports with rich examples for AI/Users.
 */
export const generateRuleTemplate = (): string => {
    const headers = [
        'Rule Name',
        'Rule Category',
        'Match Field',
        'Operator',
        'Match Value',
        'Set Description',
        'Set Category',
        'Set Counterparty',
        'Set Location',
        'Set Type',
        'Set User',
        'Tags',
        'Skip Import'
    ];

    const examples = [
        ['Example1 - Category Descriptions', 'Description', 'description', 'contains', 'STARBUCKS || PEETS', 'Starbucks Coffee', 'Dining', 'Starbucks', '', 'Purchase', '', 'coffee;morning', 'false'],
        ['Example2 - Category Users', 'User', 'description', 'contains', 'VERIZON', 'Verizon Wireless Bill', 'Utilities', 'Verizon Wireless', '', 'Purchase', 'Primary User', 'personal;monthly', 'false'],
        ['Example3 - Category Location', 'Location', 'description', 'contains', 'SAFEWAY', 'Safeway Grocery', 'Groceries', 'Safeway', 'Seattle, WA', 'Purchase', '', 'food;local', 'false'],
        ['Example4 - Category Location', 'Location', 'description', 'contains', 'WHOLEFOODS', 'Whole Foods Market', 'Groceries', 'Whole Foods', 'New York, NY', 'Purchase', '', 'organic', 'false'],
        ['Example5 - Category Location', 'Location', 'description', 'contains', 'KROGER', 'Kroger', 'Groceries', 'Kroger', 'Austin, TX', 'Purchase', '', 'supplies', 'false'],
        ['Example6 - Global High Value', 'All', 'amount', 'greater_than', '5000', '', 'Capital Expenditure', '', '', 'Investment', '', 'high-value;audit', 'false'],
        ['Example7 - Ignore Spam Fees', 'Other', 'amount', 'less_than', '0.50', '', '', '', '', '', '', '', 'true'],
        ['Example8 - Description Match', 'Description', 'description', 'starts_with', 'AMZN MKTP', 'Amazon Web Services', 'Software Subscription', 'Amazon Web Services', '', 'Purchase', '', 'saas;aws', 'false']
    ];

    const rows = [headers, ...examples];
    return rows.map(r => r.map(cell => `"${cell}"`).join(',')).join('\n');
};

/**
 * Validates if the provided lines look like a valid Rule Manifest.
 */
export const validateRuleFormat = (lines: string[]): { isValid: boolean; error?: string } => {
    if (lines.length < 2) return { isValid: false, error: "File is empty or contains no data rows." };
    const delimiter = lines[0].includes('\t') ? '\t' : (lines[0].includes(',') ? ',' : ';');
    const header = lines[0].split(delimiter).map(h => h.trim().toLowerCase().replace(/"/g, ''));
    
    const required = ['rule name', 'match field', 'operator', 'match value'];
    const missing = required.filter(r => !header.includes(r));
    
    if (missing.length > 0) {
        return { isValid: false, error: `Missing required columns: ${missing.join(', ')}` };
    }
    
    return { isValid: true };
};

/**
 * Parses Rule Manifests for bulk ingestion
 * Updated to handle multiple OR conditions via pipe symbols and improved header detection.
 */
export const parseRulesFromLines = (lines: string[]): ReconciliationRule[] => {
    const rules: ReconciliationRule[] = [];
    if (lines.length < 2) return rules;

    const delimiter = lines[0].includes('\t') ? '\t' : (lines[0].includes(',') ? ',' : ';');
    const header = lines[0].split(delimiter).map(h => h.trim().toLowerCase().replace(/"/g, ''));
    
    const colMap = {
        name: header.findIndex(h => h === 'rule name' || h === 'name'),
        category: header.findIndex(h => h === 'rule category' || h === 'category'),
        field: header.findIndex(h => h === 'match field' || h === 'field'),
        operator: header.findIndex(h => h === 'operator'),
        value: header.findIndex(h => h === 'match value' || h === 'value'),
        setDesc: header.findIndex(h => h === 'set description' || h === 'display description' || h === 'clean description'),
        setCategory: header.findIndex(h => h === 'set category' || h === 'category match'),
        setPayee: header.findIndex(h => h === 'set payee' || h === 'payee' || h === 'merchant' || h === 'counterparty'),
        setCounterparty: header.findIndex(h => h === 'set counterparty' || h === 'counterparty'),
        setLocation: header.findIndex(h => h === 'set location' || h === 'location' || h === 'place' || h === 'city' || h === 'address'),
        setType: header.findIndex(h => h === 'set type' || h === 'type'),
        setUser: header.findIndex(h => h === 'set user' || h === 'user'),
        setTags: header.findIndex(h => h === 'tags' || h === 'labels'),
        skip: header.findIndex(h => h === 'skip import' || h === 'skip')
    };

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const parts = delimiter === '\t' 
            ? line.split('\t').map(p => p.trim().replace(/^"|"$/g, ''))
            : line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(p => p.trim().replace(/^"|"$/g, ''));

        if (parts.length < 4) continue;

        const rawMatchValue = parts[colMap.value] || '';
        const matchValues = rawMatchValue.split(/\s*\|\|\s*|\s*\|\s*/).filter(Boolean);
        
        const conditions: RuleCondition[] = matchValues.length > 0 
            ? matchValues.map((val, idx) => ({
                id: generateUUID(),
                type: 'basic',
                field: (parts[colMap.field] || 'description') as any,
                operator: (parts[colMap.operator] || 'contains') as any,
                value: val.trim(),
                nextLogic: idx === matchValues.length - 1 ? 'AND' : 'OR'
            }))
            : [{
                id: generateUUID(),
                type: 'basic',
                field: (parts[colMap.field] || 'description') as any,
                operator: (parts[colMap.operator] || 'contains') as any,
                value: '',
                nextLogic: 'AND'
            }];

        const rule: ReconciliationRule = {
            id: generateUUID(),
            name: parts[colMap.name] || `Imported Rule ${i}`,
            ruleCategory: parts[colMap.category] || 'Other',
            conditions: conditions,
            setDescription: colMap.setDesc > -1 ? parts[colMap.setDesc] : undefined,
            suggestedCategoryName: parts[colMap.setCategory],
            suggestedCounterpartyName: parts[colMap.setCounterparty] || parts[colMap.setPayee],
            suggestedLocationName: parts[colMap.setLocation],
            suggestedTypeName: parts[colMap.setType],
            suggestedUserName: parts[colMap.setUser],
            suggestedTags: parts[colMap.setTags] ? parts[colMap.setTags].split(';').map(t => t.trim()) : undefined,
            skipImport: parts[colMap.skip]?.toLowerCase() === 'true'
        };
        rules.push(rule);
    }
    return rules;
};

export const parseRulesFromFile = async (file: File): Promise<ReconciliationRule[]> => {
    const reader = new FileReader();
    
    if (file.name.endsWith('.csv')) {
        const text = await new Promise<string>((res) => {
            reader.onload = () => res(reader.result as string);
            reader.readAsText(file);
        });
        return parseRulesFromLines(text.split('\n'));
    } else {
        const data = await new Promise<ArrayBuffer>((res) => {
            reader.onload = () => res(reader.result as ArrayBuffer);
            reader.readAsArrayBuffer(file);
        });
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const firstSheet = workbook.Sheets[firstSheetName];
        const csv = XLSX.utils.sheet_to_csv(firstSheet);
        return parseRulesFromLines(csv.split('\n'));
    }
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
};

const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseCSV_Tx = (lines: string[], accountId: string, transactionTypes: TransactionType[], sourceName: string): RawTransaction[] => {
  const transactions: RawTransaction[] = [];
  if (lines.length === 0) return transactions;

  if (!transactionTypes || transactionTypes.length === 0) {
      throw new Error("System Error: No transaction types loaded. Please verify database connectivity.");
  }

  let headerIndex = -1;
  let rawHeaders: string[] = [];
  const delimiter = lines[0].includes('\t') ? '\t' : ',';

  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    const lineLower = lines[i].toLowerCase();
    const parts = lineLower.split(delimiter).map(p => p.trim().replace(/"/g, ''));
    const dateIdx = parts.findIndex(p => p.includes('date') || p === 'dt');
    if (dateIdx > -1) {
      headerIndex = i;
      rawHeaders = lines[i].split(delimiter).map(h => h.trim().replace(/"/g, ''));
      break;
    }
  }

  if (headerIndex === -1) return transactions;

  const lowerHeaders = rawHeaders.map(h => h.toLowerCase());
  const colMap = {
    date: lowerHeaders.findIndex(p => p.includes('date') || p === 'dt'),
    name: lowerHeaders.findIndex(p => p === 'name' || p.includes('merchant') || p.includes('payee')),
    description: lowerHeaders.findIndex(p => p.includes('description') || p === 'transaction'),
    memo: lowerHeaders.findIndex(p => p.includes('memo') || p.includes('reference') || p.includes('note')),
    amount: lowerHeaders.findIndex(p => p === 'amount' || p.includes('amount')),
    credit: lowerHeaders.findIndex(p => p.includes('credit') || p.includes('deposit')),
    debit: lowerHeaders.findIndex(p => p.includes('debit') || p.includes('payment') || p.includes('withdrawal')),
    category: lowerHeaders.findIndex(p => p.includes('category')),
    location: lowerHeaders.findIndex(p => p.includes('location') || p.includes('city') || p.includes('place') || p.includes('address')),
    type: lowerHeaders.findIndex(p => p.includes('type'))
  };

  const expenseType = transactionTypes.find(t => t.balanceEffect === 'outgoing') || transactionTypes[0];
  const incomeType = transactionTypes.find(t => t.balanceEffect === 'incoming') || transactionTypes[0];

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    let parts = delimiter === '\t' ? line.split('\t') : line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
    parts = parts.map(p => p.trim().replace(/^"|"$/g, ''));
    if (parts.length < 2) continue;

    const dateStr = colMap.date > -1 ? parts[colMap.date] : '';
    const parsedDate = parseDate(dateStr);
    if (!parsedDate) continue;

    let rawDesc = '';
    const nameVal = colMap.name > -1 ? parts[colMap.name] : '';
    const descVal = colMap.description > -1 ? parts[colMap.description] : '';
    rawDesc = nameVal || descVal || 'Unspecified';

    const cleanedDesc = cleanDescription(rawDesc);
    
    const metadata: Record<string, string> = { 
      _raw: line
    };
    rawHeaders.forEach((h, idx) => { if (parts[idx] !== undefined) metadata[h] = parts[idx]; });

    let amount = 0;
    let isIncome = false;

    const typeIndicator = colMap.type > -1 ? parts[colMap.type].toLowerCase() : '';

    if (colMap.credit > -1 && colMap.debit > -1) {
      const cr = parseFloat(parts[colMap.credit].replace(/[$,\s]/g, '') || '0');
      const db = parseFloat(parts[colMap.debit].replace(/[$,\s]/g, '') || '0');
      if (Math.abs(cr) > 0) { amount = Math.abs(cr); isIncome = true; }
      else { amount = Math.abs(db); isIncome = false; }
    } else if (colMap.amount > -1) {
      const valText = parts[colMap.amount]?.replace(/[$,\s]/g, '') || '0';
      const val = parseFloat(valText);
      if (isNaN(val)) continue;
      
      amount = Math.abs(val);
      if (typeIndicator.includes('credit')) {
          isIncome = true;
      } else if (typeIndicator.includes('debit')) {
          isIncome = false;
      } else {
          isIncome = val > 0;
      }
    }

    transactions.push({
      date: formatDate(parsedDate),
      description: toTitleCase(cleanedDesc),
      amount: amount,
      category: colMap.category > -1 ? parts[colMap.category] : 'Uncategorized',
      accountId: accountId,
      typeId: isIncome ? incomeType.id : expenseType.id,
      location: colMap.location > -1 ? parts[colMap.location] : undefined,
      sourceFilename: sourceName,
      metadata
    });
  }
  return transactions;
};

export const parseAmazonReport = async (file: File, onProgress: (msg: string) => void): Promise<AmazonMetric[]> => {
    onProgress(`Reading ${file.name}...`);
    let text = '';
    const reader = new FileReader();
    const result = await new Promise<string>((resolve) => {
      reader.onload = () => resolve(reader.result as string);
      reader.readAsText(file);
    });
    text = result;

    const lines = text.split('\n');
    const metrics: AmazonMetric[] = [];
    if (lines.length < 2) return [];
    let headerIndex = -1;
    for (let i = 0; i < Math.min(lines.length, 10); i++) {
        const lower = lines[i].toLowerCase();
        if (lower.includes('tracking id') && lower.includes('asin')) { headerIndex = i; break; }
    }
    if (headerIndex === -1) return [];
    const header = lines[headerIndex].split(',').map(h => h.trim().replace(/"/g, '').toLowerCase());
    const colMap = {
        date: header.findIndex(h => h === 'date' || h === 'date shipped'),
        asin: header.findIndex(h => h === 'asin'),
        title: header.findIndex(h => h.includes('title')),
        clicks: header.findIndex(h => h === 'clicks'),
        ordered: header.findIndex(h => h.includes('ordered')),
        income: header.findIndex(h => h.includes('earnings') || h.includes('commission')),
        tracking: header.findIndex(h => h.includes('tracking id')),
    };
    for (let i = headerIndex + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/"/g, ''));
        if (!values[colMap.asin]) continue;
        metrics.push({
            id: generateUUID(),
            saleDate: formatDate(parseDate(values[colMap.date]) || new Date()),
            asin: values[colMap.asin],
            productTitle: values[colMap.title] || 'Unknown',
            clicks: parseFloat(values[colMap.clicks]) || 0,
            orderedItems: parseFloat(values[colMap.ordered]) || 0,
            shippedItems: 0,
            revenue: parseFloat(values[colMap.income]?.replace(/[$,]/g, '')) || 0,
            conversionRate: 0,
            trackingId: values[colMap.tracking] || 'default',
            reportType: values[colMap.tracking]?.includes('onamz') ? 'onsite' : 'offsite'
        });
    }
    return metrics;
};

export const parseAmazonVideos = async (file: File, onProgress: (msg: string) => void): Promise<AmazonVideo[]> => {
    onProgress(`Reading ${file.name}...`);
    const reader = new FileReader();
    const text = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsText(file);
    });
    const lines = text.split('\n');
    const videos: AmazonVideo[] = [];
    if (lines.length < 2) return [];
    let headerIndex = lines.findIndex(l => l.toLowerCase().includes('title'));
    if (headerIndex === -1) throw new Error("Invalid format.");
    const header = lines[headerIndex].split(',').map(h => h.trim().toLowerCase());
    const colMap = { title: header.indexOf('title'), asin: header.indexOf('asin') };
    for (let i = headerIndex + 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        if (values.length <= colMap.title) continue;
        videos.push({
            id: generateUUID(),
            videoId: generateUUID().slice(0, 8),
            videoTitle: values[colMap.title],
            asins: values[colMap.asin] ? [values[colMap.asin]] : undefined
        });
    }
    return videos;
};

export const parseYouTubeReport = async (file: File, onProgress: (msg: string) => void): Promise<YouTubeMetric[]> => {
    onProgress(`Reading ${file.name}...`);
    const reader = new FileReader();
    const text = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsText(file);
    });
    const lines = text.split('\n');
    const metrics: YouTubeMetric[] = [];
    let headerIndex = lines.findIndex(l => l.toLowerCase().includes('video title') || l.toLowerCase().includes('content'));
    if (headerIndex === -1) throw new Error("Invalid YouTube format.");
    const header = lines[headerIndex].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(h => h.trim().toLowerCase());
    const colMap = { 
        title: header.findIndex(h => h.includes('title')), 
        views: header.indexOf('views'), 
        rev: header.findIndex(h => h.includes('revenue')), 
        date: header.findIndex(h => h.includes('date') || h.includes('time')) 
    };
    for (let i = headerIndex + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/"/g, ''));
        if (values.length <= colMap.title || values[0].toLowerCase() === 'total') continue;
        metrics.push({
            id: generateUUID(),
            videoId: generateUUID().slice(0, 8),
            videoTitle: values[colMap.title],
            publishDate: formatDate(parseDate(values[colMap.date]) || new Date()),
            views: parseFloat(values[colMap.views]) || 0,
            watchTimeHours: 0,
            subscribersGained: 0,
            estimatedRevenue: parseFloat(values[colMap.rev]?.replace(/[$,]/g, '')) || 0,
            impressions: 0,
            ctr: 0
        });
    }
    return metrics;
};

export const parseTransactionsFromText = async (text: string, accountId: string, transactionTypes: TransactionType[], onProgress: (msg: string) => void): Promise<RawTransaction[]> => {
  onProgress('Parsing text...');
  return parseCSV_Tx(text.split('\n'), accountId, transactionTypes, 'Pasted Text');
};

export const parseTransactionsFromFiles = async (files: File[], accountId: string, transactionTypes: TransactionType[], onProgress: (msg: string) => void): Promise<RawTransaction[]> => {
  const all: RawTransaction[] = [];
  for (const f of files) {
    onProgress(`Reading ${f.name}...`);
    if (f.type === 'application/pdf') continue;
    
    const reader = new FileReader();
    const text = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsText(f);
    });
    all.push(...parseCSV_Tx(text.split('\n'), accountId, transactionTypes, f.name));
  }
  return all;
};
