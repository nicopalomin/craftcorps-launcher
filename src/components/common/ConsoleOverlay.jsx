import React from 'react';
import { useTranslation } from 'react-i18next';
import { Terminal, X } from 'lucide-react';

const ConsoleOverlay = ({ logs, onClose, isOpen }) => {
    const { t } = useTranslation();
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-8">
            <div className="bg-slate-900 w-full max-w-4xl h-[600px] rounded-xl border border-slate-700 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="h-10 bg-slate-800 flex items-center justify-between px-4 border-b border-slate-700">
                    <span className="text-sm font-mono text-slate-400 flex items-center gap-2">
                        <Terminal size={14} /> {t('console_title')}
                    </span>
                    <button onClick={onClose} className="text-slate-400 hover:text-white">
                        <X size={16} />
                    </button>
                </div>
                <div className="flex-1 p-4 font-mono text-xs overflow-y-auto space-y-1 bg-slate-950 text-slate-300">
                    {logs.map((log, i) => (
                        <div key={i} className="break-all border-l-2 border-transparent hover:bg-slate-900 hover:border-slate-700 pl-2 py-0.5">
                            <span className="text-emerald-500">[{log.time}]</span> <span className={`
                ${log.type === 'INFO' ? 'text-blue-400' : ''}
                ${log.type === 'WARN' ? 'text-amber-400' : ''}
                ${log.type === 'ERROR' ? 'text-red-400' : ''}
              `}>{log.type}</span>: {log.message}
                        </div>
                    ))}
                    {logs.length === 0 && <span className="text-slate-600 animate-pulse">{t('console_waiting')}</span>}
                </div>
            </div>
        </div>
    );
};

export default ConsoleOverlay;
