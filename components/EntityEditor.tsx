import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Category, Tag, Counterparty, User, TransactionType, AccountType, Account, BalanceEffect, Location, ReconciliationRule, ParsingProfile } from '../types';
import { generateUUID } from '../utils';
import { SaveIcon, RobotIcon, SparklesIcon, WorkflowIcon, DatabaseIcon, TrashIcon, TableIcon, ShieldCheckIcon, EditIcon, ArrowRightIcon, ListIcon, TagIcon, MapPinIcon, TypeIcon, UsersIcon, InfoIcon, CalendarIcon, DollarSign, ArrowUpIcon, ArrowDownIcon } from './Icons';
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

    // Account Logic Forge State
    const [csvSample, setCsvSample] = useState('');
    const [isForging, setIsForging] = useState(false);
    const [forgeProgress, setForgeProgress] = useState('');
    const [proposedProfile, setProposedProfile] = useState<ParsingProfile | null>(null);
    const isDirtyRef = useRef(false);

    const accountRules = useMemo(() => {
        if (type !== 'accounts' || !initialId) return [];
        return rules.filter(r => r.conditions.some(c => c.field === 'accountId' && c.value === initialId));
    }, [rules, initialId, type]);

    // Robust Initialization: Reset and Load strictly when identity (type or id) changes.
    // This prevents background props refreshes (from broadcast syncs) from wiping out
    // active, unsaved header mapping work.
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
        setProposedProfile(null);
        setCsvSample('');
        isDirtyRef.current = false;
    }, [type, initialId]); // DO NOT include 'accounts' here to avoid background sync resets.

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
        isDirtyRef.current = false;
    };

    const handleForgeLogic = async () => {
        if (!csvSample.trim()) return;
        setIsForging(true);
        try {
            // Use current state to ensure latest metadata is used even if save hasn't been hit
            const tempAccount = { name: name || 'Analysis Target', id: initialId || 'temp' } as Account;
            const { profile } = await analyzeCsvLayout(csvSample, tempAccount, setForgeProgress);
            setProposedProfile(profile);
            isDirtyRef.current = true;
        } catch (e: any) {
            alert(e.message || "Mapping analysis failed.");
        } finally {
            setIsForging(false);
            setForgeProgress('');
        }
    };

    const handleCommitProfile = () => {
        if (proposedProfile) {
            setParsingProfile(proposedProfile);
        }
        setProposedProfile(null);
        alert("Layout consensus staged. Click 'Save Blueprint' above to permanently commit to database.");
    };

    const parentOptions = useMemo(() => {
        if (type === 'categories') return categories.filter(c => c.id !== initialId);
        if (type === 'counterparties') return counterparties.filter(c => c.id !== initialId);
        return [];
    }, [type, categories, counterparties, initialId]);

    const sampleDataRow = useMemo(() => {
        if (!csvSample) return null;
        const lines = csvSample.split('\n').filter(l => l.trim());
        if (lines.length < 2) return null;
        // Detect delimiter based on first line
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
        isDirtyRef.current = true;
        const baseProfile = proposedProfile || parsingProfile || { 
            dateColumn: '', 
            descriptionColumn: '', 
            amountColumn: '', 
            delimiter: sampleDataRow?.headers ? (csvSample.includes('\t') ? '\t' : ',') : ',',
            hasHeader: true 
        };
        
        const nextProfile = { ...baseProfile, [field]: value };
        
        if (proposedProfile) setProposedProfile(nextProfile as ParsingProfile);
        else setParsingProfile(nextProfile as ParsingProfile);
    };

    const renderMapperRow = (label: string, field: keyof ParsingProfile, icon: React.ReactNode) => {
        const currentProfile = proposedProfile || parsingProfile;
        if (!currentProfile && !sampleDataRow) return null;
        
        const currentValue = currentProfile ? String(currentProfile[field] || '') : '';
        
        return (
            <div className="flex items-center gap-6 p-4 bg-white border border-slate-200 rounded-2xl group hover:border-indigo-400 transition-all w-full shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                    {icon}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
                    <div className="flex items-center gap-6 mt-1.5">
                        <div className="w-72">
                            <select 
                                value={currentValue} 
                                onChange={e => handleProfileFieldChange(field, e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm font-bold text-slate-800 focus:ring-1 focus:ring-indigo-500 cursor-pointer outline-none"
                            >
                                <option value="">-- No Mapping --</option>
                                {sampleDataRow?.headers.map((h, i) => (
                                    <option key={i} value={h}>{h}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex-1 min-w-0 flex items-center gap-3 px-4 py-2.5 bg-slate-50/50 rounded-xl border border-slate-100 shadow-inner overflow-hidden">
                            <ArrowRightIcon className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter shrink-0">Live Value:</span>
                            <span className="text-sm font-mono text-indigo-600 truncate font-bold">{getSampleValue(currentValue)}</span>
                        </div>
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
                    <button type="submit" className="px-8 py-2 bg-indigo-600 text-white text-xs font-black uppercase rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 active:scale-95 transition-all flex items-center gap-2">
                        <SaveIcon className="w-4 h-4" /> Save Blueprint
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar bg-slate-50/10">
                <div className="space-y-8 max-w-4xl mx-auto pb-12">
                    <div className="space-y-1">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Identity Label</label>
                        <input type="text" value={name} onChange={e => { setName(e.target.value); isDirtyRef.current = true; }} className="w-full p-4 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:ring-0 font-bold text-slate-800 text-lg shadow-sm" placeholder="Display name..." required autoFocus />
                    </div>

                    {type === 'accounts' && (
                        <div className="space-y-10 animate-fade-in">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-1">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Unique Identifier</label>
                                    <input type="text" value={identifier} onChange={e => { setIdentifier(e.target.value); isDirtyRef.current = true; }} className="w-full p-4 border-2 border-slate-100 rounded-2xl font-bold" placeholder="e.g. Last 4 digits" required />
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Account Category</label>
                                    <select value={accountTypeId} onChange={e => { setAccountTypeId(e.target.value); isDirtyRef.current = true; }} className="w-full p-4 border-2 border-slate-100 rounded-2xl font-bold">
                                        {accountTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-10">
                                {/* HEADER MAPPING WORKSPACE */}
                                <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white space-y-8 shadow-2xl relative overflow-hidden">
                                    <div className="relative z-10 flex justify-between items-center">
                                        <div className="flex items-center gap-3">
                                            <div className="p-3 bg-indigo-50/20 rounded-2xl text-indigo-400 border border-indigo-500/20 shadow-lg"><TableIcon className="w-6 h-6" /></div>
                                            <div>
                                                <h4 className="text-xl font-black tracking-tight">Header Mapping</h4>
                                                <p className="text-[10px] text-indigo-400 font-black uppercase tracking-widest mt-0.5">Physical to Logical Translation</p>
                                            </div>
                                        </div>
                                        {(proposedProfile || csvSample) && (
                                            <button type="button" onClick={() => { setProposedProfile(null); setCsvSample(''); }} className="p-2 bg-white/10 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-full transition-all">
                                                <TrashIcon className="w-5 h-5" />
                                            </button>
                                        )}
                                    </div>

                                    {!proposedProfile && (
                                        <div className="relative z-10 space-y-4 animate-fade-in">
                                            <div className="space-y-2">
                                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Paste Raw CSV Data (Header + Sample Rows)</label>
                                                <textarea 
                                                    value={csvSample} 
                                                    onChange={e => setCsvSample(e.target.value)}
                                                    className="w-full h-48 bg-black/40 border border-white/5 rounded-[1.5rem] p-6 font-mono text-xs text-indigo-100 placeholder:text-slate-700 resize-none outline-none focus:border-indigo-500 transition-all shadow-inner"
                                                    placeholder="Date, Transaction Description, Amount..."
                                                />
                                            </div>
                                            
                                            <button 
                                                type="button"
                                                onClick={handleForgeLogic}
                                                disabled={isForging || !csvSample.trim()}
                                                className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3 disabled:opacity-30 active:scale-95 group"
                                            >
                                                {isForging ? <div className="w-5 h-5 border-4 border-t-white rounded-full animate-spin" /> : <SparklesIcon className="w-5 h-5 group-hover:scale-125 transition-transform" />}
                                                {isForging ? forgeProgress : 'Analyze CSV Layout'}
                                            </button>
                                        </div>
                                    )}

                                    {proposedProfile && (
                                        <div className="relative z-10 space-y-8 animate-slide-up">
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between px-1">
                                                    <h5 className="text-[11px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                                                        <WorkflowIcon className="w-4 h-4" /> Layout Consensus matrix
                                                    </h5>
                                                    <span className="cursor-help" title="Manually verify the column mapping discovered by AI.">
                                                        <InfoIcon className="w-4 h-4 text-slate-500" />
                                                    </span>
                                                </div>
                                                
                                                <div className="space-y-3 bg-black/20 p-6 rounded-[2rem] border border-white/5 shadow-inner">
                                                    <div className="space-y-2">
                                                        {renderMapperRow('Transaction Date', 'dateColumn', <CalendarIcon className="w-5 h-5"/>)}
                                                        {renderMapperRow('Statement Memo', 'descriptionColumn', <EditIcon className="w-5 h-5"/>)}
                                                        {renderMapperRow('Standard Amount', 'amountColumn', <DollarSign className="w-5 h-5"/>)}
                                                        {renderMapperRow('Withdrawal (Debit)', 'debitColumn', <ArrowDownIcon className="w-5 h-5"/>)}
                                                        {renderMapperRow('Deposit (Credit)', 'creditColumn', <ArrowUpIcon className="w-5 h-5"/>)}
                                                        {renderMapperRow('Entity / Payee', 'payeeColumn', <UsersIcon className="w-5 h-5"/>)}
                                                        {renderMapperRow('Ledger Category', 'categoryColumn', <TagIcon className="w-5 h-5"/>)}
                                                        {renderMapperRow('Transaction Type', 'typeColumn', <TypeIcon className="w-5 h-5"/>)}
                                                        {renderMapperRow('City / Location', 'locationColumn', <MapPinIcon className="w-5 h-5"/>)}
                                                        {renderMapperRow('Labels / Tags', 'tagsColumn', <ListIcon className="w-5 h-5"/>)}
                                                        {renderMapperRow('Internal Notes', 'notesColumn', <InfoIcon className="w-5 h-5"/>)}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex gap-4">
                                                <button type="button" onClick={() => setProposedProfile(null)} className="flex-1 py-5 bg-white/5 border border-white/10 text-slate-400 font-black rounded-2xl hover:bg-white/10 transition-all uppercase text-xs tracking-widest">Cancel</button>
                                                <button 
                                                    onClick={handleCommitProfile} 
                                                    className="flex-[2] py-5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-[2rem] shadow-xl transition-all flex items-center justify-center gap-3 active:scale-95 group"
                                                >
                                                    <WorkflowIcon className="w-6 h-6 group-hover:scale-110 transition-transform" /> 
                                                    Commit Mapping
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    <SparklesIcon className="absolute -right-16 -top-16 w-64 h-64 opacity-[0.03] text-indigo-400 pointer-events-none" />
                                </div>

                                {/* PERSISTENT REGISTRY SECTION */}
                                <div className="space-y-6 pt-4 border-t border-slate-200">
                                    <div className="flex items-center justify-between px-1">
                                        <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                            <ShieldCheckIcon className="w-5 h-5 text-indigo-600" /> 
                                            Active Parsing Blueprint
                                        </h4>
                                    </div>

                                    {parsingProfile ? (
                                        <div className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-200 space-y-6 shadow-sm animate-fade-in relative overflow-hidden group">
                                            <div className="flex justify-between items-center relative z-10">
                                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><TableIcon className="w-4 h-4" /> Active Column Map</h4>
                                                <button type="button" onClick={() => { setParsingProfile(undefined); isDirtyRef.current = true; }} className="px-4 py-1.5 bg-slate-100 text-[9px] font-black text-slate-500 hover:text-red-500 rounded-xl border border-slate-200 transition-colors uppercase">Clear Configuration</button>
                                            </div>
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 relative z-10">
                                                {[
                                                    { label: 'Date', val: parsingProfile.dateColumn, icon: <CalendarIcon className="w-3 h-3"/> },
                                                    { label: 'Desc', val: parsingProfile.descriptionColumn, icon: <EditIcon className="w-3 h-3"/> },
                                                    { label: 'Amount', val: parsingProfile.amountColumn, icon: <DollarSign className="w-3 h-3"/> },
                                                    { label: 'Payee', val: parsingProfile.payeeColumn, icon: <UsersIcon className="w-3 h-3"/> },
                                                    { label: 'Type', val: parsingProfile.typeColumn, icon: <TypeIcon className="w-3 h-3"/> },
                                                    { label: 'Category', val: parsingProfile.categoryColumn, icon: <TagIcon className="w-3 h-3"/> },
                                                    { label: 'Location', val: parsingProfile.locationColumn, icon: <MapPinIcon className="w-3 h-3"/> },
                                                    { label: 'Tags', val: parsingProfile.tagsColumn, icon: <ListIcon className="w-3 h-3"/> }
                                                ].filter(f => f.val).map(f => (
                                                    <div key={f.label} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 shadow-inner flex flex-col gap-1">
                                                        <div className="flex items-center gap-1.5 mb-1 opacity-50">
                                                            <span className="text-slate-500">{f.icon}</span>
                                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{f.label}</p>
                                                        </div>
                                                        <p className="text-xs font-black text-slate-800 truncate">{f.val}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : !proposedProfile && (
                                        <div className="p-16 text-center bg-slate-100 rounded-[3rem] border-2 border-dashed border-slate-300">
                                            <TableIcon className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                                            <p className="text-sm text-slate-500 font-bold max-w-xs mx-auto uppercase tracking-wide">Provide a CSV sample above to teach the system how to read this account's statements.</p>
                                        </div>
                                    )}

                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between px-1">
                                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><ShieldCheckIcon className="w-4 h-4" /> Associated Automation Logic</h4>
                                            <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-3 py-1 rounded-full">{accountRules.length} Linked Rules</span>
                                        </div>
                                        {accountRules.length === 0 ? (
                                            <div className="p-10 text-center bg-white rounded-3xl border border-slate-100 italic"><p className="text-xs text-slate-300">No account-specific automation registered.</p></div>
                                        ) : (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                {accountRules.map(r => (
                                                    <div key={r.id} className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-center justify-between group hover:border-indigo-300 transition-all">
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-bold text-slate-700 truncate">{r.name}</p>
                                                            <p className="text-[9px] text-slate-400 font-black uppercase mt-1 tracking-widest">{r.suggestedCategoryName || 'Categorization Applied'}</p>
                                                        </div>
                                                        <button 
                                                            type="button" 
                                                            onClick={() => onDeleteRule?.(r.id)} 
                                                            className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all rounded-lg"
                                                        >
                                                            <TrashIcon className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {(type === 'categories' || type === 'counterparties') && (
                        <div className="space-y-1">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Parent Hierarchy</label>
                            <SearchableSelect options={parentOptions} value={parentId} onChange={setParentId} isHierarchical placeholder="-- No Parent (Root) --" />
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

                    {(type === 'counterparties' || type === 'categories' || type === 'accounts') && (
                        <div className="space-y-1">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Administrative Context</label>
                            <textarea value={notes} onChange={e => { setNotes(e.target.value); isDirtyRef.current = true; }} className="w-full p-6 border-2 border-slate-100 rounded-3xl font-medium min-h-[160px] shadow-inner focus:bg-white transition-all outline-none focus:border-indigo-500" placeholder="Record specific details or institutional logic for this identity..." />
                        </div>
                    )}
                </div>
            </div>
        </form>
    );
};

export default EntityEditor;
