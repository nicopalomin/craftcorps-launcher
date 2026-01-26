import React, { useState, useEffect } from 'react';
import {
    User, CreditCard, Shirt, Link as LinkIcon,
    Clock, Shield, Box, Star, Mail,
    Gamepad2, Globe, CheckCircle2, MoreHorizontal,
    Calendar, Award, Layout, Server, Crown, Activity,
    ShieldAlert, Loader2, Plus, LogOut, Check
} from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { fetchPlayerCosmetics, fetchDetailedCosmetics, fetchAllCosmetics, getCosmeticTextureUrl } from '../utils/cosmeticsApi';
import { FALLBACK_COSMETICS } from '../data/fallbackCosmetics';

const ComingSoonOverlay = ({ title = "Coming Soon", description }) => (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm select-none transition-all duration-500">
        <div className="bg-slate-900/90 p-6 rounded-2xl border border-white/10 flex flex-col items-center animate-in zoom-in-95 duration-300 shadow-2xl max-w-sm text-center">
            <span className="text-sm font-bold text-emerald-400 tracking-widest uppercase mb-2 flex items-center gap-2">
                <Clock size={16} /> {title}
            </span>
            <p className="text-slate-400 text-sm leading-relaxed">{description}</p>
        </div>
    </div>
);

const ProfileView = ({ activeAccount, accounts, instances, theme, onLogout }) => {
    const { addToast } = useToast();

    // Data States
    const [ownedCosmetics, setOwnedCosmetics] = useState([]);
    const [isLoadingCosmetics, setIsLoadingCosmetics] = useState(false);
    const [linkedAccounts, setLinkedAccounts] = useState([]);
    const [isLoadingProfile, setIsLoadingProfile] = useState(false);

    // Secure Account State
    const [isSecuring, setIsSecuring] = useState(false);
    const [secEmail, setSecEmail] = useState('');
    const [secPass, setSecPass] = useState('');

    // Fetch Profile & Linked Accounts
    const refreshProfile = async () => {
        if (!activeAccount) return;
        setIsLoadingProfile(true);
        try {
            if (window.electronAPI?.getUserProfile) {
                const res = await window.electronAPI.getUserProfile();
                if (res.success && res.profile) {
                    // Expect profile.linkedAccounts = [{ provider, id, username, ... }]
                    setLinkedAccounts(res.profile.linkedAccounts || []);
                }
            }
        } catch (e) {
            console.error("Failed to load profile", e);
        } finally {
            setIsLoadingProfile(false);
        }
    };

    useEffect(() => {
        refreshProfile();
    }, [activeAccount]);

    // Load Cosmetics Logic
    useEffect(() => {
        const loadCosmetics = async () => {
            if (!activeAccount) return;

            setIsLoadingCosmetics(true);
            try {
                // 1. Fetch Catalog (for metadata)
                const allCosmetics = await fetchAllCosmetics();
                const catalogData = allCosmetics.length > 0 ? allCosmetics : FALLBACK_COSMETICS;

                // 2. Fetch Owned IDs
                let ownedIds = [];
                let uuid = activeAccount.uuid || activeAccount.id;

                // Try to use authenticated endpoint first
                if (window.electronAPI?.fetchDetailedCosmetics) {
                    try {
                        const detailed = await window.electronAPI.fetchDetailedCosmetics(uuid);
                        if (detailed && detailed.cosmetics) {
                            ownedIds = detailed.cosmetics.map(c => c.cosmeticId);
                        }
                    } catch (e) {
                        console.warn("Profile detailed fetch failed", e);
                    }
                }

                // If failed or no auth, try public endpoint
                if (ownedIds.length === 0 && uuid) {
                    ownedIds = await fetchPlayerCosmetics(uuid);
                }

                // 3. Merge
                const owned = catalogData.filter(c => ownedIds.includes(c.cosmeticId)).map(c => {
                    let textureUrl = c.textureUrl;
                    if (textureUrl && textureUrl.startsWith('/')) {
                        textureUrl = `https://api.craftcorps.net${textureUrl}`;
                    } else if (!textureUrl) {
                        textureUrl = getCosmeticTextureUrl(c.cosmeticId);
                    }
                    return {
                        ...c,
                        texture: textureUrl,
                        rarity: c.rarity || 'Common',
                        color: c.color || 'from-slate-700 to-slate-900'
                    }
                });

                setOwnedCosmetics(owned);

            } catch (err) {
                console.error("Profile cosmetics load error", err);
            } finally {
                setIsLoadingCosmetics(false);
            }
        };

        loadCosmetics();
    }, [activeAccount]);

    const getRarityColor = (rarity) => {
        switch (rarity) {
            case 'Legendary': return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
            case 'Epic': return 'text-purple-400 border-purple-500/30 bg-purple-500/10';
            case 'Rare': return 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10';
            default: return 'text-slate-400 border-slate-500/30 bg-slate-500/10';
        }
    };

    // Connections Logic
    const hasCredentials = linkedAccounts.some(a => a.provider === 'credentials' || a.provider === 'local') || activeAccount?.type === 'CraftCorps';
    const microsoftLink = linkedAccounts.find(a => a.provider === 'microsoft');
    const discordLink = linkedAccounts.find(a => a.provider === 'discord');

    // Status Logic
    const isOffline = activeAccount?.type === 'offline';
    // If we have linked credentials, we are verified even if using offline mode locally maybe? No, offline is offline.
    const statusText = isOffline ? 'Offline Mode' : 'Verified';
    const statusColor = isOffline ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    const StatusIcon = isOffline ? ShieldAlert : Shield;

    // Handlers
    const handleLinkMicrosoft = async () => {
        if (microsoftLink) return;
        try {
            if (window.electronAPI) {
                addToast('Linking Microsoft Account...', 'info');
                const res = await window.electronAPI.linkMicrosoftAccount();
                if (res.success) {
                    addToast('Microsoft Account Linked Successfully!', 'success');
                    refreshProfile();
                } else {
                    throw new Error(res.error);
                }
            }
        } catch (e) {
            console.error(e);
            addToast('Failed to link account', 'error');
        }
    };

    const handleLinkDiscord = async () => {
        if (discordLink) return;
        try {
            if (window.electronAPI?.linkDiscord) {
                addToast('Opening Discord Login...', 'info');
                const res = await window.electronAPI.linkDiscord();
                if (res.success) {
                    addToast('Discord Account Linked Successfully!', 'success');
                    refreshProfile();
                } else {
                    if (res.error !== 'Cancelled by user') {
                        throw new Error(res.error);
                    }
                }
            } else {
                addToast('Discord Linking not available', 'error');
            }
        } catch (e) {
            console.error(e);
            addToast('Failed to link Discord: ' + e.message, 'error');
        }
    };

    return (
        <div className="relative flex-1 overflow-hidden mask-linear-fade bg-slate-950">
            <ComingSoonOverlay
                title="Profile & Dashboard"
                description="We are currently performing maintenance on the profile services. Please check back later."
            />
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto h-full p-8 pb-20 custom-scrollbar filter blur-sm opacity-50 pointer-events-none select-none">
                <div className="max-w-6xl mx-auto space-y-8">

                    {/* Header Profile Card */}
                    <div className="relative overflow-hidden bg-slate-800/50 backdrop-blur-md rounded-2xl border border-white/5 p-8">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-3xl rounded-full -mr-32 -mt-32 pointer-events-none" />

                        <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
                            {/* Avatar / Head */}
                            <div className="relative group">
                                <div className="absolute -inset-4 bg-emerald-500/20 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                                <div className="w-32 h-32 rounded-2xl bg-slate-900 border-4 border-slate-700 overflow-hidden shadow-2xl transition-transform duration-500 hover:scale-105 relative z-10">
                                    {activeAccount ? (
                                        <img
                                            src={`https://mc-heads.net/avatar/${activeAccount.uuid || activeAccount.id}/128`}
                                            alt={activeAccount.name}
                                            className="w-full h-full object-cover rendering-pixelated"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-slate-500">
                                            <User size={48} />
                                        </div>
                                    )}
                                </div>
                                <div className="absolute -bottom-2 -right-2 bg-slate-900 rounded-full p-1.5 border border-slate-700 z-20">
                                    <div className="w-4 h-4 rounded-full bg-emerald-500 animate-pulse box-shadow-glow" title="Online" />
                                </div>
                            </div>

                            {/* User Details */}
                            <div className="flex-1 text-center md:text-left space-y-3">
                                <div>
                                    <h1 className="text-4xl font-bold text-white tracking-tight">
                                        {activeAccount?.name || 'Guest User'}
                                    </h1>
                                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-2 text-slate-400 font-mono text-sm">
                                        <span className="bg-slate-900/50 px-3 py-1 rounded-full border border-white/5">
                                            UUID: {activeAccount?.uuid || activeAccount?.id || 'N/A'}
                                        </span>
                                        <span className={`${statusColor} px-3 py-1 rounded-full border flex items-center gap-2`}>
                                            <StatusIcon size={12} /> {statusText}
                                        </span>
                                    </div>
                                </div>

                                <div className="text-xs text-slate-500 font-medium">
                                    Manage your account settings and preferences.
                                </div>
                            </div>

                            {/* Wallet Balance - Still Coming Soon? prompt said remove messages.. ok, we enable it visually but static */}
                            <div className="relative overflow-hidden flex flex-col items-center md:items-end justify-center bg-slate-900/50 p-4 rounded-xl border border-white/5 min-w-[200px]">
                                <div className="flex items-center gap-2 text-emerald-400 mb-1">
                                    <CreditCard size={16} />
                                    <span className="uppercase text-xs font-bold tracking-wider">Wallet Balance</span>
                                </div>
                                <div className="text-3xl font-bold text-white">
                                    0 <span className="text-sm text-slate-500">CC</span>
                                </div>
                                <button className="mt-2 text-xs text-slate-500 hover:text-white flex items-center gap-1 transition-colors">
                                    Top up wallet +
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Main Grid Content */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                        {/* Left Column: Stats & Connections */}
                        <div className="space-y-8 lg:col-span-1">

                            {/* Stats Card */}
                            <div className="bg-slate-800/50 backdrop-blur-md rounded-2xl border border-white/5 p-6 space-y-4">
                                <h2 className="text-xl font-bold text-slate-200 flex items-center gap-2">
                                    <Star className="text-emerald-400" size={20} /> Statistics
                                </h2>
                                <div className="grid grid-cols-1 gap-3">
                                    <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-white/5 hover:border-emerald-500/30 transition-colors">
                                        <div className="flex items-center gap-3 text-slate-400">
                                            <Box size={16} />
                                            <span>Instances Created</span>
                                        </div>
                                        <span className="text-white font-mono">{instances?.length || 0}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Account Management Card */}
                            <div className="bg-slate-800/50 backdrop-blur-md rounded-2xl border border-white/5 p-6 space-y-6 relative overflow-hidden">
                                <h2 className="text-xl font-bold text-slate-200 flex items-center gap-2">
                                    <Shield className="text-blue-400" size={20} /> Account Connections
                                </h2>

                                {/* Link Actions */}
                                <div className="space-y-3">
                                    <h3 className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Linked Accounts</h3>

                                    {/* Microsoft */}
                                    <button
                                        onClick={handleLinkMicrosoft}
                                        disabled={!!microsoftLink}
                                        className={`w-full flex items-center justify-between p-3 rounded-xl transition-all group border ${microsoftLink ? 'bg-slate-900/80 border-emerald-500/30 cursor-default' : 'bg-slate-900/50 hover:bg-slate-800 border-white/5'}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-[#0078D4]/20 text-[#0078D4] flex items-center justify-center">
                                                <Globe size={16} />
                                            </div>
                                            <div className="text-left">
                                                <div className="text-sm font-medium text-slate-200">
                                                    {microsoftLink ? (microsoftLink.username || 'Microsoft Account') : 'Microsoft Account'}
                                                </div>
                                                <div className="text-[10px] text-slate-500">
                                                    {microsoftLink ? 'Account Linked' : 'Link your Minecraft Profile'}
                                                </div>
                                            </div>
                                        </div>
                                        {microsoftLink ? (
                                            <CheckCircle2 size={16} className="text-emerald-500" />
                                        ) : (
                                            <Plus size={16} className="text-slate-500 group-hover:text-white transition-colors" />
                                        )}
                                    </button>

                                    {/* Discord */}
                                    <button
                                        onClick={handleLinkDiscord}
                                        disabled={!!discordLink}
                                        className={`w-full flex items-center justify-between p-3 rounded-xl transition-all group border ${discordLink ? 'bg-slate-900/80 border-emerald-500/30 cursor-default' : 'bg-slate-900/50 hover:bg-slate-800 border-white/5'}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-[#5865F2]/20 text-[#5865F2] flex items-center justify-center">
                                                <Gamepad2 size={16} />
                                            </div>
                                            <div className="text-left">
                                                <div className="text-sm font-medium text-slate-200">
                                                    {discordLink ? (discordLink.username || 'Discord') : 'Discord'}
                                                </div>
                                                <div className="text-[10px] text-slate-500">
                                                    {discordLink ? 'Account Linked' : 'Link for community rewards'}
                                                </div>
                                            </div>
                                        </div>
                                        {discordLink ? (
                                            <CheckCircle2 size={16} className="text-emerald-500" />
                                        ) : (
                                            <Plus size={16} className="text-slate-500 group-hover:text-white transition-colors" />
                                        )}
                                    </button>

                                    {/* Link Credentials (Secure Account) - If not linked */}
                                    {!hasCredentials && (
                                        <div className="pt-4 border-t border-white/5 space-y-3">
                                            <div className="flex items-center gap-2 text-amber-400">
                                                <ShieldAlert size={16} />
                                                <span className="text-xs font-bold">Unsecured Account</span>
                                            </div>

                                            {isSecuring ? (
                                                <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                                    <input
                                                        type="email"
                                                        placeholder="Email Address"
                                                        value={secEmail}
                                                        onChange={(e) => setSecEmail(e.target.value)}
                                                        className="w-full bg-slate-950/50 border border-amber-500/20 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/50"
                                                    />
                                                    <input
                                                        type="password"
                                                        placeholder="Create Password"
                                                        value={secPass}
                                                        onChange={(e) => setSecPass(e.target.value)}
                                                        className="w-full bg-slate-950/50 border border-amber-500/20 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/50"
                                                    />
                                                    <div className="flex gap-2 pt-1">
                                                        <button
                                                            onClick={async () => {
                                                                if (!secEmail || !secPass) return;
                                                                try {
                                                                    if (window.electronAPI) {
                                                                        addToast('Securing account...', 'info');
                                                                        const res = await window.electronAPI.linkCredentials({ email: secEmail, password: secPass });
                                                                        if (res.success) {
                                                                            addToast('Account Secured Successfully!', 'success');
                                                                            setIsSecuring(false);
                                                                            refreshProfile();
                                                                        } else {
                                                                            throw new Error(res.error);
                                                                        }
                                                                    }
                                                                } catch (e) {
                                                                    console.error(e);
                                                                    addToast('Failed to secure: ' + e.message, 'error');
                                                                }
                                                            }}
                                                            className="flex-1 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-900 text-xs font-bold rounded-lg transition-colors"
                                                        >
                                                            Confirm
                                                        </button>
                                                        <button
                                                            onClick={() => setIsSecuring(false)}
                                                            className="px-3 py-1.5 bg-transparent hover:bg-slate-800 text-slate-400 text-xs font-medium rounded-lg transition-colors border border-transparent hover:border-slate-700"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <p className="text-[10px] text-amber-200/70 leading-relaxed">
                                                        Link an email and password to secure your progress.
                                                    </p>
                                                    <button
                                                        onClick={() => setIsSecuring(true)}
                                                        className="w-full py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold rounded-lg transition-colors border border-amber-500/20"
                                                    >
                                                        Link Email & Password
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Logout Action */}
                                <div className="pt-4 border-t border-white/5">
                                    <button
                                        onClick={async () => {
                                            try {
                                                if (window.electronAPI) {
                                                    await window.electronAPI.logout();
                                                }
                                                if (onLogout) onLogout();
                                            } catch (e) {
                                                console.error(e);
                                                addToast('Logout failed on server-side', 'error');
                                                if (onLogout) onLogout();
                                            }
                                        }}
                                        className="w-full flex items-center justify-center gap-2 p-3 text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-xl transition-colors border border-transparent hover:border-red-500/20"
                                    >
                                        <LogOut size={16} />
                                        <span className="text-sm font-bold">Log Out</span>
                                    </button>
                                </div>
                            </div>

                        </div>

                        {/* Right Column: Servers, Playtime, & Cosmetics */}
                        <div className="lg:col-span-2 space-y-8">

                            {/* Owned Servers Section */}
                            <div className="bg-slate-800/50 backdrop-blur-md rounded-2xl border border-white/5 p-6 relative overflow-hidden group">
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-xl font-bold text-slate-200 flex items-center gap-2">
                                        <Server className="text-indigo-400" size={20} /> Your Servers
                                    </h2>
                                    <button className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-wider flex items-center gap-1">
                                        <Plus size={14} /> Create New
                                    </button>
                                </div>
                                <div className="flex flex-col items-center justify-center py-12 text-slate-600 gap-3 border border-white/5 rounded-xl bg-slate-900/30 border-dashed">
                                    <Server size={32} className="opacity-50" />
                                    <p className="text-sm font-medium">You don't have any servers yet.</p>
                                </div>
                            </div>

                            {/* Cosmetics Showcase - REAL DATA */}
                            <div className="bg-slate-800/50 backdrop-blur-md rounded-2xl border border-white/5 p-6">
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-xl font-bold text-slate-200 flex items-center gap-2">
                                        <Shirt className="text-pink-400" size={20} /> Cosmetics Showcase
                                    </h2>
                                </div>

                                {isLoadingCosmetics ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-slate-500 gap-3">
                                        <Loader2 size={32} className="animate-spin text-emerald-500" />
                                        <span className="text-xs font-medium">Loading cosmetics...</span>
                                    </div>
                                ) : ownedCosmetics.length > 0 ? (
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        {ownedCosmetics.map((item) => (
                                            <div key={item.id} className="group relative bg-slate-900 rounded-xl p-4 border border-white/5 hover:border-white/20 transition-all duration-300 hover:-translate-y-1">
                                                <div className={`absolute -inset-1 bg-gradient-to-br ${item.color || 'from-slate-700 to-slate-800'} opacity-0 group-hover:opacity-30 blur-xl rounded-xl transition-all duration-500`} />
                                                <div className="relative z-10 flex flex-col items-center text-center space-y-3">
                                                    <div className="w-16 h-16 rounded-lg bg-slate-800 shadow-inner flex items-center justify-center mb-2 group-hover:scale-110 transition-transform duration-300 overflow-hidden">
                                                        {item.texture && <img src={item.texture} className="w-full h-full object-contain" alt={item.name} />}
                                                        {!item.texture && <Crown size={24} className="text-slate-600" />}
                                                    </div>

                                                    <div>
                                                        <div className="text-sm font-bold text-slate-200">{item.name}</div>
                                                        <div className="text-xs text-slate-500 mt-1">{item.type}</div>
                                                    </div>

                                                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${getRarityColor(item.rarity)}`}>
                                                        {item.rarity}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-12 text-slate-500 gap-3 bg-slate-900/30 rounded-xl border border-white/5">
                                        <Shirt size={32} className="opacity-20" />
                                        <div className="text-center">
                                            <p className="text-sm font-bold text-slate-400">No cosmetics found</p>
                                            <p className="text-xs text-slate-600 mt-1">Visit the Wardrobe to equip items.</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfileView;
