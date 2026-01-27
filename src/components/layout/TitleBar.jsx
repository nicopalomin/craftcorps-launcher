import React from 'react';
import { Terminal, Maximize2, Minimize2, X, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ActiveInstances from '../common/ActiveInstances';

function TitleBar({
    launchStatus,
    isRefreshing,
    authError,
    onOpenConsole,
    onRefreshAuth,
    updateStatus,
    updateInfo,
    onOpenUpdateModal,
    onSelectRunningInstance
}) {
    const { t } = useTranslation();

    return (
        <header className="absolute top-0 left-0 right-0 h-10 flex items-center justify-between px-4 z-[100] select-none drag glass-spotlight border-b border-white/5">
            <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>CraftCorps Launcher v{typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0'}</span>
                {launchStatus === 'running' && <span className="text-emerald-500 flex items-center gap-1">● {t('top_bar_running')}</span>}
                {isRefreshing && (
                    <div className="relative group ml-3 no-drag">
                        <div className="flex items-center gap-1.5 text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/20 cursor-help">
                            <RefreshCw size={10} className="animate-spin" />
                            <span className="font-medium">Refreshing Account</span>
                        </div>
                        <div className="absolute top-full left-0 mt-2 w-64 p-2.5 bg-slate-900/95 backdrop-blur border border-sky-500/30 rounded-lg shadow-xl text-xs text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-[100]">
                            We're verifying your account details to make sure everything is ready for you to play.
                        </div>
                    </div>
                )}
                {!isRefreshing && authError && (
                    <div className="relative group ml-3 no-drag">
                        <button
                            onClick={onRefreshAuth}
                            className="flex items-center gap-1.5 text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500 hover:bg-red-500/20 transition-colors cursor-pointer"
                        >
                            <X size={10} />
                            <span className="font-medium">Minecraft Login Failed</span>
                        </button>
                        <div className="absolute top-full left-0 mt-2 w-64 p-2.5 bg-slate-900/95 backdrop-blur border border-red-500/30 rounded-lg shadow-xl text-xs text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-[100]">
                            Minecraft authentication failed. This can be due to internet connection issues, Mojang servers being down, or VPN usage. Click to retry.
                        </div>
                    </div>
                )}
                {/* Update Indicator */}
                {(updateStatus === 'available' || updateStatus === 'downloaded' || updateStatus === 'downloading') && (
                    <div className="relative group ml-3 no-drag">
                        <button
                            onClick={onOpenUpdateModal}
                            className="flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors cursor-pointer"
                        >
                            <RefreshCw size={10} className={updateStatus === 'downloading' ? 'animate-spin' : ''} />
                            <span className="font-medium">
                                {updateStatus === 'downloaded' ? 'Update Ready' : 'Update Available'}
                            </span>
                        </button>
                        <div className="absolute top-full left-0 mt-2 w-64 p-2.5 bg-slate-900/95 backdrop-blur border border-emerald-500/30 rounded-lg shadow-xl text-xs text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-[100]">
                            {updateStatus === 'downloaded'
                                ? `Version ${updateInfo?.version || 'Unknown'} is ready to install. Click to restart.`
                                : `Version ${updateInfo?.version || 'Unknown'} is available. Click to download.`}
                        </div>
                    </div>
                )}

                {/* Active Instances Indicator */}
                <ActiveInstances onInstanceClick={onSelectRunningInstance} />
            </div>
            <div className="flex items-center gap-4 no-drag">
                {launchStatus !== 'idle' && (
                    <button
                        onClick={onOpenConsole}
                        className="text-xs flex items-center gap-1.5 text-slate-400 hover:text-emerald-400 transition-colors"
                    >
                        <Terminal size={12} /> {t('top_bar_console')}
                    </button>
                )}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => window.electronAPI?.minimize()}
                        className="p-1.5 hover:bg-slate-800 rounded text-slate-400"
                    >
                        <Minimize2 size={14} />
                    </button>
                    <button
                        onClick={() => window.electronAPI?.maximize()}
                        className="p-1.5 hover:bg-slate-800 rounded text-slate-400"
                    >
                        <Maximize2 size={14} />
                    </button>
                    <button
                        onClick={() => window.electronAPI?.close()}
                        className="p-1.5 hover:bg-red-500/20 hover:text-red-400 rounded text-slate-400"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>
        </header>
    );
}

export default TitleBar;
