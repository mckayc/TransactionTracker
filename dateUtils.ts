
import type { RecurrenceRule, DateRangeUnit, DateRangePreset, CustomDateRange } from './types';

/**
 * Parses a YYYY-MM-DD string into a local Date object without UTC shifting.
 */
export const parseISOLocal = (dateStr: string): Date => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
};

/**
 * Formats a date object or string to YYYY-MM-DD format.
 * This is the standard display format for the application.
 */
export const formatDate = (date: Date | string): string => {
    if (!date) return '';
    
    // If it's already a standard ISO date string, return it as-is to avoid parsing errors
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return date;
    }

    const d = new Date(date);
    // Handle invalid dates gracefully
    if (isNaN(d.getTime())) return String(date);
    
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Calculates the next due date based on a recurrence rule.
 */
export const calculateNextDate = (currentDateStr: string, rule: RecurrenceRule): string => {
    const current = parseISOLocal(currentDateStr);
    const interval = rule.interval && rule.interval > 0 ? rule.interval : 1;

    switch (rule.frequency) {
        case 'daily':
            current.setDate(current.getDate() + interval);
            break;
            
        case 'weekly':
            if (rule.byWeekDays && rule.byWeekDays.length > 0) {
                const targetDays = [...rule.byWeekDays].sort((a, b) => a - b);
                const currentDay = current.getDay();
                const nextDayInWeek = targetDays.find(d => d > currentDay);
                
                if (nextDayInWeek !== undefined) {
                    const diff = nextDayInWeek - currentDay;
                    current.setDate(current.getDate() + diff);
                } else {
                    const daysUntilNextWeek = 7 - currentDay;
                    const daysToFirstTarget = targetDays[0];
                    const weeksToAdd = Math.max(0, interval - 1);
                    current.setDate(current.getDate() + daysUntilNextWeek + (weeksToAdd * 7) + daysToFirstTarget);
                }
            } else {
                current.setDate(current.getDate() + (interval * 7));
            }
            break;
            
        case 'monthly':
            current.setMonth(current.getMonth() + interval);
            if (rule.byMonthDay !== undefined) {
                if (rule.byMonthDay === -1) {
                    current.setMonth(current.getMonth() + 1, 0); 
                } else {
                    const maxDays = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
                    const dayToSet = Math.min(rule.byMonthDay, maxDays);
                    current.setDate(dayToSet);
                }
            }
            break;
            
        case 'yearly':
            current.setFullYear(current.getFullYear() + interval);
            break;
    }
    
    return formatDate(current);
};

/**
 * Returns today's date in YYYY-MM-DD format.
 */
export const getTodayDate = (): string => {
    return formatDate(new Date());
};

export const applyOffset = (date: Date, value: number, unit: DateRangeUnit) => {
    const d = new Date(date);
    switch (unit) {
        case 'day': d.setDate(d.getDate() - value); break;
        case 'week': d.setDate(d.getDate() - (value * 7)); break;
        case 'month': d.setMonth(d.getMonth() - value); break;
        case 'quarter': d.setMonth(d.getMonth() - (value * 3)); break;
        case 'year': d.setFullYear(d.getFullYear() - value); break;
    }
    return d;
};

export const calculateDateRange = (preset: DateRangePreset, customStart: string | undefined, customEnd: string | undefined, savedRanges: CustomDateRange[]): { start: Date, end: Date, label: string } => {
    const now = new Date();
    let start = new Date();
    let end = new Date();
    let label = '';

    const resetTime = (d: Date, endOfDay = false) => {
        if (endOfDay) d.setHours(23, 59, 59, 999);
        else d.setHours(0, 0, 0, 0);
        return d;
    };

    const customRange = savedRanges.find(r => r.id === preset);

    if (customRange) {
        label = customRange.name;
        const val = customRange.value;
        const unit = customRange.unit;
        
        if (customRange.type === 'fixed_period') {
            let anchor = new Date(now);
            if (customRange.offsets && customRange.offsets.length > 0) {
                customRange.offsets.forEach(offset => {
                    anchor = applyOffset(anchor, offset.value, offset.unit);
                });
            } else {
                anchor = applyOffset(anchor, val, unit);
            }

            if (unit === 'day') {
                start = new Date(anchor);
                end = new Date(anchor);
            } else if (unit === 'week') {
                const day = anchor.getDay();
                start = new Date(anchor);
                start.setDate(anchor.getDate() - day);
                end = new Date(start);
                end.setDate(start.getDate() + 6);
            } else if (unit === 'month') {
                start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
                end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
            } else if (unit === 'quarter') {
                const q = Math.floor(anchor.getMonth() / 3);
                start = new Date(anchor.getFullYear(), q * 3, 1);
                end = new Date(anchor.getFullYear(), q * 3 + 3, 0);
            } else if (unit === 'year') {
                start = new Date(anchor.getFullYear(), 0, 1);
                end = new Date(anchor.getFullYear(), 11, 31);
            }
        } else {
            end = new Date(); 
            start = new Date();
            start = applyOffset(start, val, unit);
        }
    } else {
        switch (preset) {
            case 'thisMonth':
                start = new Date(now.getFullYear(), now.getMonth(), 1);
                end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                label = start.toLocaleString('default', { month: 'long', year: 'numeric' });
                break;
            case 'lastMonth':
                start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                end = new Date(now.getFullYear(), now.getMonth(), 0);
                label = start.toLocaleString('default', { month: 'long', year: 'numeric' });
                break;
            case 'thisYear':
                start = new Date(now.getFullYear(), 0, 1);
                end = new Date(now.getFullYear(), 11, 31);
                label = now.getFullYear().toString();
                break;
            case 'lastYear':
                start = new Date(now.getFullYear() - 1, 0, 1);
                end = new Date(now.getFullYear() - 1, 11, 31);
                label = (now.getFullYear() - 1).toString();
                break;
            case 'allTime':
                start = new Date(0); 
                end = new Date();
                label = 'All Time';
                break;
            case 'custom':
                start = customStart ? parseISOLocal(customStart) : new Date();
                end = customEnd ? parseISOLocal(customEnd) : new Date();
                label = `${formatDate(start)} - ${formatDate(end)}`;
                break;
            case 'last3Months':
                end = new Date();
                start = new Date();
                start.setDate(now.getDate() - 90);
                label = 'Last 90 Days';
                break;
            case 'last6Months':
                end = new Date();
                start = new Date();
                start.setMonth(now.getMonth() - 6);
                label = 'Last 6 Months';
                break;
            case 'last12Months':
                end = new Date();
                start = new Date();
                start.setFullYear(now.getFullYear() - 1);
                label = 'Last 12 Months';
                break;
            default:
                if (preset === 'specificMonth' && customStart) {
                     const parts = customStart.split('-');
                    if (parts.length === 2) {
                        const year = parseInt(parts[0], 10);
                        const month = parseInt(parts[1], 10) - 1;
                        start = new Date(year, month, 1);
                        end = new Date(year, month + 1, 0);
                        label = start.toLocaleString('default', { month: 'long', year: 'numeric' });
                    }
                } else if (preset === 'relativeMonth' && customStart) {
                    const offset = parseInt(customStart, 10);
                    start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
                    end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 0);
                    label = `${offset} Months Ago`;
                } else {
                    label = 'Custom Range';
                }
                break;
        }
    }

    return { start: resetTime(start), end: resetTime(end, true), label };
};
