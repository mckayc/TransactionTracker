
import React, { useState, useMemo } from 'react';
import type { Transaction } from '../types';

interface CalendarViewProps {
  transactions: Transaction[];
}

const CalendarView: React.FC<CalendarViewProps> = ({ transactions }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const transactionsByDate = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    transactions.forEach(tx => {
      const dateKey = new Date(tx.date).toDateString();
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)?.push(tx);
    });
    return map;
  }, [transactions]);

  const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  const startDate = new Date(startOfMonth);
  startDate.setDate(startDate.getDate() - startDate.getDay());

  const days = [];
  let day = new Date(startDate);
  while (day <= endOfMonth || days.length % 7 !== 0) {
    days.push(new Date(day));
    day.setDate(day.getDate() + 1);
  }
  
  const handleDateClick = (date: Date) => {
    if (transactionsByDate.has(date.toDateString())) {
        if(selectedDate?.toDateString() === date.toDateString()) {
            setSelectedDate(null); // Toggle off if same date is clicked
        } else {
            setSelectedDate(date);
        }
    }
  };

  const selectedTransactions = selectedDate ? transactionsByDate.get(selectedDate.toDateString()) || [] : [];
  
  return (
    <div className="mt-auto pt-4 border-t border-slate-700">
      <div className="flex items-center justify-between px-2 mb-2">
        <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}>&lt;</button>
        <h3 className="font-semibold text-sm">{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
        <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}>&gt;</button>
      </div>
      <div className="grid grid-cols-7 text-center text-xs">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => <div key={d} className="font-bold">{d}</div>)}
        {days.map((d, i) => {
          const isCurrentMonth = d.getMonth() === currentDate.getMonth();
          const hasTransactions = transactionsByDate.has(d.toDateString());
          return (
            <div key={i} className="relative py-1">
              <button
                onClick={() => handleDateClick(d)}
                disabled={!hasTransactions}
                className={`w-6 h-6 flex items-center justify-center rounded-full mx-auto ${
                  isCurrentMonth ? 'text-slate-200' : 'text-slate-600'
                } ${hasTransactions ? 'cursor-pointer hover:bg-slate-600' : ''} ${
                  selectedDate?.toDateString() === d.toDateString() ? 'bg-indigo-500' : ''
                }`}
              >
                {d.getDate()}
              </button>
              {hasTransactions && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-indigo-400 rounded-full"></div>}
            </div>
          );
        })}
      </div>
      {selectedDate && (
        <div className="mt-2 p-2 bg-slate-900 rounded-md max-h-32 overflow-y-auto">
            <h4 className="text-xs font-bold mb-1">{selectedDate.toLocaleDateString()}</h4>
            {selectedTransactions.length > 0 ? (
                <ul className="text-xs space-y-1">
                    {selectedTransactions.map(tx => (
                        <li key={tx.id} className="flex justify-between">
                            <span className="truncate max-w-[100px]">{tx.description}</span>
                            <span className={tx.amount > 0 ? 'text-green-400' : 'text-red-400'}>
                                {tx.amount.toFixed(2)}
                            </span>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-xs text-slate-400">No transactions.</p>
            )}
        </div>
      )}
    </div>
  );
};

export default CalendarView;
