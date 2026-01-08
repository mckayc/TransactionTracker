
import React from 'react';
import { CloseIcon, TrashIcon, ExclamationTriangleIcon } from './Icons';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'warning' | 'info';
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ 
    isOpen, onClose, onConfirm, title, message, 
    confirmLabel = 'Confirm', cancelLabel = 'Cancel', 
    variant = 'danger' 
}) => {
    if (!isOpen) return null;

    const variantStyles = {
        danger: {
            iconBg: 'bg-rose-100',
            iconColor: 'text-rose-600',
            btnBg: 'bg-rose-600 hover:bg-rose-700 shadow-rose-100',
            ring: 'focus:ring-rose-500'
        },
        warning: {
            iconBg: 'bg-amber-100',
            iconColor: 'text-amber-600',
            btnBg: 'bg-amber-600 hover:bg-amber-700 shadow-amber-100',
            ring: 'focus:ring-amber-500'
        },
        info: {
            iconBg: 'bg-indigo-100',
            iconColor: 'text-indigo-600',
            btnBg: 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100',
            ring: 'focus:ring-indigo-500'
        }
    };

    const style = variantStyles[variant];

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[250] flex items-center justify-center p-4" onClick={onClose}>
            <div 
                className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-slide-up"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-8 flex flex-col items-center text-center">
                    <div className={`p-4 ${style.iconBg} rounded-full mb-6`}>
                        {variant === 'danger' ? <TrashIcon className={`w-8 h-8 ${style.iconColor}`} /> : <ExclamationTriangleIcon className={`w-8 h-8 ${style.iconColor}`} />}
                    </div>
                    
                    <h3 className="text-2xl font-black text-slate-800 mb-2">{title}</h3>
                    <p className="text-slate-500 text-sm leading-relaxed mb-8">
                        {message}
                    </p>

                    <div className="flex gap-3 w-full">
                        <button 
                            onClick={onClose}
                            className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                        >
                            {cancelLabel}
                        </button>
                        <button 
                            onClick={() => { onConfirm(); onClose(); }}
                            className={`flex-1 py-3 text-white font-black rounded-xl shadow-lg transition-all active:scale-95 ${style.btnBg}`}
                        >
                            {confirmLabel}
                        </button>
                    </div>
                </div>
                
                <div className="bg-slate-50 p-4 border-t border-slate-100 flex justify-center">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                        <ExclamationTriangleIcon className="w-2.5 h-2.5" /> This action cannot be undone
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;
