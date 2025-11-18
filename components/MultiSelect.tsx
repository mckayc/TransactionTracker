import React from 'react';

interface Item {
    id: string;
    name: string;
}

interface MultiSelectProps {
    title: string;
    items: Item[];
    selectedIds: Set<string>;
    onSelectionChange: (newSelectedIds: Set<string>) => void;
}

const MultiSelect: React.FC<MultiSelectProps> = ({ title, items, selectedIds, onSelectionChange }) => {
    const handleToggle = (itemId: string) => {
        const newSelectedIds = new Set(selectedIds);
        if (newSelectedIds.has(itemId)) {
            newSelectedIds.delete(itemId);
        } else {
            newSelectedIds.add(itemId);
        }
        onSelectionChange(newSelectedIds);
    };

    const handleClear = () => {
        onSelectionChange(new Set());
    };

    return (
        <div>
            <div className="flex justify-between items-center">
                <h4 className="font-semibold text-sm">{title}</h4>
                {selectedIds.size > 0 && <button onClick={handleClear} className="text-xs text-indigo-600 hover:underline">Clear</button>}
            </div>
            <div className="mt-2 border rounded-md p-2 max-h-48 overflow-y-auto">
                 <ul className="space-y-1">
                    {items.map(item => (
                        <li key={item.id} className="flex items-center">
                           <input
                              type="checkbox"
                              id={`ms-${item.id}`}
                              checked={selectedIds.has(item.id)}
                              onChange={() => handleToggle(item.id)}
                              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <label htmlFor={`ms-${item.id}`} className="ml-2 text-sm text-slate-800">{item.name}</label>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}

export default MultiSelect;
