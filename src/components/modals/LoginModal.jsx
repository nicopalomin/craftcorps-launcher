import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { User, X, Loader2, ShieldCheck, ChevronRight, WifiOff, Info } from 'lucide-react';

import { getOfflineUUID } from '../../utils/uuid';

const LoginModal = ({ isOpen, onClose, onAddAccount, isAutoRefreshing }) => {
    const { t } = useTranslation();
    const [activeMethod, setActiveMethod] = useState('selection'); // selection | offline
    const [offlineName, setOfflineName] = useState('');
    const [validationMsg, setValidationMsg] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);

    // Reset state when modal opens/closes
    React.useEffect(() => {
        if (!isOpen) {
            setOfflineName('');
            setValidationMsg('');
            setErrorMsg(null);
            // Don't reset activeMethod here if we want to remember tab? 
            // Usually reset to selection is safer.
            setActiveMethod('selection');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleMicrosoftLogin = async () => {
        // Show widget instead of alert
        setErrorMsg("Coming soon, we're waiting approval from mojang");
        //

        setIsLoading(true);
        setErrorMsg(null);
        try {
            if (window.electronAPI) {
                const result = await window.electronAPI.microsoftLogin();
                if (result.success) {
                    onAddAccount({
                        ...result.account,
                        avatarColor: 'bg-emerald-600', // Success color
                    });
                    onClose();
                } else {
                    console.error("Login failed:", result.error);

                    // Map error codes to translation keys
                    let key = 'auth_err_unknown';
                    const err = result.error;

                    if (err.includes('AUTH_MS_TOKEN_FAILED')) key = 'auth_err_ms_token';
                    else if (err.includes('AUTH_XBOX_LIVE_FAILED')) key = 'auth_err_xbox_live';
                    else if (err.includes('AUTH_NO_XBOX_ACCOUNT')) key = 'auth_err_no_xbox';
                    else if (err.includes('AUTH_CHILD_ACCOUNT')) key = 'auth_err_child';
                    else if (err.includes('AUTH_XSTS_FAILED')) key = 'auth_err_xsts';
                    else if (err.includes('AUTH_MC_LOGIN_FAILED')) key = 'auth_err_mc_login';
                    else if (err.includes('AUTH_NO_MINECRAFT')) key = 'auth_err_no_mc';
                    else if (err.includes('AUTH_PROFILE_FAILED')) key = 'auth_err_profile';
                    else if (err.includes('AUTH_INVALID_APP_CONFIG')) key = 'auth_err_invalid_app_config';
                    else if (err.includes('ENOTFOUND')) key = 'auth_err_network';

                    setErrorMsg(t(key));
                    setIsLoading(false);
                }
            } else {
                console.error("Electron API not available");
                setErrorMsg("Electron API not available");
                setIsLoading(false);
            }
        } catch (e) {
            console.error("Login error:", e);
            if (e.message && e.message.includes('AUTH_CANCELLED_BY_USER')) {
                setIsLoading(false);
                return;
            }
            setErrorMsg(e.message || t('auth_err_unknown'));
            setIsLoading(false);
        }

    };

    const handleOfflineLogin = () => {
        if (!offlineName.trim()) return;

        // Generate valid Offline UUID
        const uuid = getOfflineUUID(offlineName);

        onAddAccount({
            name: offlineName,
            type: 'Offline',
            avatarColor: 'bg-slate-600',
            uuid: uuid
        });
        setOfflineName('');
        setActiveMethod('selection');
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200 select-none">
            <div className="bg-slate-900 w-full max-w-md rounded-2xl border border-slate-700 shadow-2xl p-6 relative overflow-hidden">

                {/* Header */}
                <div className="flex justify-between items-center mb-6 relative z-10">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <User size={20} className="text-emerald-500" /> {t('auth_modal_title')}
                    </h3>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="relative z-10">
                    {isLoading || isAutoRefreshing ? (
                        <div className="h-48 flex flex-col items-center justify-center text-center">
                            <Loader2 size={48} className="text-emerald-500 animate-spin mb-4" />
                            <h4 className="text-lg font-bold text-white mb-1">
                                {isAutoRefreshing ? t('auth_refreshing_session', { defaultValue: 'Verifying Session...' }) : t('auth_authenticating')}
                            </h4>
                            <p className="text-sm text-slate-500">
                                {isAutoRefreshing ? t('auth_refreshing_detail', { defaultValue: 'Checking your credentials...' }) : t('auth_browser_instruction')}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {errorMsg && (
                                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-sm flex items-start gap-2">
                                    <ShieldCheck size={16} className="mt-0.5 shrink-0" />
                                    <span>{errorMsg}</span>
                                </div>
                            )}

                            <button
                                onClick={handleMicrosoftLogin}
                                className="w-full bg-[#0078D4] hover:bg-[#006cbd] text-white p-4 rounded-xl flex items-center justify-between group transition-all"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="bg-white/10 p-2 rounded-lg">
                                        <ShieldCheck size={20} />
                                    </div>
                                    <div className="text-left">
                                        <div className="font-bold text-sm">{t('auth_microsoft')}</div>
                                        <div className="text-xs text-white/70">{t('auth_recommended')}</div>
                                    </div>
                                </div>
                                <ChevronRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>

                            <div className="relative py-2">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-slate-700"></div>
                                </div>
                                <div className="relative flex justify-center text-xs">
                                    <span className="bg-slate-900 px-2 text-slate-500 uppercase tracking-widest">{t('auth_or')}</span>
                                </div>
                            </div>

                            <div className="bg-slate-950/50 rounded-xl p-4 border border-slate-800 relative">
                                <div className="absolute top-2 right-2 z-10 group">
                                    <Info size={16} className="text-slate-600 hover:text-slate-400 cursor-help transition-colors" />
                                    <div className="absolute right-0 bottom-full mb-2 w-48 p-2 bg-black text-xs text-slate-300 rounded border border-slate-700 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none z-50">
                                        {t('auth_offline_warning')}
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 mb-3">
                                    <div className="bg-slate-800 p-2 rounded-lg text-slate-400">
                                        <WifiOff size={20} />
                                    </div>
                                    <div className="text-left flex-1 pr-6">
                                        <div className="font-bold text-sm text-slate-300">{t('auth_offline')}</div>
                                        <div className="text-xs text-slate-500">{t('auth_singleplayer_only')}</div>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2 w-full">
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            placeholder={t('auth_input_placeholder')}
                                            value={offlineName}
                                            maxLength={16}
                                            onChange={(e) => {
                                                const raw = e.target.value;
                                                let msg = '';

                                                if (/[^a-zA-Z0-9_]/.test(raw)) {
                                                    msg = t('auth_err_invalid_char');
                                                } else if (raw.length > 0 && raw.length < 3) {
                                                    msg = t('auth_err_min_length');
                                                }

                                                setValidationMsg(msg);

                                                const val = raw.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 16);
                                                setOfflineName(val);
                                            }}
                                            className={`flex-1 bg-slate-900 border rounded-lg px-3 py-2 text-sm text-white focus:outline-none placeholder:text-slate-600 ${validationMsg ? 'border-red-500/50 focus:border-red-500' : 'border-slate-700 focus:border-emerald-500/50'}`}
                                            onKeyDown={(e) => e.key === 'Enter' && offlineName.length >= 3 && handleOfflineLogin()}
                                        />
                                        <button
                                            onClick={handleOfflineLogin}
                                            disabled={offlineName.length < 3}
                                            className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                                        >
                                            {t('auth_btn_add')}
                                        </button>
                                    </div>
                                    {validationMsg && (
                                        <span className="text-xs text-red-400 pl-1 animate-in fade-in slide-in-from-top-1">
                                            {validationMsg}
                                        </span>
                                    )}
                                    <a
                                        href="https://www.minecraft.net/store"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-500 hover:text-blue-400 underline text-xs mt-1 text-center block transition-colors"
                                    >
                                        Purchase Minecraft From Here
                                    </a>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Decorative BG */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            </div>
        </div>
    );
};

export default LoginModal;
