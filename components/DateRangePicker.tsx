import React, { useState, useEffect } from 'react';

interface DateRange {
    key: string;
    start: Date;
    end: Date;
}

interface DateRangePickerProps {
    onChange: (range: DateRange) => void;
}

const formatDateForInput = (date: Date): string => {
    return date.toISOString().split('T')[0];
};

const getDatePresets = (): Record<string, () => { start: Date; end: Date }> => {
    const now = new Date();
    return {
        thisMonth: () => {
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            return { start, end };
        },
        last30: () => {
            const end = new Date();
            const start = new Date();
            start.setDate(now.getDate() - 30);
            return { start, end };
        },
        last90: () => {
            const end = new Date();
            const start = new Date();
            start.setDate(now.getDate() - 90);
            return { start, end };
        },
        thisYear: () => {
            const start = new Date(now.getFullYear(), 0, 1);
            const end = new Date(now.getFullYear(), 11, 31);
            return { start, end };
        },
    };
};

const DateRangePicker: React.FC<DateRangePickerProps> = ({ onChange }) => {
    const [preset, setPreset] = useState('thisMonth');
    const [customStart, setCustomStart] = useState(formatDateForInput(new Date()));
    const [customEnd, setCustomEnd] = useState(formatDateForInput(new Date()));
    
    useEffect(() => {
        let start: Date, end: Date;
        if (preset === 'custom') {
            start = new Date(customStart);
            end = new Date(customEnd);
        } else {
            const presetFunc = getDatePresets()[preset];
            ({ start, end } = presetFunc());
        }
        
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);

        onChange({ key: preset, start, end });

    }, [preset, customStart, customEnd, onChange]);

    return (
        <div>
            <h4 className="font-semibold text-sm mb-2">Date Range</h4>
            <select value={preset} onChange={e => setPreset(e.target.value)}>
                <option value="thisMonth">This Month</option>
                <option value="last30">Last 30 Days</option>
                <option value="last90">Last 90 Days</option>
                <option value="thisYear">This Year</option>
                <option value="custom">Custom</option>
            </select>
            {preset === 'custom' && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                    <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} />
                    <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
                </div>
            )}
        </div>
    );
};

export default DateRangePicker;
