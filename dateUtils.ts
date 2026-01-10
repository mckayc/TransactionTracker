
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
 */
export const formatDate = (date: Date | string): string => {
    if (!date) return '';
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return date;
    }
    const d = new Date(date);
    if (isNaN(d.getTime())) return String(date);
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Gets the ISO week number for a date.
 */
export const getWeekNumber = (d: Date): number => {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

/**
 * Robustly determines the label for a date range based on its scale.
 */
export const getScaleLabel = (start: Date, end: Date): string => {
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    const isFirstOfMonth = start.getDate() === 1;
    const isLastOfMonth = end.getDate() === new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate();
    
    const isFullYear = isFirstOfMonth && isLastOfMonth && start.getMonth() === 0 && end.getMonth() === 11;
    
    const isFullQuarter = isFirstOfMonth && isLastOfMonth && 
                         (start.getMonth() % 3 === 0) &&
                         (end.getMonth() === start.getMonth() + 2);

    const isFullMonth = isFirstOfMonth && isLastOfMonth && start.getMonth() === end.getMonth();

    const isFullWeek = diffDays === 6; 

    if (isFullYear) {
        return `${start.getFullYear()}`;
    }
    if (isFullQuarter) {
        const q = Math.floor(start.getMonth() / 3) + 1;
        return `Q${q}, ${start.getFullYear()}`;
    }
    if (isFullMonth) {
        return start.toLocaleString('default', { month: 'long', year: 'numeric' });
    }
    if (isFullWeek) {
        const weekNum = getWeekNumber(start);
        return `${weekNum}/52, ${start.getFullYear()}`;
    }

    return `${formatDate(start)} - ${formatDate(end)}`;
};

/**
 * Shifts a date range forward or backward based on its current duration and scale.
 */
export const shiftDateRange = (start: Date, end: Date, direction: 'prev' | 'next'): { start: Date, end: Date } => {
    const newStart = new Date(start);
    newStart.setHours(0,0,0,0);
    const newEnd = new Date(end);
    newEnd.setHours(0,0,0,0);
    const dir = direction === 'next' ? 1 : -1;
    
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    const isFirstOfMonth = start.getDate() === 1;
    const isLastOfMonth = end.getDate() === new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate();

    const isFullYear = isFirstOfMonth && isLastOfMonth && start.getMonth() === 0 && end.getMonth() === 11;
    
    const isFullQuarter = isFirstOfMonth && isLastOfMonth && 
                         (start.getMonth() % 3 === 0) &&
                         (end.getMonth() === start.getMonth() + 2);

    const isFullMonth = isFirstOfMonth && isLastOfMonth && start.getMonth() === end.getMonth();

    const isFullWeek = diffDays === 6;

    if (isFullYear) {
        newStart.setFullYear(start.getFullYear() + dir);
        newEnd.setFullYear(newStart.getFullYear());
        newEnd.setMonth(0, 1); // Reset to Jan 1
        newEnd.setMonth(11, 31); // Then Dec 31
    } else if (isFullQuarter) {
        newStart.setMonth(start.getMonth() + (dir * 3), 1);
        const qEnd = new Date(newStart.getFullYear(), newStart.getMonth() + 3, 0);
        newEnd.setTime(qEnd.getTime());
    } else if (isFullMonth) {
        newStart.setMonth(start.getMonth() + dir, 1);
        const mEnd = new Date(newStart.getFullYear(), newStart.getMonth() + 1, 0);
        newEnd.setTime(mEnd.getTime());
    } else if (isFullWeek) {
        newStart.setDate(start.getDate() + (dir * 7));
        newEnd.setDate(end.getDate() + (dir * 7));
    } else {
        const offsetDays = (diffDays + 1) * dir;
        newStart.setDate(start.getDate() + offsetDays);
        newEnd.setDate(end.getDate() + offsetDays);
    }

    newStart.setHours(0,0,0,0);
    newEnd.setHours(23,59,59,999);
    return { start: newStart, end: newEnd };
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

export const calculateDateRange = (preset: DateRangePreset | string, customStart: string | undefined, customEnd: string | undefined, savedRanges: CustomDateRange[]): { start: Date, end: Date, label: string } => {
    const now = new Date();
    let start = new Date();
    let end = new Date();
    
    const resetTime = (d: Date, endOfDay = false) => {
        if (endOfDay) d.setHours(23, 59, 59, 999);
        else d.setHours(0, 0, 0, 0);
        return d;
    };

    const customRange = savedRanges.find(r => r.id === preset);

    if (customRange) {
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
            if (unit === 'day') { start = new Date(anchor); end = new Date(anchor); }
            else if (unit === 'week') { const day = anchor.getDay(); start = new Date(anchor); start.setDate(anchor.getDate() - day); end = new Date(start); end.setDate(start.getDate() + 6); }
            else if (unit === 'month') { start = new Date(anchor.getFullYear(), anchor.getMonth(), 1); end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0); }
            else if (unit === 'quarter') { const q = Math.floor(anchor.getMonth() / 3); start = new Date(anchor.getFullYear(), q * 3, 1); end = new Date(anchor.getFullYear(), q * 3 + 3, 0); }
            else if (unit === 'year') { start = new Date(anchor.getFullYear(), 0, 1); end = new Date(anchor.getFullYear(), 11, 31); }
        } else {
            end = new Date(); start = new Date(); start = applyOffset(start, val, unit);
        }
    } else {
        switch (preset) {
            case 'thisMonth':
                start = new Date(now.getFullYear(), now.getMonth(), 1);
                end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                break;
            case 'lastMonth':
                start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                end = new Date(now.getFullYear(), now.getMonth(), 0);
                break;
            case 'thisYear':
                start = new Date(now.getFullYear(), 0, 1);
                end = new Date(now.getFullYear(), 11, 31);
                break;
            case 'lastYear':
                start = new Date(now.getFullYear() - 1, 0, 1);
                end = new Date(now.getFullYear() - 1, 11, 31);
                break;
            case 'allTime':
                start = new Date(0); end = new Date();
                break;
            case 'custom':
                start = customStart ? parseISOLocal(customStart) : new Date();
                end = customEnd ? parseISOLocal(customEnd) : new Date();
                break;
            case 'last30Days':
                end = new Date(); start = new Date(); start.setDate(now.getDate() - 29);
                break;
            case 'last3Months':
                end = new Date(); start = new Date(); start.setDate(now.getDate() - 90);
                break;
            case 'last6Months':
                end = new Date(); start = new Date(); start.setMonth(now.getMonth() - 6);
                break;
            case 'last12Months':
                end = new Date(); start = new Date(); start.setFullYear(now.getFullYear() - 1);
                break;
            default:
                if (preset === 'specificMonth' && customStart) {
                     const parts = customStart.split('-');
                    if (parts.length === 2) {
                        const year = parseInt(parts[0], 10);
                        const month = parseInt(parts[1], 10) - 1;
                        start = new Date(year, month, 1);
                        end = new Date(year, month + 1, 0);
                    }
                } else if (preset === 'relativeMonth' && customStart) {
                    const offset = parseInt(customStart, 10);
                    start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
                    end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 0);
                }
                break;
        }
    }

    const finalStart = resetTime(start);
    const finalEnd = resetTime(end, true);
    return { start: finalStart, end: finalEnd, label: getScaleLabel(finalStart, finalEnd) };
};
