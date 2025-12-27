import React, { useEffect, useState } from 'react';
import { X, AlertTriangle, ShieldAlert, WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const ErrorModal = ({ isOpen, onClose, error }) => {
    const { t } = useTranslation();
    const [animate, setAnimate] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setAnimate(true);
        } else {
            setAnimate(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    // Determine Icon based on error summary keywords
    let Icon = AlertTriangle;
    let colorClass = "text-amber-500";
    let bgClass = "bg-amber-500/10";
    let borderClass = "border-amber-500/20";

    if (error?.summary) {
        const s = error.summary.toLowerCase();
        if (s.includes('permission') || s.includes('access')) {
            Icon = ShieldAlert;
            colorClass = "text-red-500";
            bgClass = "bg-red-500/10";
            borderClass = "border-red-500/20";
        } else if (s.includes('network') || s.includes('connect')) {
            Icon = WifiOff;
            colorClass = "text-rose-400";
            bgClass = "bg-rose-500/10";
            borderClass = "border-rose-500/20";
        }
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
                onClick={onClose}
            />

            {/* Modal */}
            <div className={`relative w-full max-w-md bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden transform transition-all duration-300 ${animate ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-4'}`}>

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/50">
                    <h3 className="font-bold text-white flex items-center gap-2">
                        <Icon size={20} className={colorClass} />
                        {t('error_launch_title', 'Launch Error')}
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-1 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    <div className={`p-4 rounded-xl ${bgClass} ${borderClass} border mb-6`}>
                        <h4 className={`font-semibold ${colorClass} text-lg mb-1`}>
                            {error?.summary || "Unknown Error"}
                        </h4>
                        <p className="text-slate-300 text-sm leading-relaxed">
                            {error?.advice || "Please check the console logs for more details."}
                        </p>
                    </div>

                    <div className="flex justify-end gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors border border-slate-700 hover:border-slate-600"
                        >
                            {t('btn_close', 'Close')}
                        </button>
                        {/* 
                        <button
                            onClick={() => { onClose(); window.electronAPI?.openLogsFolder(); }}
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg font-medium transition-colors border border-slate-700"
                        >
                            Open Logs
                        </button> 
                        */}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ErrorModal;
