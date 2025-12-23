import React, { useRef, useEffect } from 'react';
import { Sprout, Play, Edit3, HardDrive, Settings, Shirt, Check, PlusCircle, LogOut, MoreVertical } from 'lucide-react';
import SidebarItem from './SidebarItem';
import SneakyAd from '../common/SneakyAd';

const Sidebar = ({ activeTab, onTabChange, accounts, activeAccount, onSwitchAccount, onAddAccount, showProfileMenu, setShowProfileMenu, onLogout }) => {
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

    return (
        <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col p-4 z-20">
            {/* Logo area */}
            <div className="flex items-center gap-3 px-2 mb-8 mt-2">
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-green-600 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-900/50">
                    <Sprout size={20} className="text-white" />
                </div>
                <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-green-200">
                    CraftCrops
                </h1>
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-1">
                <SidebarItem
                    icon={Play}
                    label="Play"
                    active={activeTab === 'home'}
                    onClick={() => onTabChange('home')}
                />
                <SidebarItem
                    icon={Edit3}
                    label="Edit Crops"
                    active={activeTab === 'instances'}
                    onClick={() => onTabChange('instances')}
                />
                <SidebarItem
                    icon={HardDrive}
                    label="Mod Vault"
                    active={activeTab === 'mods'}
                    onClick={() => onTabChange('mods')}
                />
                <div className="pt-4 mt-4 border-t border-slate-800">
                    <SidebarItem
                        icon={Settings}
                        label="Settings"
                        active={activeTab === 'settings'}
                        onClick={() => onTabChange('settings')}
                    />
                    <SidebarItem
                        icon={Shirt}
                        label="Wardrobe"
                        active={activeTab === 'wardrobe'}
                        onClick={() => onTabChange('wardrobe')}
                    />
                </div>
            </nav>

            {/* Ad Space + User Profile */}
            <div className="mt-auto pt-4 border-t border-slate-800 relative flex flex-col" ref={profileMenuRef}>

                {/* SNEAKY AD PLACE */}
                <SneakyAd />

                {/* Popup Menu */}
                {showProfileMenu && (
                    <div className="absolute bottom-full left-0 w-full mb-3 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl shadow-black/50 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200 z-50">
                        <div className="p-2 space-y-1">
                            <div className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex justify-between items-center">
                                Switch Account
                                <span className="text-emerald-500">{accounts.length} Active</span>
                            </div>
                            {accounts.map(acc => (
                                <button
                                    key={acc.id}
                                    onClick={() => onSwitchAccount(acc)}
                                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group ${activeAccount?.id === acc.id ? 'bg-emerald-500/10 text-white ring-1 ring-emerald-500/20' : 'hover:bg-slate-800 text-slate-300'}`}
                                >
                                    <div className={`w-7 h-7 rounded ${acc.avatarColor} flex items-center justify-center text-[10px] font-bold shadow-sm`}>
                                        {acc.name[0]}
                                    </div>
                                    <div className="flex-1 text-left min-w-0">
                                        <div className="truncate text-sm font-medium">{acc.name}</div>
                                        <div className="text-[10px] text-slate-500">{acc.type}</div>
                                    </div>
                                    {activeAccount?.id === acc.id && <Check size={14} className="text-emerald-500" />}
                                </button>
                            ))}
                        </div>
                        <div className="border-t border-slate-800 p-2 space-y-1 bg-slate-950/30">
                            <button
                                onClick={onAddAccount}
                                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-sm group"
                            >
                                <PlusCircle size={16} className="text-slate-500 group-hover:text-emerald-400 transition-colors" /> Add Account
                            </button>
                            <button onClick={onLogout} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors text-sm group">
                                <LogOut size={16} className="text-slate-500 group-hover:text-red-400 transition-colors" /> Log Out
                            </button>
                        </div>
                    </div>
                )}

                {/* Profile Button Trigger */}
                <button
                    onClick={() => setShowProfileMenu(!showProfileMenu)}
                    className={`w-full flex items-center gap-3 px-2 py-2 rounded-lg transition-colors cursor-pointer border border-transparent ${showProfileMenu ? 'bg-slate-800 border-slate-700' : 'hover:bg-slate-800'}`}
                >
                    <div className={`w-8 h-8 rounded ${activeAccount ? activeAccount.avatarColor : 'bg-slate-700'} flex items-center justify-center overflow-hidden shadow-sm`}>
                        <span className="text-xs font-bold text-white/90">{activeAccount ? activeAccount.name[0] : '?'}</span>
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                        <p className="text-sm font-medium text-slate-200 truncate">{activeAccount ? activeAccount.name : 'Guest'}</p>
                        <p className="text-xs text-slate-500 truncate">{activeAccount ? activeAccount.type : 'Not Signed In'}</p>
                    </div>
                    <MoreVertical size={14} className={`text-slate-500 transition-transform ${showProfileMenu ? 'rotate-90' : ''}`} />
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
