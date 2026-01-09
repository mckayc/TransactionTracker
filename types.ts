
export type BalanceEffect = 'incoming' | 'outgoing' | 'neutral';

export interface TransactionType {
    id: string;
    name: string;
    balanceEffect: BalanceEffect;
    color?: string; // Tailwind class like 'text-emerald-600'
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

export interface RuleCategory {
    id: string;
    name: string;
    isDefault?: boolean;
}

export interface User {
    id: string;
    name: string;
    isDefault?: boolean;
}

export interface Counterparty {
    id: string;
    name: string;
    parentId?: string;
    notes?: string;
    userId?: string; // Optional default user for this entity
}

// Aliases for backward compatibility in components
export type Payee = Counterparty;
export type Merchant = Counterparty;

export interface Location {
    id: string;
    name: string;
    city?: string;
    state?: string;
    country?: string;
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
    counterpartyId?: string;
    locationId?: string;
    userId?: string;
    tagIds?: string[];
    notes?: string;
    appliedRuleId?: string; // Legacy support
    appliedRuleIds?: string[];
    metadata?: Record<string, any>;
}

export interface Transaction extends RawTransaction {
    id: string;
    categoryId: string;
    linkGroupId?: string;
    linkedTransactionId?: string;
    isParent?: boolean;
    parentTransactionId?: string;
    isCompleted?: boolean;
}

export type RuleOperator = 'contains' | 'does_not_contain' | 'equals' | 'starts_with' | 'ends_with' | 'greater_than' | 'less_than' | 'exists' | 'regex_match';
export type RuleField = 'description' | 'amount' | 'accountId' | 'metadata' | 'counterpartyId' | 'locationId';
export type RuleLogic = 'AND' | 'OR';

export interface RuleCondition {
    id: string;
    type: 'basic' | 'group';
    field?: RuleField;
    operator?: RuleOperator;
    value?: any;
    metadataKey?: string;
    nextLogic?: RuleLogic;
    conditions?: RuleCondition[]; 
}

export interface ReconciliationRule {
    id: string;
    name: string;
    ruleCategoryId?: string;
    ruleCategory?: string; // Legacy support
    conditions: RuleCondition[];
    setCategoryId?: string;
    setCounterpartyId?: string;
    setLocationId?: string;
    setUserId?: string;
    setTransactionTypeId?: string;
    setDescription?: string;
    assignTagIds?: string[];
    skipImport?: boolean;
    isAiDraft?: boolean;
    priority?: number;
    scope?: string;
    suggestedCategoryName?: string;
    suggestedCounterpartyName?: string;
    suggestedLocationName?: string;
    suggestedUserName?: string;
    suggestedTypeName?: string;
    suggestedTags?: string[];
}

export interface RuleImportDraft extends ReconciliationRule {
    isSelected: boolean;
    coverageCount?: number;
    mappingStatus: {
        category: 'match' | 'create' | 'none';
        counterparty: 'match' | 'create' | 'none';
        location: 'match' | 'create' | 'none';
        type: 'match' | 'create' | 'none';
        logicalState?: 'new' | 'identity' | 'synthesis' | 'conflict' | 'redundant';
    };
}

export interface ImportBatchStats {
    rowsEvaluated: number;
    rowsCovered: number;
    rulesCreated: number;
    rulesMerged: number;
}

export type TaskPriority = 'low' | 'medium' | 'high';

export interface TaskItem {
    id: string;
    title: string;
    description?: string;
    notes?: string;
    priority: TaskPriority;
    dueDate?: string;
    isCompleted: boolean;
    createdAt: string;
    subtasks?: SubTask[];
    recurrence?: RecurrenceRule;
    categoryId?: string;
}

export interface SubTask {
    id: string;
    text: string;
    isCompleted: boolean;
    notes?: string;
    linkUrl?: string;
    linkText?: string;
}

export interface RecurrenceRule {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval: number;
    byWeekDays?: number[];
    byMonthDay?: number;
    endDate?: string;
}

export interface Task {
    id: string;
    text: string;
}

export interface Template {
    id: string;
    name: string;
    instructions?: string;
    tasks: Task[];
}

export interface ScheduledEvent {
    id: string;
    templateId: string;
    startDate: string;
    recurrence: 'none' | 'monthly';
}

export type TaskCompletions = Record<string, boolean>;

export interface BusinessInfo {
    llcName?: string;
    businessType?: string;
    industry?: string;
    stateOfFormation?: string;
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
    completedSteps: [] | string[];
}

export interface BusinessNote {
    id: string;
    title: string;
    content: string;
    type: 'bug' | 'note' | 'idea' | 'task';
    priority: 'low' | 'medium' | 'high';
    isCompleted: boolean;
    createdAt: string;
    updatedAt: string;
    resolvedAt?: string;
}

export interface BusinessDocument {
    id: string;
    name: string;
    uploadDate: string;
    size: number;
    mimeType: string;
    parentId?: string;
    aiAnalysis?: {
        documentType: string;
        summary: string;
        keyDates?: string[];
    };
}

export interface DocumentFolder {
    id: string;
    name: string;
    parentId?: string;
    createdAt: string;
}

export interface BackupConfig {
    frequency: 'daily' | 'weekly' | 'monthly' | 'never';
    retentionCount: number;
    lastBackupDate?: string;
}

export interface DashboardWidget {
    id: string;
    type: 'report' | 'metric' | 'tasks' | 'calendar';
    config?: any; // Saved Report ID or Metric Key
    title?: string;
}

export interface AiConfig {
    textModel?: string;
    complexModel?: string;
    thinkingBudget?: number;
}

export type FieldRequirement = 'required' | 'optional' | 'omit';

export interface RuleForgePrompt {
    id: string;
    name: string;
    prompt: string;
    ruleCategoryId?: string;
    fields?: {
        description?: FieldRequirement;
        category?: FieldRequirement;
        counterparty?: FieldRequirement;
        location?: FieldRequirement;
        type?: FieldRequirement;
        tags?: FieldRequirement;
        skip?: FieldRequirement;
    };
}

export interface SystemSettings {
    backupConfig?: BackupConfig;
    dashboardWidgets?: DashboardWidget[];
    aiConfig?: AiConfig;
    ruleForgePrompts?: RuleForgePrompt[];
}

export type ReportGroupBy = 'category' | 'counterparty' | 'account' | 'type' | 'tag' | 'source' | 'product' | 'trackingId' | 'video';
export type DateRangePreset = 'thisMonth' | 'lastMonth' | 'thisYear' | 'lastYear' | 'allTime' | 'custom' | 'specificMonth' | 'relativeMonth' | 'last3Months' | 'last6Months' | 'last12Months';
export type DateRangeType = 'rolling_window' | 'fixed_period';
export type DateRangeUnit = 'day' | 'week' | 'month' | 'quarter' | 'year';

export interface CustomDateRange {
    id: string;
    name: string;
    type: DateRangeType;
    unit: DateRangeUnit;
    value: number;
    offsets?: { value: number; unit: DateRangeUnit }[];
}

export interface ReportConfig {
    id: string;
    name: string;
    dataSource?: 'financial' | 'amazon' | 'youtube';
    datePreset: DateRangePreset | string;
    customStartDate?: string;
    customEndDate?: string;
    groupBy: ReportGroupBy;
    subGroupBy?: ReportGroupBy;
    filters: {
        accountIds?: string[];
        userIds?: string[];
        categoryIds?: string[];
        typeIds?: string[];
        tagIds?: string[];
        counterpartyIds?: string[];
        amazonSources?: string[];
        amazonTrackingIds?: string[];
        balanceEffects?: BalanceEffect[];
    };
    hiddenCategoryIds?: string[];
    hiddenIds?: string[];
}

export interface SavedReport {
    id: string;
    name: string;
    config: ReportConfig;
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

export type AmazonReportType = 'onsite' | 'offsite' | 'creator_connections' | 'unknown';
export type AmazonCCType = 'onsite' | 'offsite';

export interface AmazonMetric {
    id: string;
    saleDate: string;
    asin: string;
    productTitle: string;
    clicks: number;
    orderedItems: number;
    shippedItems: number;
    revenue: number;
    conversionRate: number;
    trackingId: string;
    reportType: AmazonReportType;
    category?: string;
    reportYear?: string;
    creatorConnectionsType?: AmazonCCType;
    ccTitle?: string;
    videoTitle?: string;
    videoDuration?: string;
    videoUrl?: string;
    uploadDate?: string;
}

export interface AmazonVideo {
    id: string;
    videoId: string;
    videoTitle: string;
    asins?: string[];
    duration?: string;
    videoUrl?: string;
    uploadDate?: string;
}

export interface YouTubeChannel {
    id: string;
    name: string;
}

export interface YouTubeMetric {
    id: string;
    videoId: string;
    videoTitle: string;
    publishDate: string;
    views: number;
    watchTimeHours: number;
    subscribersGained: number;
    estimatedRevenue: number;
    impressions: number;
    ctr: number;
    channelId?: string;
    reportYear?: string;
}

export interface FinancialGoal {
    id: string;
    title: string;
    targetAmount: number;
    currentAmount: number;
    type: 'retirement' | 'emergency_fund' | 'debt_free' | 'investment' | 'other';
    targetDate?: string;
}

export interface FinancialPlan {
    id: string;
    createdAt: string;
    strategy: string;
    suggestedBudgets: { categoryId: string; limit: number }[];
}

export interface ContentLink {
    id: string;
    youtubeVideoId: string;
    amazonAsins: string[];
    title: string;
    manuallyLinked: boolean;
}

export interface AuditFinding {
    id: string;
    title: string;
    reason: string;
    affectedTransactionIds: string[];
    suggestedChanges: {
        categoryId?: string;
        typeId?: string;
    };
}

export interface DuplicatePair {
    newTx: Transaction;
    existingTx: Transaction;
}

export type View = 'dashboard' | 'import' | 'transactions' | 'calendar' | 'reports' | 'settings' | 'tasks' | 'rules' | 'management' | 'hub' | 'documents' | 'plan' | 'integrations' | 'integration-amazon' | 'integration-youtube' | 'integration-content-hub';
