
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
