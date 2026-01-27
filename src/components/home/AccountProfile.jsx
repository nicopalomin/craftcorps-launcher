import React, { useRef, useEffect, useState } from 'react';
import { ChevronRight, PlusCircle, LogOut, Check, Calendar } from 'lucide-react';
import PlayerAvatar from '../common/PlayerAvatar';

const AccountProfile = ({
    activeAccount,
    accounts,
    showProfileMenu,
    setShowProfileMenu,
    onSwitchAccount,
    onAddAccount,
    onLogout
}) => {
    const profileMenuRef = useRef(null);
    const [joinedDate, setJoinedDate] = useState(null);

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

    // Fetch Profile Date
    useEffect(() => {
        if (showProfileMenu) {
            window.electronAPI?.getUserProfile().then(res => {
                if (res.success && res.profile) {
                    const dStr = res.profile.createdAt || res.profile.created_at; // Handle potential casing
                    if (dStr) {
                        const date = new Date(dStr);
                        setJoinedDate(date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));
                    }
                }
            }).catch(console.error);
        }
    }, [showProfileMenu]);

    return (
        <div className="relative z-50 pointer-events-auto" ref={profileMenuRef}>
            <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className={`flex items-center gap-4 bg-slate-900/50 border transition-all duration-300 cursor-pointer group pl-2.5 pr-8 py-2.5 rounded-2xl ${showProfileMenu
                    ? 'border-emerald-500/50 ring-4 ring-emerald-500/10'
                    : 'border-white/10 hover:border-emerald-500/40 hover:bg-slate-800'
                    }`}
            >
                <div className="relative">
                    <div className={`w-12 h-12 rounded-xl ${activeAccount?.avatarColor || 'bg-slate-600'} flex items-center justify-center shadow-inner relative ring-1 ring-white/10 group-hover:ring-emerald-500/30 transition-all overflow-hidden`}>
                        <PlayerAvatar name={activeAccount?.name} uuid={activeAccount?.uuid} />
                    </div>
                    {/* Status Dot */}
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-slate-900 rounded-full shadow-sm transform translate-x-[20%] translate-y-[20%] z-10"></div>
                </div>

                <div className="flex flex-col items-start gap-1">
                    <span className="font-bold text-[15px] text-slate-200 transition-colors leading-none tracking-tight">
                        {activeAccount?.name}
                    </span>
                    <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded leading-none border border-emerald-500/10">
                        {activeAccount?.type}
                    </span>
                </div>

                <ChevronRight
                    size={16}
                    className={`text-slate-500 group-hover:text-slate-300 transition-transform duration-300 ml-2 ${showProfileMenu ? 'rotate-90' : ''}`}
                />
            </button>

            {/* Dropdown Menu */}
            {showProfileMenu && (
                <div className="absolute top-full right-0 mt-2 w-72 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-[100]">

                    {/* Member Since Header */}
                    {joinedDate && (
                        <div className="px-4 py-3 bg-slate-950/30 border-b border-white/5 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                <Calendar size={14} />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Member Since</span>
                                <span className="text-xs font-bold text-slate-200">{joinedDate}</span>
                            </div>
                        </div>
                    )}

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
                                    <div className={`w-6 h-6 rounded-lg ${acc.avatarColor} flex items-center justify-center text-[10px] font-bold shadow-sm relative`}>
                                        <PlayerAvatar name={acc.name} uuid={acc.uuid} size={32} />
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
    );
};

export default AccountProfile;
