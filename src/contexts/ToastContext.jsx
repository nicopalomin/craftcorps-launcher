import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, Check, AlertTriangle, Info } from 'lucide-react';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback((message, type = 'info', duration = 3000) => {
        const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
        setToasts(prev => {
            const newToasts = [...prev, { id, message, type, duration }];
            if (newToasts.length > 5) {
                return newToasts.slice(newToasts.length - 5);
            }
            return newToasts;
        });
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ addToast, removeToast }}>
            {children}
            <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
                {toasts.map(toast => (
                    <ToastItem key={toast.id} {...toast} removeCallback={removeToast} />
                ))}
            </div>
        </ToastContext.Provider>
    );
};

const ToastItem = ({ id, message, type, duration = 3000, removeCallback }) => {
    const [isExiting, setIsExiting] = useState(false);

    const handleClose = () => {
        setIsExiting(true);
        setTimeout(() => {
            removeCallback(id);
        }, 300); // Match animation duration
    };

    // Auto-close effect
    React.useEffect(() => {
        const timer = setTimeout(() => {
            handleClose();
        }, duration);
        return () => clearTimeout(timer);
    }, [duration]);

    const icons = {
        success: <Check size={18} className="text-emerald-500" />,
        error: <X size={18} className="text-red-500" />,
        warning: <AlertTriangle size={18} className="text-amber-500" />,
        info: <Info size={18} className="text-blue-500" />
    };

    const borderColors = {
        success: 'border-emerald-500/50',
        error: 'border-red-500/50',
        warning: 'border-amber-500/50',
        info: 'border-blue-500/50'
    };

    return (
        <div className={`pointer-events-auto min-w-[300px] max-w-md bg-slate-900/90 backdrop-blur-md border ${borderColors[type]} p-4 rounded-xl shadow-2xl flex items-center gap-3 
            ${isExiting ? 'animate-out slide-out-to-right fade-out duration-300' : 'animate-in slide-in-from-right fade-in duration-300'}`}>
            <div className="bg-slate-800/50 p-2 rounded-lg">
                {icons[type]}
            </div>
            <p className="text-slate-200 text-sm font-medium flex-1">{message}</p>
            <button onClick={handleClose} className="text-slate-500 hover:text-white transition-colors">
                <X size={14} />
            </button>
        </div>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) throw new Error('useToast must be used within a ToastProvider');
    return context;
};
