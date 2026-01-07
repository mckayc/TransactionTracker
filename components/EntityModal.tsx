import React from 'react';
import type { Category, Tag, Counterparty, User, TransactionType, AccountType, Account, Location } from '../types';
import EntityEditor, { EntityType } from './EntityEditor';
import { CloseIcon, BoxIcon, TagIcon, MapPinIcon, UsersIcon, ChecklistIcon, ShieldCheckIcon, CreditCardIcon } from './Icons';

interface EntityModalProps {
    isOpen: boolean;
    onClose: () => void;
    type: EntityType;
    onSave: (type: EntityType, payload: any) => void;
    
    categories: Category[];
    tags: Tag[];
    counterparties: Counterparty[];
    locations: Location[];
    users: User[];
    transactionTypes: TransactionType[];
    accountTypes: AccountType[];
    accounts: Account[];
}

const ICONS: Record<EntityType, React.ReactNode> = {
    categories: <TagIcon className="w-6 h-6" />,
    tags: <TagIcon className="w-6 h-6" />,
    counterparties: <UsersIcon className="w-6 h-6" />,
    locations: <MapPinIcon className="w-6 h-6" />,
    users: <UsersIcon className="w-6 h-6" />,
    transactionTypes: <ChecklistIcon className="w-6 h-6" />,
    accountTypes: <ShieldCheckIcon className="w-6 h-6" />,
    accounts: <CreditCardIcon className="w-6 h-6" />
};

const EntityModal: React.FC<EntityModalProps> = (props) => {
    if (!props.isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col animate-slide-up" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl shadow-sm">{ICONS[props.type]}</div>
                        <div>
                            <h3 className="font-black text-slate-800 text-xl capitalize">Create New {props.type.replace(/([A-Z])/g, ' $1').toLowerCase().slice(0, -1)}</h3>
                            <p className="text-xs text-slate-500 uppercase font-black tracking-widest mt-0.5">Quick Registry</p>
                        </div>
                    </div>
                    <button onClick={props.onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><CloseIcon className="w-6 h-6 text-slate-400"/></button>
                </div>
                
                <div className="p-6">
                    <EntityEditor {...props} initialId={null} onCancel={props.onClose} />
                </div>
            </div>
        </div>
    );
};

export default EntityModal;