
import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Info, Globe, ShieldAlert, Check, ChevronRight } from "lucide-react";
import { useDiscover } from "../hooks/useDiscover";
import DiscoverHeader from "../components/discover/DiscoverHeader";
import DiscoverGrid from "../components/discover/DiscoverGrid";
import sprinkleBg from '/images/sprinkle_bg.svg';

const DiscoverView = ({ selectedInstance, activeAccount }) => {
    const { t } = useTranslation();
    const [showDisclaimer, setShowDisclaimer] = useState(false);
    const [agreed, setAgreed] = useState(false);

    useEffect(() => {
        const dismissed = localStorage.getItem('discover_welcome_v1');
        if (!dismissed) {
            setShowDisclaimer(true);
        }
    }, []);

    const dismissDisclaimer = () => {
        localStorage.setItem('discover_welcome_v1', 'true');
        setShowDisclaimer(false);
    };

    const {
        servers,
        loading,
        loadingMore,
        hasMore,
        query,
        setQuery,
        activeFilters,
        setActiveFilters,
        metadata,
        sections,
        loadServers,
        handleJoin,
        handleCopy,
        joiningServers,
        playingServerIp,
        isBusy,
        handleStop
    } = useDiscover(selectedInstance, activeAccount);

    return (
        <div
            className="flex-1 bg-slate-900 overflow-hidden relative flex flex-col select-none"
        >
            <div
                className="flex-1 overflow-y-auto custom-scrollbar relative z-10"
            >
                <div className="relative min-h-full w-full p-8">
                    {/* Background Layer - Anchored to expanding block container */}
                    <div
                        className="absolute inset-0 -z-10 pointer-events-none opacity-30"
                        style={{
                            backgroundImage: `url(${sprinkleBg})`,
                            backgroundRepeat: 'repeat',
                            backgroundSize: '600px',
                            filter: 'blur(0.5px)',
                            willChange: 'transform'
                        }}
                    />
                    {/* Darkening Overlay */}
                    <div className="absolute inset-0 -z-10 bg-slate-950/40 pointer-events-none" />

                    <DiscoverHeader
                        query={query}
                        setQuery={setQuery}
                        activeFilters={activeFilters}
                        setActiveFilters={setActiveFilters}
                        metadata={metadata}
                    />

                    <div className="mt-6">
                        <DiscoverGrid
                            loading={loading}
                            servers={servers}
                            sections={sections}
                            hasMore={hasMore}
                            loadingMore={loadingMore}
                            loadServers={loadServers}
                            handleJoin={handleJoin}
                            handleCopy={handleCopy}
                            handleStop={handleStop}
                            joiningServers={joiningServers}
                            playingServerIp={playingServerIp}
                            isBusy={isBusy}
                        />

                        {/* Disclaimer Footer */}
                        <div className="mt-12 mb-4 text-center">
                            <p className="text-xs text-slate-600 font-medium">
                                CraftCorps is not affiliated with any of the servers shown above.
                            </p>
                            <p className="text-[10px] text-slate-700 mt-1">
                                All trademarks and content belong to their respective owners.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {showDisclaimer && (
                <div className="absolute inset-0 z-[60] bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center p-6 animate-in fade-in duration-300">
                    <div className="max-w-lg w-full bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8 relative overflow-hidden">
                        {/* Decorative Background */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                        <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />

                        <div className="relative z-10 flex flex-col items-center text-center">
                            <div className="bg-emerald-500/10 p-4 rounded-2xl mb-6 ring-1 ring-emerald-500/20">
                                <Globe size={48} className="text-emerald-500" strokeWidth={1.5} />
                            </div>

                            <h2 className="text-2xl font-bold text-white mb-3">
                                {t('discover_welcome_title')}
                            </h2>

                            <p className="text-slate-400 mb-8 leading-relaxed">
                                {t('discover_welcome_desc')}
                            </p>

                            <div className="bg-slate-950/50 rounded-xl p-4 border border-slate-800 w-full mb-6 text-left group cursor-pointer" onClick={() => setAgreed(!agreed)}>
                                <div className="flex gap-3">
                                    <div className={`mt-0.5 w-5 h-5 rounded-md border flex-shrink-0 flex items-center justify-center transition-all duration-200 ${agreed ? 'bg-emerald-500 border-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-slate-900 border-slate-700 group-hover:border-slate-500'}`}>
                                        <Check size={14} strokeWidth={3} className={`transition-all duration-200 ${agreed ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`} />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <div className="text-sm text-slate-300 font-medium select-none">
                                            {t('discover_disclaimer_agreement')}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={dismissDisclaimer}
                                disabled={!agreed}
                                className={`w-full py-3.5 px-6 rounded-xl font-bold flex items-center justify-center gap-2 transition-all duration-200 ${agreed
                                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20 translate-y-0'
                                    : 'bg-slate-800 text-slate-500 cursor-not-allowed translate-y-0'
                                    }`}
                            >
                                {t('discover_btn_start')}
                                <ChevronRight size={18} className={agreed ? 'opacity-100 translate-x-0 transition-transform' : 'opacity-0 -translate-x-2'} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DiscoverView;
