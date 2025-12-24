import React, { useRef, useEffect } from 'react';
import { Sprout, Play, Loader2, X, ChevronRight, Plus, Edit3, Server, LogOut, PlusCircle, Check } from 'lucide-react';
import QuickSelectCard from '../components/common/QuickSelectCard';
import { formatLastPlayed } from '../utils/dateUtils';

const HomeView = ({
    selectedInstance,
    launchStatus,
    launchFeedback,
    onPlay,
    onStop,
    activeAccount,
    instances,
    onManageAll,
    setSelectedInstance,
    onNewCrop,
    onEditCrop,
    // Account System Props
    accounts,
    onSwitchAccount,
    onAddAccount,
    onLogout,
    showProfileMenu,
    setShowProfileMenu
}) => {
    const profileMenuRef = useRef(null);

    // Close profile menu when clicking outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
                setShowProfileMenu(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [setShowProfileMenu]);

    if (!selectedInstance) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                <Sprout size={48} className="mb-4 opacity-50" />
                <p>No crops planted yet.</p>
                <button onClick={onNewCrop} className="mt-4 text-emerald-500 hover:underline">
                    Create your first crop
                </button>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col items-center justify-center relative animate-in fade-in zoom-in-95 duration-500 select-none">
            {/* Dynamic Background */}
            <div
                className={`absolute inset-0 bg-gradient-to-br ${selectedInstance.bgGradient} transition-colors duration-1000`}
            />
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent" />

            {/* Account Pill & System - Top Right */}
            <div className="absolute top-8 right-8 z-50 pointer-events-auto" ref={profileMenuRef}>
                <button
                    onClick={() => setShowProfileMenu(!showProfileMenu)}
                    className={`flex items-center gap-3.5 bg-slate-950/80 backdrop-blur-xl border transition-all duration-300 cursor-pointer group pl-1.5 pr-5 py-1.5 rounded-full shadow-2xl shadow-black/40 ${showProfileMenu
                            ? 'border-emerald-500/50 ring-4 ring-emerald-500/10'
                            : 'border-white/10 hover:border-emerald-500/40 hover:bg-slate-900/90'
                        }`}
                >
                    <div className={`w-10 h-10 rounded-full ${activeAccount?.avatarColor || 'bg-slate-600'} flex items-center justify-center shadow-inner relative ring-2 ring-white/5 group-hover:ring-emerald-500/30 transition-all`}>
                        <span className="font-bold text-sm text-white">{activeAccount?.name?.[0]}</span>
                        {/* Status Dot */}
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-[2.5px] border-slate-900 rounded-full shadow-sm"></div>
                    </div>

                    <div className="flex flex-col items-start gap-0.5">
                        <span className="font-bold text-[15px] text-slate-100 group-hover:text-white transition-colors leading-none tracking-tight">
                            {activeAccount?.name}
                        </span>
                        <span className="text-[10px] font-medium text-emerald-400 uppercase tracking-wider bg-emerald-500/10 px-1.5 py-0.5 rounded leading-none border border-emerald-500/10">
                            {activeAccount?.type}
                        </span>
                    </div>

                    <ChevronRight
                        size={14}
                        className={`text-slate-500 group-hover:text-slate-300 transition-transform duration-300 ml-1 ${showProfileMenu ? 'rotate-90' : ''}`}
                    />
                </button>

                {/* Dropdown Menu */}
                {showProfileMenu && (
                    <div className="absolute top-full right-0 mt-2 w-64 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        {/* Account List */}
                        <div className="p-2 space-y-1">
                            <div className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex justify-between items-center">
                                Login Identities
                                <span className="bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded text-[10px]">
                                    {accounts?.length || 0}
                                </span>
                            </div>
                            <div className="max-h-48 overflow-y-auto custom-scrollbar">
                                {accounts?.map(acc => (
                                    <button
                                        key={acc.id}
                                        onClick={() => { onSwitchAccount(acc); setShowProfileMenu(false); }}
                                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all ${activeAccount?.id === acc.id
                                            ? 'bg-emerald-600 text-white shadow-emerald-900/20 shadow-lg'
                                            : 'hover:bg-slate-800 text-slate-300'
                                            }`}
                                    >
                                        <div className={`w-6 h-6 rounded-full ${acc.avatarColor} flex items-center justify-center text-[10px] font-bold shadow-sm`}>
                                            {acc.name[0]}
                                        </div>
                                        <div className="flex-1 text-left min-w-0">
                                            <div className="truncate text-sm font-medium">{acc.name}</div>
                                        </div>
                                        {activeAccount?.id === acc.id && <Check size={14} className="text-white" />}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="p-2 bg-slate-950/50 border-t border-slate-800 space-y-1">
                            <button
                                onClick={() => { onAddAccount(); setShowProfileMenu(false); }}
                                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-xs font-medium group"
                            >
                                <PlusCircle size={14} className="text-slate-500 group-hover:text-emerald-400 transition-colors" />
                                Add Another Account
                            </button>
                            <button
                                onClick={() => { onLogout(); setShowProfileMenu(false); }}
                                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors text-xs font-medium group"
                            >
                                <LogOut size={14} className="text-slate-500 group-hover:text-red-400 transition-colors" />
                                Log Out
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Main Content */}
            <div className="relative z-10 flex flex-col items-center text-center w-full max-w-4xl px-8">
                {/* Edit Button - Top Right of Content Area */}
                <button
                    onClick={() => onEditCrop(selectedInstance)}
                    className="absolute top-4 right-8 p-3 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 border border-slate-700 hover:border-slate-500 transition-all backdrop-blur-sm"
                    title="Edit crop"
                >
                    <Edit3 size={24} />
                </button>

                {/* Instance Icon - Large */}
                <div
                    className={`w-32 h-32 rounded-3xl ${selectedInstance.iconColor} flex items-center justify-center text-slate-900 shadow-2xl shadow-black/50 mb-8 transform hover:scale-105 transition-transform duration-300 ring-4 ring-white/10`}
                >
                    <Sprout size={64} />
                </div>

                {/* Instance Title */}
                <h1 className="text-5xl font-bold text-white mb-2 tracking-tight drop-shadow-lg">
                    {selectedInstance.name}
                </h1>

                <div className="flex items-center gap-3 text-slate-300 mb-10 bg-black/20 px-4 py-2 rounded-full backdrop-blur-sm border border-white/5">
                    <span className="font-mono">{selectedInstance.version}</span>
                    <span className="w-1 h-1 rounded-full bg-slate-500" />
                    <span>{selectedInstance.loader}</span>
                    <span className="w-1 h-1 rounded-full bg-slate-500" />
                    <span className="text-emerald-400 font-medium">{selectedInstance.status}</span>
                    {selectedInstance.autoConnect && (
                        <>
                            <span className="w-1 h-1 rounded-full bg-slate-500" />
                            <div className="flex items-center gap-1 text-emerald-400" title={`Auto-connects to ${selectedInstance.serverAddress}`}>
                                <Server size={14} />
                                <span className="text-xs font-medium">{selectedInstance.serverAddress}</span>
                            </div>
                        </>
                    )}
                </div>

                {/* Play / Stop */}
                {launchStatus === 'idle' ? (
                    launchFeedback === 'cancelled' ? (
                        <button disabled className="group relative w-full max-w-sm bg-slate-800 border-2 border-slate-700 text-amber-500 py-6 rounded-2xl font-bold text-xl cursor-not-allowed flex items-center justify-center gap-3 animate-pulse">
                            <X size={24} /> Launch Cancelled
                        </button>
                    ) : (
                        <button
                            onClick={onPlay}
                            className="group relative w-full max-w-sm bg-emerald-600 hover:bg-emerald-500 text-white py-6 rounded-2xl font-bold text-2xl shadow-[0_0_40px_rgba(5,150,105,0.4)] hover:shadow-[0_0_60px_rgba(5,150,105,0.6)] transform hover:-translate-y-1 active:translate-y-0 active:scale-95 transition-all duration-200 overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                            <span className="flex items-center justify-center gap-3">
                                <Play size={32} fill="currentColor" /> PLAY
                            </span>
                        </button>
                    )
                ) : (
                    <button
                        onClick={onStop}
                        className="w-full max-w-sm bg-slate-800 border-2 border-slate-700 text-slate-300 hover:text-white hover:border-red-500/50 hover:bg-red-500/10 py-6 rounded-2xl font-bold text-xl transition-all flex items-center justify-center gap-3"
                    >
                        {launchStatus === 'launching' ? (
                            <Loader2 size={24} className="animate-spin" />
                        ) : (
                            <X size={24} />
                        )}
                        {launchStatus === 'launching' ? 'GERMINATING...' : 'STOP'}
                    </button>
                )}

                {/* Last Played */}
                <p className="mt-6 text-slate-500 text-sm font-medium">
                    Last harvested: {formatLastPlayed(selectedInstance.lastPlayed)}
                </p>


            </div>

            {/* Quick Switcher Carousel */}
            <div className="absolute bottom-8 left-0 right-0 px-8 z-20">
                <div className="max-w-4xl mx-auto">
                    <div className="flex items-center justify-between mb-3 px-2">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Quick Switch
                        </span>
                        <button
                            onClick={onManageAll}
                            className="text-xs text-emerald-500 hover:text-emerald-400 flex items-center gap-1"
                        >
                            Manage All <ChevronRight size={12} />
                        </button>
                    </div>

                    <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide mask-linear-fade">
                        {instances?.map((inst) => (
                            <QuickSelectCard
                                key={inst.id}
                                instance={inst}
                                isSelected={selectedInstance?.id === inst.id}
                                onClick={() => setSelectedInstance(inst)}
                            />
                        ))}

                        {launchStatus === 'running' ? (
                            <button
                                onClick={onStop}
                                className="w-full py-4 rounded-xl bg-red-500/10 border border-red-500/50 hover:bg-red-500/20 text-red-500 font-bold uppercase tracking-wide transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-red-500/10 flex items-center justify-center gap-2"
                            >
                                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                Stop Game
                            </button>
                        ) : (
                            <button
                                onClick={onNewCrop}
                                className="flex-shrink-0 w-12 rounded-xl border border-dashed border-slate-800 flex items-center justify-center text-slate-600 hover:text-emerald-500 hover:border-emerald-500/50 hover:bg-slate-900 transition-colors"
                                aria-label="Create new crop"
                            >
                                <Plus size={20} />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HomeView;
