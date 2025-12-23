import React from 'react';
import { Loader2, X } from 'lucide-react';

const LaunchOverlay = ({ isOpen, status, progress, onCancel, instanceName }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm transition-all duration-300">
            <div className="w-[480px] bg-slate-900/90 border border-slate-700/50 rounded-2xl p-6 shadow-2xl backdrop-blur-xl animate-in zoom-in-95 fade-in duration-300">

                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                            <Loader2 size={24} className="animate-spin" />
                        </div>
                        <div>
                            <h3 className="font-bold text-white text-lg leading-tight">Launching {instanceName}</h3>
                            <p className="text-xs text-slate-400 font-medium tracking-wider uppercase mt-0.5">Preparing Game Environment</p>
                        </div>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-2">
                    <div className="h-2 w-full bg-slate-950/50 rounded-full overflow-hidden border border-slate-800/50">
                        <div
                            className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-300 ease-out shadow-[0_0_10px_rgba(52,211,153,0.5)]"
                            style={{ width: `${Math.max(2, progress)}%` }}
                        />
                    </div>
                </div>

                {/* Status Text */}
                <div className="flex justify-between text-xs mb-6">
                    <span className="text-slate-400 truncate max-w-[340px] font-medium">{status || 'Initializing...'}</span>
                    <span className="text-emerald-500 font-mono font-bold">{progress}%</span>
                </div>

                {/* Action Button */}
                <div className="flex justify-center">
                    <button
                        onClick={onCancel}
                        className="px-6 py-2 rounded-lg bg-slate-800 hover:bg-red-500/10 hover:text-red-400 text-slate-400 text-sm font-medium transition-all duration-200 border border-slate-700 hover:border-red-500/30 flex items-center gap-2"
                    >
                        <X size={14} /> Cancel Launch
                    </button>
                </div>

            </div>
        </div>
    );
};

export default LaunchOverlay;
