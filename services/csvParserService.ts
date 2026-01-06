
import type { RawTransaction, TransactionType, AmazonMetric, YouTubeMetric, AmazonReportType, AmazonVideo, AmazonCCType } from '../types';
import { generateUUID } from '../utils';
import * as XLSX from 'xlsx';

declare const pdfjsLib: any;

const MCC_MAP: Record<string, string> = {
  '05411': 'Groceries',
  '05499': 'Groceries',
  '05310': 'Shopping',
  '05912': 'Health',
  '04816': 'Utilities',
  '00300': 'Travel',
  '05811': 'Dining',
  '05812': 'Dining',
  '05814': 'Dining',
  '05541': 'Transportation',
  '04121': 'Transportation',
};

const MERCHANT_MAP: Record<string, { category: string; payee?: string }> = {
  'WAL-MART': { category: 'Groceries', payee: 'Walmart' },
  'WM SUPERCENTER': { category: 'Groceries', payee: 'Walmart' },
  'WALMART': { category: 'Groceries', payee: 'Walmart' },
  'TARGET': { category: 'Shopping', payee: 'Target' },
  'UTOPIA FIBER': { category: 'Utilities', payee: 'Utopia Fiber' },
  'QUESTARGAS': { category: 'Utilities', payee: 'Questar Gas' },
  'ROCKYMTN': { category: 'Utilities', payee: 'Rocky Mountain Power' },
  'PACIFIC POWER': { category: 'Utilities', payee: 'Pacific Power' },
  'AMERICAN FAMILY': { category: 'Services', payee: 'American Family Insurance' },
  'CITI CARD': { category: 'Services', payee: 'Citi' },
  'GOOGLE': { category: 'Revenue', payee: 'Google' },
  'YOUTUBE': { category: 'Revenue', payee: 'YouTube' },
  'AMAZON.COM': { category: 'Shopping', payee: 'Amazon' },
  'AMAZON EUROPE': { category: 'Revenue', payee: 'Amazon' },
  'PAYPAL': { category: 'Services', payee: 'PayPal' },
  'GUSTO': { category: 'Payroll', payee: 'Gusto' },
  'CHINATOWN': { category: 'Groceries', payee: 'Chinatown Supermarket' },
  'MAVERIK': { category: 'Transportation', payee: 'Maverik' },
  'EXXON': { category: 'Transportation', payee: 'Exxon' },
  'CHEVRON': { category: 'Transportation', payee: 'Chevron' },
  'MACEY': { category: 'Groceries', payee: 'Macey\'s' },
  'SHELL': { category: 'Transportation', payee: 'Shell' },
  '7-ELEVEN': { category: 'Groceries', payee: '7-Eleven' },
  'COSTCO': { category: 'Groceries', payee: 'Costco' },
  'STARBUCKS': { category: 'Dining', payee: 'Starbucks' },
  'MCDONALD': { category: 'Dining', payee: 'McDonalds' },
  'NETFLIX': { category: 'Entertainment', payee: 'Netflix' },
  'SPOTIFY': { category: 'Entertainment', payee: 'Spotify' },
  'ADOBE': { category: 'Services', payee: 'Adobe' },
  'MICROSOFT': { category: 'Services', payee: 'Microsoft' },
  'APPLE.COM': { category: 'Shopping', payee: 'Apple' },
  'INTERNET PAYMENT': { category: 'Transfer', payee: 'Internal' },
  'ONLINE PAYMENT': { category: 'Transfer', payee: 'Internal' },
  'AUTOPAY': { category: 'Transfer', payee: 'Internal' },
  'ZELLE': { category: 'Transfer', payee: 'Internal' },
  'TRANSFER': { category: 'Transfer', payee: 'Internal' },
};

const guessMetadata = (description: string) => {
  const upper = description.toUpperCase();
  for (const [key, value] of Object.entries(MERCHANT_MAP)) {
    if (upper.includes(key)) return value;
  }
  return null;
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

export const parseAmazonReport = async (file: File, onProgress: (msg: string) => void): Promise<AmazonMetric[]> => {
    onProgress(`Reading ${file.name}...`);
    const reader = new FileReader();
    const result = await new Promise<string>((resolve) => {
      reader.onload = () => resolve(reader.result as string);
      reader.readAsText(file);
    });

    const lines = result.split('\n');
    const metrics: AmazonMetric[] = [];
    if (lines.length < 2) return [];

    let headerIndex = -1;
    for (let i = 0; i < Math.min(lines.length, 10); i++) {
        const lower = lines[i].toLowerCase();
        // Updated header detection to be more robust
        if ((lower.includes('tracking id') && lower.includes('asin')) || (lower.includes('earnings') && lower.includes('shipped'))) { 
            headerIndex = i; 
            break; 
        }
    }

    if (headerIndex === -1) throw new Error("Invalid Amazon Report format. Header not detected.");

    const header = lines[headerIndex].split(',').map(h => h.trim().replace(/"/g, '').toLowerCase());
    const colMap = {
        date: header.findIndex(h => h === 'date' || h === 'date shipped'),
        asin: header.findIndex(h => h === 'asin'),
        title: header.findIndex(h => h.includes('title')),
        clicks: header.findIndex(h => h === 'clicks'),
        ordered: header.findIndex(h => h.includes('ordered')),
        shipped: header.findIndex(h => h.includes('shipped')),
        income: header.findIndex(h => h.includes('earnings') || h.includes('commission') || h.includes('referral')),
        tracking: header.findIndex(h => h.includes('tracking id')),
        category: header.findIndex(h => h.includes('category') || h.includes('product group'))
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
            productTitle: values[colMap.title] || 'Unknown Product',
            clicks: parseFloat(values[colMap.clicks]) || 0,
            orderedItems: parseFloat(values[colMap.ordered]) || 0,
            shippedItems: parseFloat(values[colMap.shipped]) || 0,
            revenue: parseFloat(values[colMap.income]?.replace(/[$,]/g, '')) || 0,
            conversionRate: 0,
            trackingId: values[colMap.tracking] || 'default',
            category: values[colMap.category] || undefined,
            reportType: values[colMap.tracking]?.includes('onamz') ? 'onsite' : 'offsite'
        });
    }
    return metrics;
};

export const parseYouTubeReport = async (file: File, onProgress: (msg: string) => void): Promise<YouTubeMetric[]> => {
    onProgress(`Reading ${file.name}...`);
    const reader = new FileReader();
    const result = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsText(file);
    });

    const lines = result.split('\n');
    const metrics: YouTubeMetric[] = [];
    
    let headerIndex = lines.findIndex(l => l.toLowerCase().includes('video title') || (l.toLowerCase().includes('content') && l.toLowerCase().includes('views')));
    if (headerIndex === -1) throw new Error("Invalid YouTube Studio format. Use the 'Video Analytics' CSV export.");

    const header = lines[headerIndex].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(h => h.trim().toLowerCase());
    const colMap = { 
        title: header.findIndex(h => h.includes('title') || h.includes('content')), 
        views: header.findIndex(h => h === 'views'), 
        rev: header.findIndex(h => h.includes('revenue') || h.includes('earnings')), 
        date: header.findIndex(h => h.includes('date') || h.includes('publish') || h.includes('time')),
        imp: header.findIndex(h => h.includes('impressions')),
        ctr: header.findIndex(h => h.includes('click-through') || h.includes('ctr')),
        watch: header.findIndex(h => h.includes('watch time'))
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
            watchTimeHours: parseFloat(values[colMap.watch]) || 0,
            subscribersGained: 0,
            estimatedRevenue: parseFloat(values[colMap.rev]?.replace(/[$,]/g, '')) || 0,
            impressions: parseFloat(values[colMap.imp]) || 0,
            ctr: parseFloat(values[colMap.ctr]?.replace('%', '')) || 0
        });
    }
    return metrics;
};

// ... existing helper functions (parseCSV_Tx, parseTransactionsFromFiles, etc.) ...
// Simplified parseCSV for core transactions
const parseCSV_Tx = (lines: string[], accountId: string, transactionTypes: TransactionType[], sourceName: string): RawTransaction[] => {
  const transactions: RawTransaction[] = [];
  if (lines.length === 0) return transactions;

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
    type: lowerHeaders.findIndex(p => p.includes('type'))
  };

  const expenseType = transactionTypes.find(t => t.balanceEffect === 'expense') || transactionTypes[0];
  const incomeType = transactionTypes.find(t => t.balanceEffect === 'income') || transactionTypes[0];
  const transferType = transactionTypes.find(t => t.balanceEffect === 'transfer') || transactionTypes[0];

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    let parts = delimiter === '\t' ? line.split('\t') : line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
    parts = parts.map(p => p.trim().replace(/^"|"$/g, ''));
    if (parts.length < 2) continue;

    const dateStr = colMap.date > -1 ? parts[colMap.date] : '';
    const parsedDate = parseDate(dateStr);
    if (!parsedDate) continue;

    const nameVal = colMap.name > -1 ? parts[colMap.name] : '';
    const descVal = colMap.description > -1 ? parts[colMap.description] : '';
    const rawDesc = nameVal || descVal || 'Unspecified';

    const cleanedDesc = cleanDescription(rawDesc);
    const guess = guessMetadata(rawDesc);
    
    let parsedMcc = '';
    let parsedRef = '';
    const memoVal = colMap.memo > -1 ? parts[colMap.memo] : '';
    if (memoVal && memoVal.includes(';')) {
      const memoParts = memoVal.split(';').map(p => p.trim());
      parsedRef = memoParts[0] || '';
      parsedMcc = memoParts[1] || '';
    }

    const metadata: Record<string, string> = { 
      _raw: line,
      reference_id: parsedRef,
      mcc: parsedMcc
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
      const val = parseFloat(parts[colMap.amount].replace(/[$,\s]/g, ''));
      if (isNaN(val)) continue;
      amount = Math.abs(val);
      if (typeIndicator.includes('credit')) isIncome = true;
      else if (typeIndicator.includes('debit')) isIncome = false;
      else isIncome = val > 0;
    }

    let finalCategory = '';
    if (parsedMcc && MCC_MAP[parsedMcc]) finalCategory = MCC_MAP[parsedMcc];
    else if (guess?.category) finalCategory = guess.category;
    else if (colMap.category > -1) finalCategory = parts[colMap.category];
    else finalCategory = 'Uncategorized';

    let finalTypeId = isIncome ? incomeType.id : expenseType.id;
    const isTransferKeyword = cleanedDesc.toUpperCase().includes('TRANSFER') || 
                              cleanedDesc.toUpperCase().includes('PAYMENT THANK YOU') || 
                              cleanedDesc.toUpperCase().includes('ONLINE PAYMENT') ||
                              parsedMcc === '00300';

    if (isTransferKeyword) finalTypeId = transferType.id;

    transactions.push({
      date: formatDate(parsedDate),
      description: toTitleCase(cleanedDesc),
      amount: amount,
      categoryId: '',
      category: finalCategory,
      accountId: accountId,
      payeeId: guess?.payee ? 'guess_' + guess.payee : undefined,
      payee: guess?.payee || undefined,
      typeId: finalTypeId,
      sourceFilename: sourceName,
      metadata
    });
  }
  return transactions;
};

export const parseTransactionsFromText = async (text: string, accountId: string, transactionTypes: TransactionType[], onProgress: (msg: string) => void): Promise<RawTransaction[]> => {
  onProgress('Parsing text...');
  return parseCSV_Tx(text.split('\n'), accountId, transactionTypes, 'Pasted Text');
};

export const parseTransactionsFromFiles = async (files: File[], accountId: string, transactionTypes: TransactionType[], onProgress: (msg: string) => void): Promise<RawTransaction[]> => {
  const all: RawTransaction[] = [];
  for (const f of files) {
    onProgress(`Reading ${f.name}...`);
    const reader = new FileReader();
    const text = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsText(f);
    });
    all.push(...parseCSV_Tx(text.split('\n'), accountId, transactionTypes, f.name));
  }
  return all;
};
