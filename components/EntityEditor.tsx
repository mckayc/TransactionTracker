import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Category, Tag, Counterparty, User, TransactionType, AccountType, Account, BalanceEffect, Location, ReconciliationRule, ParsingProfile } from '../types';
import { generateUUID } from '../utils';
import { SaveIcon, RobotIcon, SparklesIcon, WorkflowIcon, DatabaseIcon, TrashIcon, TableIcon, ShieldCheckIcon, EditIcon, ArrowRightIcon, ListIcon, TagIcon, MapPinIcon, TypeIcon, UsersIcon, InfoIcon, CalendarIcon, DollarSign, ArrowUpIcon, ArrowDownIcon, CloseIcon, CheckCircleIcon } from './Icons';
import SearchableSelect from './SearchableSelect';
import { analyzeCsvLayout } from '../services/geminiService';

export type EntityType = 'categories' | 'tags' | 'counterparties' | 'locations' | 'users' | 'transactionTypes' | 'accountTypes' | 'accounts';

interface EntityEditorProps {
    type: EntityType;
    initialId?: string | null;
    onSave: (type: EntityType, payload: any) => void;
    onCancel: () => void;
    categories: Category[];
    tags: Tag[];
    counterparties: Counterparty[];
    locations: Location[];
    users: User[];
    transactionTypes: TransactionType[];
    accountTypes: AccountType[];
    accounts: Account[];
    rules?: ReconciliationRule[];
    onSaveRules?: (rules: ReconciliationRule[]) => void;
    onDeleteRule?: (id: string) => void;
}

const EntityEditor: React.FC<EntityEditorProps> = ({ 
    type, initialId, onSave, onCancel,
    categories, tags, counterparties, locations, users, transactionTypes, accountTypes, accounts, rules = [],
    onDeleteRule
}) => {
    const [name, setName] = useState('');
    const [parentId, setParentId] = useState('');
    const [color, setColor] = useState('bg-slate-100 text-slate-800');
    const [notes, setNotes] = useState('');
    const [userId, setUserId] = useState('');
    const [city, setCity] = useState('');
    const [state, setState] = useState('');
    const [country, setCountry] = useState('');
    const [balanceEffect, setBalanceEffect] = useState<BalanceEffect>('outgoing');
    const [identifier, setIdentifier] = useState('');
    const [accountTypeId, setAccountTypeId] = useState('');
    const [parsingProfile, setParsingProfile] = useState<ParsingProfile | undefined>(undefined);

    // Feedback State
    const [isSuccess, setIsSuccess] = useState(false);

    // Account Logic Forge State
    const [csvSample, setCsvSample] = useState('');
    const [isForging, setIsForging] = useState(false);
    const [forgeProgress, setForgeProgress] = useState('');
    const [isDirty, setIsDirty] = useState(false);

    const accountRules = useMemo(() => {
        if (type !== 'accounts' || !initialId) return [];
        return rules.filter(r => r.conditions.some(c => c.field === 'accountId' && c.value === initialId));
    }, [rules, initialId, type]);

    const parentOptions = useMemo(() => {
        if (type === 'categories') return categories.filter(c => c.id !== initialId);
        if (type === 'counterparties') return counterparties.filter(p => p.id !== initialId);
        return [];
    }, [type, categories, counterparties, initialId]);

    useEffect(() => {
        let list: any[] = [];
        switch (type) {
            case 'categories': list = categories; break;
            case 'tags': list = tags; break;
            case 'counterparties': list = counterparties; break;
            case 'locations': list = locations; break;
            case 'users': list = users; break;
            case 'transactionTypes': list = transactionTypes; break;
            case 'accountTypes': list = accountTypes; break;
            case 'accounts': list = accounts; break;
        }

        const item = list.find(x => x.id === initialId);
        if (item) {
            setName(item.name || '');
            if (type === 'categories') setParentId(item.parentId || '');
            else if (type === 'tags') setColor(item.color);
            else if (type === 'counterparties') { setParentId(item.parentId || ''); setNotes(item.notes || ''); setUserId(item.userId || ''); }
            else if (type === 'locations') { setCity(item.city || ''); setState(item.state || ''); setCountry(item.country || ''); }
            else if (type === 'transactionTypes') { setBalanceEffect(item.balanceEffect || 'outgoing'); setColor(item.color || 'text-slate-600'); }
            else if (type === 'accounts') { 
                setIdentifier(item.identifier || ''); 
                setAccountTypeId(item.accountTypeId || ''); 
                setParsingProfile(item.parsingProfile || undefined);
            }
        } else {
            setName('');
            setParentId('');
            setCity('');
            setState('');
            setCountry('');
            setNotes('');
            setIdentifier('');
            setAccountTypeId(accountTypes[0]?.id || '');
            setUserId(users.find(u => u.isDefault)?.id || users[0]?.id || '');
            setBalanceEffect('outgoing');
            setColor(type === 'transactionTypes' ? 'text-rose-600' : 'bg-slate-50 text-slate-600');
            setParsingProfile(undefined);
        }
        setCsvSample('');
        setIsDirty(false);
        setIsSuccess(false);
    }, [type, initialId]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const id = initialId || generateUUID();
        const payload: any = { id, name: name.trim() };
        switch (type) {
            case 'categories': Object.assign(payload, { parentId: parentId || undefined }); break;
            case 'tags': Object.assign(payload, { color }); break;
            case 'counterparties': Object.assign(payload, { parentId: parentId || undefined, notes: notes || undefined, userId: userId || undefined }); break;
            case 'locations': Object.assign(payload, { city, state, country }); break;
            case 'transactionTypes': Object.assign(payload, { balanceEffect, color }); break;
            case 'accounts': Object.assign(payload, { identifier, accountTypeId, parsingProfile }); break;
        }
        onSave(type, payload);
        setIsDirty(false);
        setIsSuccess(true);
        setTimeout(() => setIsSuccess(false), 2500);
    };

    const handleForgeLogic = async () => {
        if (!csvSample.trim()) return;
        setIsForging(true);
        try {
            const tempAccount = { name: name || 'Analysis Target', id: initialId || 'temp' } as Account;
            const { profile } = await analyzeCsvLayout(csvSample, tempAccount, setForgeProgress);
            setParsingProfile(profile);
            setIsDirty(true);
            setCsvSample('');
        } catch (e: any) {
            alert(e.message || "Mapping analysis failed.");
        } finally {
            setIsForging(false);
            setForgeProgress('');
        }
    };

    const sampleDataRow = useMemo(() => {
        if (!csvSample) return null;
        const lines = csvSample.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) return null;
        const delimiter = lines[0].includes('\t') ? '\t' : (lines[0].includes(';') ? ';' : ',');
        const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
        const row = lines[1].split(delimiter).map(v => v.trim().replace(/^"|"$/g, ''));
        return { headers, row };
    }, [csvSample]);

    const getSampleValue = (headerName: string | number) => {
        if (!sampleDataRow) return '---';
        const idx = typeof headerName === 'number' 
            ? headerName 
            : sampleDataRow.headers.findIndex(h => h.toLowerCase() === String(headerName).toLowerCase());
        return sampleDataRow.row[idx] || '---';
    };

    const handleProfileFieldChange = (field: keyof ParsingProfile, value: any) => {
        setIsDirty(true);
        const baseProfile = parsingProfile || { 
            dateColumn: '', 
            descriptionColumn: '', 
            amountColumn: '', 
            delimiter: ',',
            hasHeader: true 
        };
        setParsingProfile({ ...baseProfile, [field]: value });
    };

    const renderMapperRow = (label: string, field: keyof ParsingProfile, icon: React.ReactNode) => {
        const currentValue = parsingProfile ? String(parsingProfile[field] || '') : '';
        
        return (
            <div className="flex items-center gap-3 p-2 bg-white border border-slate-100 rounded-xl group hover:border-indigo-300 transition-all w-full shadow-sm">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                    {icon}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                        <div className="flex-1 min-w-0">
                            <select 
                                value={currentValue} 
                                onChange={e => handleProfileFieldChange(field, e.target.value)}
                                className="w-full bg-slate-50 border-none rounded-lg p-1.5 text-[11px] font-bold text-slate-700 cursor-pointer outline-none focus:ring-1 focus:ring-indigo-500"
                            >
                                <option value="">-- No Mapping --</option>
                                {sampleDataRow?.headers.map((h, i) => (
                                    <option key={i} value={h}>{h}</option>
                                ))}
                                {/* If no sample is loaded but a mapping exists, show it as an option */}
                                {currentValue && !sampleDataRow?.headers.includes(currentValue) && (
                                    <option value={currentValue}>{currentValue} (Saved)</option>
                                )}
                            </select>
                        </div>
                        {sampleDataRow && (
                            <div className="flex-1 min-w-0 flex items-center gap-1.5 px-2 py-1 bg-indigo-50/30 rounded-lg border border-indigo-50 overflow-hidden">
                                <span className="text-[7px] font-black text-indigo-400 uppercase shrink-0">Sample:</span>
                                <span className="text-[10px] font-mono text-indigo-600 truncate font-bold">{getSampleValue(currentValue)}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-full relative">
            <div className="sticky top-0 p-4 border-b bg-white/95 backdrop-blur-sm flex justify-between items-center z-30 shadow-sm">
                <div className="flex items-center gap-2">
                    <button type="button" onClick={onCancel} className="px-4 py-2 text-xs font-black uppercase text-slate-400 hover:bg-slate-100 rounded-xl transition-all">Discard</button>
                </div>
                <div className="flex items-center gap-3">
                    <button type="submit" className={`px-8 py-2 text-white text-xs font-black uppercase rounded-xl shadow-lg transition-all flex items-center gap-2 active:scale-95 ${isSuccess ? 'bg-emerald-600 shadow-emerald-100' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100'}`}>
                        {isSuccess ? <CheckCircleIcon className="w-4 h-4" /> : <SaveIcon className="w-4 h-4" />}
                        {isSuccess ? 'Blueprint Saved' : `Save ${type.slice(0, -1)}`}
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-50/10">
                <div className="max-w-4xl mx-auto space-y-6 pb-12">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Identity Label</label>
                            <input type="text" value={name} onChange={e => { setName(e.target.value); setIsDirty(true); }} className="w-full p-3 border-2 border-slate-100 rounded-xl focus:border-indigo-500 focus:ring-0 font-bold text-slate-800 shadow-sm" placeholder="Display name..." required autoFocus />
                        </div>
                        {type === 'accounts' && (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ID (Last 4)</label>
                                    <input type="text" value={identifier} onChange={e => { setIdentifier(e.target.value); setIsDirty(true); }} className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold" placeholder="0000" required />
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Category</label>
                                    <select value={accountTypeId} onChange={e => { setAccountTypeId(e.target.value); setIsDirty(true); }} className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold text-xs">
                                        {accountTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                </div>
                            </div>
                        )}
                    </div>

                    {type === 'accounts' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="bg-slate-900 rounded-[2rem] p-6 text-white space-y-6 shadow-xl relative overflow-hidden">
                                <div className="relative z-10 flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-indigo-500/20 rounded-xl text-indigo-400 border border-indigo-500/20 shadow-lg"><TableIcon className="w-5 h-5" /></div>
                                        <div>
                                            <h4 className="text-lg font-black tracking-tight">Header Mapping</h4>
                                            <p className="text-[9px] text-indigo-400 font-black uppercase tracking-widest mt-0.5">Logical Translation Grid</p>
                                        </div>
                                    </div>
                                    <button 
                                        type="button" 
                                        onClick={() => setCsvSample(csvSample ? '' : ' ')} 
                                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${csvSample ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white/10 hover:bg-white/20'}`}
                                    >
                                        <SparklesIcon className="w-3 h-3" />
                                        {csvSample ? 'Cancel Sample' : 'Load CSV Sample'}
                                    </button>
                                </div>

                                {csvSample && (
                                    <div className="relative z-10 space-y-4 animate-fade-in bg-black/30 p-4 rounded-2xl border border-white/5 shadow-inner">
                                        <div className="space-y-2">
                                            <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">Paste Raw CSV Rows (Header + Data)</label>
                                            <textarea 
                                                value={csvSample.trim()} 
                                                onChange={e => setCsvSample(e.target.value)}
                                                className="w-full h-24 bg-black/40 border border-white/5 rounded-xl p-3 font-mono text-[10px] text-indigo-100 placeholder:text-slate-700 resize-none outline-none focus:border-indigo-500 transition-all"
                                                placeholder="Date, Description, Amount..."
                                            />
                                        </div>
                                        <button 
                                            type="button"
                                            onClick={handleForgeLogic}
                                            disabled={isForging || !csvSample.trim()}
                                            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-30 text-[10px] uppercase"
                                        >
                                            {isForging ? <div className="w-4 h-4 border-2 border-t-white rounded-full animate-spin" /> : <RobotIcon className="w-4 h-4" />}
                                            {isForging ? forgeProgress : 'Analyze with Gemini AI'}
                                        </button>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 relative z-10">
                                    {renderMapperRow('Transaction Date', 'dateColumn', <CalendarIcon className="w-4 h-4"/>)}
                                    {renderMapperRow('Statement Memo', 'descriptionColumn', <EditIcon className="w-4 h-4"/>)}
                                    {renderMapperRow('Standard Amount', 'amountColumn', <DollarSign className="w-4 h-4"/>)}
                                    {renderMapperRow('Withdrawal (Debit)', 'debitColumn', <ArrowDownIcon className="w-4 h-4"/>)}
                                    {renderMapperRow('Deposit (Credit)', 'creditColumn', <ArrowUpIcon className="w-4 h-4"/>)}
                                    {renderMapperRow('Entity / Payee', 'payeeColumn', <UsersIcon className="w-4 h-4"/>)}
                                    {renderMapperRow('Ledger Category', 'categoryColumn', <TagIcon className="w-4 h-4"/>)}
                                    {renderMapperRow('Transaction Type', 'typeColumn', <TypeIcon className="w-4 h-4"/>)}
                                    {renderMapperRow('City / Location', 'locationColumn', <MapPinIcon className="w-4 h-4"/>)}
                                    {renderMapperRow('Labels / Tags', 'tagsColumn', <ListIcon className="w-4 h-4"/>)}
                                </div>
                                
                                <SparklesIcon className="absolute -right-12 -top-12 w-48 h-48 opacity-[0.03] text-indigo-400 pointer-events-none" />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><ShieldCheckIcon className="w-4 h-4 text-indigo-500" /> Linked Automation</label>
                                    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                                        {accountRules.length === 0 ? (
                                            <div className="p-8 text-center text-slate-400 italic text-[11px]">No account-specific logic found.</div>
                                        ) : (
                                            <div className="divide-y divide-slate-100">
                                                {accountRules.map(r => (
                                                    <div key={r.id} className="p-3 flex justify-between items-center group hover:bg-slate-50">
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-bold text-slate-700 truncate">{r.name}</p>
                                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{r.suggestedCategoryName || 'Categorization'}</p>
                                                        </div>
                                                        <button type="button" onClick={() => onDeleteRule?.(r.id)} className="p-1.5 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><TrashIcon className="w-3.5 h-3.5"/></button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><ListIcon className="w-4 h-4 text-indigo-500" /> Administrative Context</label>
                                    <textarea 
                                        value={notes} 
                                        onChange={e => { setNotes(e.target.value); setIsDirty(true); }} 
                                        className="w-full p-4 border-2 border-slate-100 rounded-2xl text-xs font-medium bg-white h-[140px] focus:border-indigo-500 outline-none shadow-inner" 
                                        placeholder="Note institutional logic or bank contact details..." 
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {(type === 'categories' || type === 'counterparties') && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Parent Hierarchy</label>
                                <SearchableSelect options={parentOptions} value={parentId} onChange={setParentId} isHierarchical placeholder="-- No Parent (Root) --" />
                            </div>
                            {type === 'counterparties' && (
                                <div className="space-y-1">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Ledger Owner</label>
                                    <SearchableSelect options={users} value={userId} onChange={setUserId} placeholder="Select identity..." />
                                </div>
                            )}
                        </div>
                    )}

                    {type === 'tags' && (
                        <div className="space-y-2">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Symbol Hue</label>
                            <div className="flex flex-wrap gap-2 p-4 bg-white rounded-2xl border border-slate-100 shadow-inner">
                                {['bg-slate-100 text-slate-800', 'bg-red-100 text-red-800', 'bg-orange-100 text-orange-800', 'bg-amber-100 text-amber-800', 'bg-green-100 text-green-800', 'bg-emerald-100 text-emerald-800', 'bg-blue-100 text-blue-800', 'bg-indigo-100 text-indigo-800', 'bg-purple-100 text-purple-800'].map(c => (
                                    <button key={c} type="button" onClick={() => setColor(c)} className={`w-10 h-10 rounded-full border-2 transition-all ${color === c ? 'border-indigo-600 scale-110 shadow-md ring-4 ring-indigo-50' : 'border-slate-100 opacity-60 hover:opacity-100'}`} style={{ backgroundColor: c.split(' ')[0].replace('bg-', '') }} />
                                ))}
                            </div>
                        </div>
                    )}

                    {(type !== 'accounts') && (
                        <div className="space-y-1">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Administrative Context</label>
                            <textarea value={notes} onChange={e => { setNotes(e.target.value); setIsDirty(true); }} className="w-full p-4 border-2 border-slate-100 rounded-xl font-medium min-h-[120px] shadow-inner focus:bg-white transition-all outline-none focus:border-indigo-500 text-sm" placeholder="Record specific details or institutional memory..." />
                        </div>
                    )}
                </div>
            </div>
        </form>
    );
};

export default EntityEditor;
