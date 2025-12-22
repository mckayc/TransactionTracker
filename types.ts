
export type BalanceEffect = 'income' | 'expense' | 'transfer' | 'investment' | 'donation';

export interface TransactionType {
    id: string;
    name: string;
    balanceEffect: BalanceEffect;
    isDefault?: boolean;
}

export interface Tag {
    id: string;
    name: string;
    color: string;
}

export interface Category {
    id: string;
    name: string;
    parentId?: string;
}

export interface Payee {
    id: string;
    name: string;
    parentId?: string;
}

export interface AccountType {
    id: string;
    name: string;
    isDefault?: boolean;
}

export interface Account {
    id: string;
    name: string;
    identifier: string;
    accountTypeId: string;
}

export interface User {
    id: string;
    name: string;
    isDefault?: boolean;
}

export interface RawTransaction {
    date: string;
    description: string;
    amount: number;
    category: string;
    accountId: string;
    typeId: string;
    location?: string;
    sourceFilename?: string;
    originalDescription?: string;
    payeeId?: string;
    userId?: string;
    tagIds?: string[];
    notes?: string;
    categoryId?: string; 
}

export interface Transaction extends RawTransaction {
    id: string;
    categoryId: string; // Required in final transaction
    linkGroupId?: string;
    linkedTransactionId?: string; // Legacy
    isParent?: boolean;
    parentTransactionId?: string;
    isCompleted?: boolean;
}

export interface DuplicatePair {
    newTx: Transaction;
    existingTx: Transaction;
}

// Rules
export type RuleOperator = 'contains' | 'does_not_contain' | 'equals' | 'starts_with' | 'ends_with' | 'greater_than' | 'less_than';
export type RuleField = 'description' | 'amount' | 'accountId';
export type RuleLogic = 'AND' | 'OR';

export interface RuleCondition {
    id: string;
    field: RuleField;
    operator: RuleOperator;
    value: any;
    nextLogic?: RuleLogic;
}

export interface ReconciliationRule {
    id: string;
    name: string;
    conditions?: RuleCondition[];
    // Actions
    setCategoryId?: string;
    setPayeeId?: string;
    setTransactionTypeId?: string;
    setDescription?: string;
    assignTagIds?: string[];
    // Legacy support
    descriptionContains?: string;
    amountEquals?: number;
    accountId?: string;
}

// Tasks & Calendar
export type TaskPriority = 'low' | 'medium' | 'high';

export interface SubTask {
    id: string;
    text: string;
    isCompleted: boolean;
    linkUrl?: string;
    linkText?: string;
    notes?: string;
}

export interface RecurrenceRule {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval: number;
    byWeekDays?: number[]; // 0-6
    byMonthDay?: number; // 1-31, -1 for last day
    endDate?: string;
}

export interface TaskItem {
    id: string;
    title: string;
    description?: string;
    notes?: string;
    priority: TaskPriority;
    dueDate?: string;
    isCompleted: boolean;
    createdAt: string;
    subtasks: SubTask[];
    recurrence?: RecurrenceRule;
}

export interface Task { // Simple task for Template
    id: string;
    text: string;
}

export interface Template {
    id: string;
    name: string;
    instructions: string;
    tasks: Task[];
}

export interface ScheduledEvent {
    id: string;
    templateId: string;
    startDate: string;
    recurrence: 'none' | 'monthly';
}

export type TaskCompletions = Record<string, Record<string, string[]>>; // Date -> EventID -> CompletedTaskIDs

// Documents
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
    parentId?: string;
    aiAnalysis?: {
        documentType?: string;
        summary?: string;
        keyDates?: string[];
        taxTips?: string[];
    };
}

// Settings & Profile
export interface BackupConfig {
    frequency: 'daily' | 'weekly' | 'monthly' | 'never';
    retentionCount: number;
    lastBackupDate?: string;
}

export interface SystemSettings {
    apiKey?: string;
    backupConfig?: BackupConfig;
}

export interface BusinessInfo {
    llcName?: string;
    businessType?: string;
    stateOfFormation?: string;
    industry?: string;
    formationDate?: string;
    ein?: string;
}

export interface TaxInfo {
    filingStatus?: string;
    taxYearEnd?: string;
    accountantName?: string;
}

export interface BusinessProfile {
    info: BusinessInfo;
    tax: TaxInfo;
    completedSteps: string[];
}

// Reports & Integrations
export type DateRangePreset = 'thisMonth' | 'lastMonth' | 'thisYear' | 'lastYear' | 'allTime' | 'custom' | 'last3Months' | 'last6Months' | 'last12Months' | 'specificMonth' | 'relativeMonth';
export type ReportGroupBy = 'category' | 'payee' | 'account' | 'type' | 'tag' | 'source' | 'product' | 'video' | 'trackingId';
export type DateRangeUnit = 'day' | 'week' | 'month' | 'quarter' | 'year';
export type DateRangeType = 'rolling_window' | 'fixed_period';

export interface DateOffset {
    value: number;
    unit: DateRangeUnit;
}

export interface CustomDateRange {
    id: string;
    name: string;
    type: DateRangeType;
    unit: DateRangeUnit;
    value: number;
    offsets?: DateOffset[];
}

export interface ReportConfig {
    id: string;
    name: string;
    dataSource: 'financial' | 'amazon' | 'youtube';
    datePreset: DateRangePreset;
    customStartDate?: string;
    customEndDate?: string;
    groupBy?: ReportGroupBy;
    subGroupBy?: ReportGroupBy;
    filters: {
        accountIds?: string[];
        userIds?: string[];
        categoryIds?: string[];
        typeIds?: string[];
        balanceEffects?: BalanceEffect[];
        tagIds?: string[];
        payeeIds?: string[];
        amazonSources?: AmazonReportType[];
        amazonTrackingIds?: string[];
    };
    hiddenCategoryIds?: string[];
    hiddenIds?: string[];
}

export interface SavedReport {
    id: string;
    name: string;
    config: ReportConfig;
}

// AI & Chat
export interface ChatMessage {
    id: string;
    role: 'user' | 'ai' | 'model';
    content: string;
    timestamp: string;
    isError?: boolean;
}

export interface ChatSession {
    id: string;
    title: string;
    messages: ChatMessage[];
    createdAt: string;
    updatedAt: string;
}

export interface AuditFinding {
    id: string;
    title: string;
    reason: string;
    affectedTransactionIds: string[];
    suggestedChanges: {
        categoryId?: string;
        typeId?: string;
        payeeName?: string;
    };
}

// Financial Planning
export interface FinancialGoal {
    id: string;
    title: string;
    targetAmount: number;
    currentAmount: number;
    targetDate?: string;
    type: 'emergency_fund' | 'debt_payoff' | 'savings' | 'retirement';
}

export interface FinancialPlan {
    id: string;
    createdAt: string;
    strategy: string; // Markdown generated by AI
    suggestedBudgets: {
        categoryId: string;
        monthlyLimit: number;
    }[];
}

// Integrations
export type AmazonReportType = 'onsite' | 'offsite' | 'creator_connections' | 'unknown';

export interface AmazonMetric {
    id: string;
    date: string; // YYYY-MM-DD
    asin: string;
    title: string;
    clicks: number;
    orderedItems: number;
    shippedItems: number;
    revenue: number;
    conversionRate: number;
    trackingId: string;
    category?: string;
    reportType: AmazonReportType;
    campaignTitle?: string;
}

export interface YouTubeChannel {
    id: string;
    name: string;
    url?: string;
}

export interface YouTubeMetric {
    id: string;
    channelId?: string;
    videoId: string;
    videoTitle: string;
    publishDate: string; // YYYY-MM-DD
    reportYear?: string;
    views: number;
    watchTimeHours: number;
    subscribersGained: number;
    estimatedRevenue: number;
    impressions: number;
    ctr: number;
}

export interface IntegrationConfig {
    id: string;
    name: string;
    description: string;
    isEnabled: boolean;
}
