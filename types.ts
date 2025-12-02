

export type BalanceEffect = 'income' | 'expense' | 'transfer' | 'investment' | 'donation';

export interface TransactionType {
  id: string;
  name: string;
  balanceEffect: BalanceEffect;
  isDefault?: boolean;
}

export interface Payee {
  id: string;
  name: string;
  parentId?: string;
}

export interface Category {
  id: string;
  name: string;
  parentId?: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string; // Hex code or Tailwind class suffix
}

export interface User {
  id: string;
  name: string;
  isDefault?: boolean;
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  originalDescription?: string;
  categoryId: string;
  amount: number;
  typeId: string;
  location?: string;
  accountId?: string;
  notes?: string;
  payeeId?: string;
  linkedTransactionId?: string; // Legacy 1-to-1 link
  linkGroupId?: string; // New 1-to-many group link
  sourceFilename?: string;
  userId?: string;
  tagIds?: string[];
  isParent?: boolean; // If true, this is a container for split transactions and should be excluded from sums
  parentTransactionId?: string; // ID of the parent transaction if this is a split part
}

export interface AccountType {
  id: string;
  name: string;
  isDefault?: boolean;
}

export interface Account {
  id:string;
  name: string;
  identifier: string;
  accountTypeId: string;
}

export interface BusinessInfo {
  llcName?: string;
  ein?: string;
  address?: string;
  formationDate?: string;
  stateOfFormation?: string;
  businessType?: 'sole-proprietorship' | 'llc-single' | 'llc-multi' | 'c-corp' | 's-corp';
  industry?: string;
}

export interface TaxInfo {
  filingStatus?: 'sole-proprietor' | 's-corp' | 'c-corp' | 'partnership' | '';
  accountantName?: string;
  accountantEmail?: string;
  taxYearEnd?: string;
  lastFilingDate?: string;
  notes?: string;
}

export interface DocumentFolder {
    id: string;
    name: string;
    parentId?: string;
    createdAt: string;
}

export interface BusinessDocument {
  id: string;
  name: string;
  uploadDate: string;
  size: number;
  mimeType: string;
  parentId?: string; // For folder nesting
  aiAnalysis?: {
    documentType: string;
    summary: string;
    keyDates: string[];
    taxTips: string[];
  };
}

export interface BusinessProfile {
  info: BusinessInfo;
  tax: TaxInfo;
  completedSteps: string[]; // IDs of completed wizard steps
}

export interface ChatMessage {
    id: string;
    role: 'user' | 'ai';
    content: string;
    timestamp: string;
}

export interface ChatSession {
    id: string;
    title: string;
    messages: ChatMessage[];
    createdAt: string;
    updatedAt: string;
}

export interface BackupConfig {
    frequency: 'daily' | 'weekly' | 'monthly' | 'never';
    retentionCount: number;
    lastBackupDate?: string;
}

export interface SystemSettings {
    apiKey?: string;
    backupConfig?: BackupConfig;
}


// Represents a transaction before it has been assigned a unique ID.
export type RawTransaction = Omit<Transaction, 'id' | 'categoryId' | 'linkedTransactionId'> & { category: string };

export interface DuplicatePair {
  newTx: Transaction;
  existingTx: Transaction;
}


// Types for the new Task Management feature
export interface Task {
  id: string;
  text: string;
}

export interface Template {
  id: string;
  name: string;
  instructions: string; // Markdown supported
  tasks: Task[];
}

export interface ScheduledEvent {
  id: string;
  templateId: string;
  startDate: string; // YYYY-MM-DD
  recurrence: 'none' | 'monthly';
}

export type TaskPriority = 'low' | 'medium' | 'high';

export interface SubTask {
  id: string;
  text: string;
  isCompleted: boolean;
  linkUrl?: string; // Optional URL for checklist items
  linkText?: string; // Optional display text for the link
  notes?: string; // Optional notes for the checklist item
}

export interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number; // e.g. 1 for "every day", 2 for "every 2 weeks"
  endDate?: string; // YYYY-MM-DD
  byWeekDays?: number[]; // 0=Sun, 1=Mon, etc. for Weekly
  byMonthDay?: number; // 1-31, or -1 for Last Day for Monthly
}

export interface TaskItem {
  id: string;
  title: string;
  description?: string;
  notes?: string; // Longer detailed notes
  dueDate?: string; // YYYY-MM-DD
  isCompleted: boolean;
  priority: TaskPriority;
  createdAt: string;
  subtasks?: SubTask[];
  recurrence?: RecurrenceRule;
}

export type TaskCompletions = Record<string, Record<string, string[]>>;

// Rules Engine Types
export type RuleLogic = 'AND' | 'OR';
export type RuleOperator = 'contains' | 'does_not_contain' | 'equals' | 'starts_with' | 'ends_with' | 'greater_than' | 'less_than';

export interface RuleCondition {
  id: string;
  field: 'description' | 'amount' | 'accountId';
  operator: RuleOperator;
  value: string | number;
  nextLogic?: RuleLogic; // Connects this condition to the next one (e.g. Condition 1 [AND] Condition 2)
}

export interface ReconciliationRule {
  id: string;
  name: string;
  
  // Legacy simple conditions (kept for backward compatibility)
  descriptionContains?: string;
  accountId?: string;
  amountEquals?: number;

  // New flexible conditions
  matchLogic?: RuleLogic; // Deprecated in favor of linear logic in conditions
  conditions?: RuleCondition[];

  // Actions
  setCategoryId?: string;
  setPayeeId?: string;
  setTransactionTypeId?: string;
  setDescription?: string;
  assignTagIds?: string[]; // New: Auto-assign tags
}

// Types for AI Audit
export interface AuditFinding {
  id: string;
  title: string;
  reason: string;
  affectedTransactionIds: string[];
  suggestedChanges: {
    categoryId?: string; // ID of the category to change to
    typeId?: string; // ID of the transaction type to change to
    payeeName?: string; // Suggested payee name (to find or create)
  };
}

// --- Report Types ---

export type DateRangePreset = 
    | 'thisMonth' 
    | 'lastMonth' 
    | 'thisYear' 
    | 'lastYear' 
    | 'last3Months' 
    | 'last6Months'
    | 'last12Months'
    | 'custom' 
    | 'sameMonthLastYear' 
    | 'sameMonth2YearsAgo' 
    | 'lastMonthPriorYear'
    | 'specificMonth' // Static month (e.g. "2023-08")
    | 'relativeMonth' // Relative offset (e.g. "3 months ago")
    | string; // Allow custom IDs

export type DateRangeUnit = 'day' | 'week' | 'month' | 'quarter' | 'year';
export type DateRangeType = 'fixed_period' | 'rolling_window';

export interface DateOffset {
    unit: DateRangeUnit;
    value: number;
}

export interface CustomDateRange {
    id: string;
    name: string;
    type: DateRangeType; // e.g. "rolling_window" (Last 3 months) vs "fixed_period" (The month 3 months ago)
    unit: DateRangeUnit; // Primary unit or Window Size for fixed period
    value: number; // Primary value
    offsets?: DateOffset[]; // Optional list of additional offsets for fixed periods
}

export type ReportGroupBy = 'category' | 'payee' | 'tag' | 'type' | 'account';

export interface ReportConfig {
    id: string;
    name: string;
    datePreset: DateRangePreset;
    customStartDate?: string; // Used for Custom Start, Specific Month (YYYY-MM), or Relative Offset (string "3")
    customEndDate?: string;
    groupBy?: ReportGroupBy; // Dimension to group by (default: category)
    subGroupBy?: ReportGroupBy; // Secondary dimension to group by (e.g. Account -> Category)
    filters: {
        accountIds?: string[];
        userIds?: string[];
        typeIds?: string[];
        categoryIds?: string[];
        balanceEffects?: BalanceEffect[]; 
        tagIds?: string[];
        payeeIds?: string[];
    };
    hiddenCategoryIds?: string[]; // Legacy: IDs of categories hidden via the eye icon
    hiddenIds?: string[]; // New: Universal hidden IDs for any group type (replaces hiddenCategoryIds logic)
}

export interface SavedReport {
    id: string;
    name: string;
    config: ReportConfig;
}