import React from 'react';
import { useTranslation } from 'react-i18next';
import { Terminal, X } from 'lucide-react';

const ConsoleOverlay = ({ logs, onClose, isOpen }) => {
    const { t } = useTranslation();
    const scrollRef = React.useRef(null);
    const [autoScroll, setAutoScroll] = React.useState(true);

    // Optimized Auto-scroll logic
    React.useEffect(() => {
        if (autoScroll && scrollRef.current && isOpen) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs, isOpen, autoScroll]);

    // Handle manual scroll to toggle auto-scroll
    const handleScroll = (e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.target;
        const isBottom = scrollHeight - scrollTop <= clientHeight + 100;
        setAutoScroll(isBottom);
    };

    if (!isOpen) return null;

    // To prevent severe lag with thousands of logs, we only render the last 1500 lines
    // This is a simple form of virtualization
    const visibleLogs = logs.length > 1500 ? logs.slice(-1500) : logs;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 lg:p-8">
            <div className="bg-slate-900 w-full max-w-5xl h-[80vh] rounded-2xl border border-white/10 shadow-3xl flex flex-col overflow-hidden animate-in zoom-in-95 fade-in duration-300">
                <div className="h-12 bg-slate-800/80 backdrop-blur-md flex items-center justify-between px-6 border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-xs font-bold tracking-widest uppercase text-slate-400 flex items-center gap-2">
                            <Terminal size={14} className="text-emerald-500" /> {t('console_title')}
                        </span>
                        {logs.length > 0 && (
                            <span className="text-[10px] bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full font-mono">
                                {logs.length} lines
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-4">
                        {!autoScroll && (
                            <button
                                onClick={() => setAutoScroll(true)}
                                className="text-[10px] font-bold uppercase tracking-tighter text-emerald-500 hover:text-emerald-400 transition-colors"
                            >
                                Resume Auto-scroll
                            </button>
                        )}
                        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all">
                            <X size={18} />
                        </button>
                    </div>
                </div>
                <div
                    ref={scrollRef}
                    onScroll={handleScroll}
                    className="flex-1 p-6 font-mono text-[11px] overflow-y-auto space-y-0.5 bg-slate-950 text-slate-300 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent"
                >
                    {logs.length > 1500 && (
                        <div className="py-2 text-slate-500 italic text-[10px] border-b border-white/5 mb-4">
                            Truncated to last 1500 lines for performance...
                        </div>
                    )}
                    {visibleLogs.map((log, i) => (
                        <div key={i} className="group flex gap-3 break-all border-l-2 border-transparent hover:bg-white/[0.02] hover:border-slate-700 pl-3 py-0.5 transition-colors">
                            <span className="text-slate-600 shrink-0 select-none opacity-50 font-light w-16">[{log.time}]</span>
                            <span className={`font-bold shrink-0 w-12
                                ${log.type === 'INFO' ? 'text-blue-500' : ''}
                                ${log.type === 'WARN' ? 'text-amber-500' : ''}
                                ${log.type === 'ERROR' ? 'text-red-500' : ''}
                            `}>{log.type}</span>
                            <span className="flex-1 leading-relaxed">{log.message}</span>
                        </div>
                    ))}
                    {logs.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-600">
                            <Terminal size={40} className="opacity-20 translate-y-4" />
                            <span className="animate-pulse text-[10px] font-bold tracking-widest uppercase">{t('console_waiting')}</span>
                        </div>
                    )}
                </div>
                <div className="h-2 bg-slate-950/50" />
            </div>
        </div>
    );
};

export default ConsoleOverlay;
