
import type { RecurrenceRule } from './types';

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
    const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    
    const interval = rule.interval && rule.interval > 0 ? rule.interval : 1;

    switch (rule.frequency) {
        case 'daily':
            date.setDate(date.getDate() + interval);
            break;
        case 'weekly':
            date.setDate(date.getDate() + (interval * 7));
            break;
        case 'monthly':
            date.setMonth(date.getMonth() + interval);
            break;
        case 'yearly':
            date.setFullYear(date.getFullYear() + interval);
            break;
    }
    
    return formatDate(date);
};

/**
 * Returns today's date in YYYY-MM-DD format.
 */
export const getTodayDate = (): string => {
    return formatDate(new Date());
};
