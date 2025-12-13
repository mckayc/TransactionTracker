import type { RecurrenceRule, DateRangeUnit, DateRangePreset, CustomDateRange } from './types';

/**
 * Formats a date object or string to YYYY-MM-DD format.
 * This is the standard display format for the application.
 */
export const formatDate = (date: Date | string): string => {
    if (!date) return '';
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
 * @param currentDateStr The current due date string (YYYY-MM-DD)
 * @param rule The recurrence rule configuration
 * @returns The next date string (YYYY-MM-DD)
 */
export const calculateNextDate = (currentDateStr: string, rule: RecurrenceRule): string => {
    // Parse YYYY-MM-DD explicitly to avoid timezone shifts
    const parts = currentDateStr.split('-');
    const current = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    
    const interval = rule.interval && rule.interval > 0 ? rule.interval : 1;

    switch (rule.frequency) {
        case 'daily':
            current.setDate(current.getDate() + interval);
            break;
            
        case 'weekly':
            if (rule.byWeekDays && rule.byWeekDays.length > 0) {
                // Find the next occurrence of one of the specified days
                // Sort days (0-6)
                const targetDays = [...rule.byWeekDays].sort((a, b) => a - b);
                const currentDay = current.getDay();
                
                // Check if there is a remaining day in the *current* week
                const nextDayInWeek = targetDays.find(d => d > currentDay);
                
                if (nextDayInWeek !== undefined) {
                    // Same week, just move to that day
                    const diff = nextDayInWeek - currentDay;
                    current.setDate(current.getDate() + diff);
                } else {
                    // Next week (or next interval weeks), first available day
                    const daysUntilNextWeek = 7 - currentDay; // Days to finish current week
                    const daysToFirstTarget = targetDays[0]; // Days from Sunday to target
                    // Add interval - 1 weeks (since we are crossing a week boundary)
                    const weeksToAdd = Math.max(0, interval - 1);
                    
                    current.setDate(current.getDate() + daysUntilNextWeek + (weeksToAdd * 7) + daysToFirstTarget);
                }
            } else {
                // Simple interval
                current.setDate(current.getDate() + (interval * 7));
            }
            break;
            
        case 'monthly':
            // Logic for "First Day", "Last Day", or "Specific Day"
            // Move forward by interval months first
            current.setMonth(current.getMonth() + interval);
            
            if (rule.byMonthDay !== undefined) {
                if (rule.byMonthDay === -1) {
                    // Last day of the month: Move to 1st of next month, then subtract 1 day
                    current.setMonth(current.getMonth() + 1, 0); 
                } else {
                    // Specific day (e.g. 1st, 15th)
                    // Ensure valid day (e.g. don't set Feb 30th)
                    const maxDays = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
                    const dayToSet = Math.min(rule.byMonthDay, maxDays);
                    current.setDate(dayToSet);
                }
            }
            // If no byMonthDay, it keeps the relative day from the original date (standard setMonth behavior)
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
        case 'day':
            d.setDate(d.getDate() - value);
            break;
        case 'week':
            d.setDate(d.getDate() - (value * 7));
            break;
        case 'month':
            d.setMonth(d.getMonth() - value);
            break;
        case 'quarter':
            d.setMonth(d.getMonth() - (value * 3));
            break;
        case 'year':
            d.setFullYear(d.getFullYear() - value);
            break;
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
                start = customStart ? new Date(customStart) : new Date();
                end = customEnd ? new Date(customEnd) : new Date();
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