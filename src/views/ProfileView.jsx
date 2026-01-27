import React, { useState, useEffect } from 'react';
import {
    User, Sparkles, Shirt,
    Shield, Box, Star, Users,
    Gamepad2, Globe, CheckCircle2,
    Server, Crown,
    ShieldAlert, Loader2, Plus, LogOut,
    AlertTriangle, Settings
} from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { fetchPlayerCosmetics, fetchDetailedCosmetics, fetchAllCosmetics, getCosmeticTextureUrl } from '../utils/cosmeticsApi';
import { FALLBACK_COSMETICS } from '../data/fallbackCosmetics';
import Cape2DRender from '../components/common/Cape2DRender';
import InstanceIcon from '../components/common/InstanceIcon';

const getRarityColor = (rarity) => {
    switch (rarity) {
        case 'Legendary': return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
        case 'Epic': return 'text-purple-400 border-purple-500/30 bg-purple-500/10';
        case 'Rare': return 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10';
        default: return 'text-slate-400 border-slate-500/30 bg-slate-500/10';
    }
};

const formatPlayTime = (ms) => {
    if (!ms) return '0m';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
};

const CosmeticCard = ({ item }) => {
    const [imgError, setImgError] = useState(false);

    // Determine render methodology
    const isCape = item.type && item.type.toUpperCase() === 'CAPE';

    return (
        <div className="group relative bg-slate-900 rounded-xl p-4 border border-white/5 hover:border-white/20 transition-all duration-300 hover:-translate-y-1">
            <div className={`absolute -inset-1 bg-gradient-to-br ${item.color || 'from-slate-700 to-slate-800'} opacity-0 group-hover:opacity-30 blur-xl rounded-xl transition-all duration-500`} />
            <div className="relative z-10 flex flex-col items-center text-center space-y-3">
                <div className="w-16 h-16 rounded-lg bg-slate-800 shadow-inner flex items-center justify-center mb-2 group-hover:scale-110 transition-transform duration-300 overflow-hidden">
                    {!imgError && item.texture ? (
                        isCape ? (
                            <div className="w-full h-full flex items-center justify-center p-1">
                                <Cape2DRender
                                    capeUrl={item.texture}
                                    scale={5}
                                    className="h-full object-contain drop-shadow-lg"
                                />
                            </div>
                        ) : (
                            <img
                                src={item.texture}
                                className="w-full h-full object-contain"
                                alt={item.name}
                                onError={() => setImgError(true)}
                            />
                        )
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <Shirt size={24} className="text-slate-500 opacity-50" />
                        </div>
                    )}
                </div>

                <div>
                    <div className="text-sm font-bold text-slate-200">{item.name}</div>
                    <div className="text-xs text-slate-500 mt-1">{item.type}</div>
                </div>

                {item.rarity && item.rarity.toLowerCase() !== 'common' && item.rarity.toLowerCase() !== 'none' && (
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${getRarityColor(item.rarity)}`}>
                        {item.rarity}
                    </span>
                )}
            </div>
        </div>
    );
};



const ProfileView = ({ activeAccount, accounts, instances, theme, onLogout, onLogoutAll, setActiveTab, setShowProfileMenu }) => {
    const { addToast } = useToast();

    // Data States
    const [ownedCosmetics, setOwnedCosmetics] = useState([]);
    const [isLoadingCosmetics, setIsLoadingCosmetics] = useState(false);
    const [linkedAccounts, setLinkedAccounts] = useState([]);
    const [isLoadingProfile, setIsLoadingProfile] = useState(false);
    const [totalPlayTime, setTotalPlayTime] = useState(0);
    const [joinedDate, setJoinedDate] = useState(null);

    // Secure Account State
    const [isSecuring, setIsSecuring] = useState(false);
    const [secEmail, setSecEmail] = useState('');
    const [secPass, setSecPass] = useState('');

    // Logout Modal State
    const [showLogoutModal, setShowLogoutModal] = useState(false);

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

                    if (res.profile.createdAt) {
                        const date = new Date(res.profile.createdAt);
                        setJoinedDate(date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));
                    }
                }
            }

            // Fetch Total Playtime from locally tracked data
            if (window.electronAPI?.getTotalPlayTime) {
                const ms = await window.electronAPI.getTotalPlayTime();
                setTotalPlayTime(ms || 0);
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
        <div className="relative flex-1 overflow-hidden mask-linear-fade bg-slate-950 select-none">
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto h-full p-8 pb-20 custom-scrollbar">
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
                                        <span className="bg-slate-900/50 px-3 py-1 rounded-full border border-white/5 select-all cursor-text text-[10px] md:text-sm">
                                            UUID: {activeAccount?.uuid || 'N/A'}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1 items-center md:items-start opacity-70">
                                    <div className="flex justify-center md:justify-start">
                                        <span className="text-slate-500 font-mono text-[10px] uppercase tracking-widest pl-1">
                                            Auth ID: <span className="text-slate-400 select-all cursor-text">{activeAccount?.id || 'N/A'}</span>
                                        </span>
                                    </div>
                                    {joinedDate && (
                                        <div className="flex justify-center md:justify-start">
                                            <span className="text-slate-500 font-mono text-[10px] uppercase tracking-widest pl-1">
                                                Member Since: <span className="text-slate-400 select-all cursor-text">{joinedDate}</span>
                                            </span>
                                        </div>
                                    )}
                                    {linkedAccounts.length > 0 && (
                                        <div className="flex justify-center md:justify-start">
                                            <span className="text-slate-500 font-mono text-[10px] uppercase tracking-widest pl-1">
                                                Account ID: <span className="text-slate-400 select-all cursor-text">{linkedAccounts[0]?.id || 'N/A'}</span>
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="text-xs text-slate-500 font-medium mt-6">
                            Manage your account settings and preferences.
                        </div>

                        {/* Integrated Seeds Balance */}
                        <div className="absolute top-8 right-8 w-52 h-24 bg-slate-900/40 backdrop-blur-md border border-white/10 rounded-[1.5rem] p-5 flex flex-col justify-between transition-all hover:border-emerald-500/30 group/seeds shadow-2xl">
                            <div className="text-emerald-500 font-black uppercase text-[11px] tracking-[0.2em] opacity-80 group-hover/seeds:opacity-100 transition-opacity">
                                Seeds
                            </div>
                            <div className="flex items-baseline justify-end gap-2 leading-none">
                                <span className="text-4xl font-black text-white tabular-nums tracking-tighter drop-shadow-md">0</span>
                                <span className="text-sm font-bold text-slate-500 tracking-wide">Seeds</span>
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
                                    Statistics
                                </h2>
                                <div className="grid grid-cols-1 gap-3">
                                    <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-white/5 hover:border-emerald-500/30 transition-colors">
                                        <div className="flex items-center gap-3 text-slate-400">
                                            <Box size={16} />
                                            <span>Instances Created</span>
                                        </div>
                                        <span className="text-white font-mono">{instances?.length || 0}</span>
                                    </div>

                                    <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-white/5 hover:border-blue-500/30 transition-colors">
                                        <div className="flex items-center gap-3 text-slate-400">
                                            <Gamepad2 size={16} />
                                            <span>Total Playtime</span>
                                        </div>
                                        <span className="text-white font-mono">{formatPlayTime(totalPlayTime)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Game Accounts Card */}
                            <div className="bg-slate-800/50 backdrop-blur-md rounded-2xl border border-white/5 p-6 space-y-4">
                                <h2 className="text-xl font-bold text-slate-200 flex items-center gap-2">
                                    <Users className="text-blue-400" size={20} /> Game Accounts
                                </h2>
                                <div className="space-y-3">
                                    {accounts?.map((acc) => (
                                        <div
                                            key={acc.id || acc.uuid}
                                            className={`group relative flex items-center gap-3 p-2.5 rounded-xl border transition-all ${activeAccount?.id === acc.id
                                                ? 'bg-emerald-500/10 border-emerald-500/30'
                                                : 'bg-slate-900/50 border-white/5 hover:border-white/10'
                                                }`}
                                        >
                                            <div className="relative">
                                                <img
                                                    src={`https://mc-heads.net/avatar/${acc.uuid || acc.id}/64`}
                                                    alt={acc.name}
                                                    className="w-10 h-10 rounded-lg bg-slate-800 object-cover rendering-pixelated"
                                                />
                                                {activeAccount?.id === acc.id && (
                                                    <div className="absolute -bottom-1 -right-1 bg-slate-900 rounded-full p-0.5">
                                                        <div className="w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-900" />
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className={`text-sm font-bold truncate ${activeAccount?.id === acc.id ? 'text-white' : 'text-slate-300'}`}>
                                                    {acc.name}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-white/5 uppercase tracking-wide">
                                                        {acc.type || 'offline'}
                                                    </span>
                                                </div>
                                            </div>

                                            {activeAccount?.id !== acc.id && (
                                                <button
                                                    onClick={() => addToast('Account switching is available in the top menu', 'info')}
                                                    className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                                                    title="Switch Account"
                                                >
                                                    <LogOut size={14} className="rotate-180" />
                                                </button>
                                            )}
                                        </div>
                                    ))}


                                </div>
                            </div>

                            {/* Account Management Card */}
                            <div className="bg-slate-800/50 backdrop-blur-md rounded-2xl border border-white/5 p-6 space-y-6 relative overflow-hidden">
                                <h2 className="text-xl font-bold text-slate-200 flex items-center gap-2">
                                    <Shield className="text-blue-400" size={20} /> Account Connections
                                </h2>

                                {/* Link Actions */}
                                <div className="relative">
                                    {/* Blurred Content */}
                                    <div className="space-y-3 blur-[2px] pointer-events-none opacity-40">
                                        <h3 className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Linked Accounts</h3>

                                        {/* Microsoft */}
                                        <div className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-900/50 border border-white/5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-[#0078D4]/20 text-[#0078D4] flex items-center justify-center">
                                                    <Globe size={16} />
                                                </div>
                                                <div className="text-left">
                                                    <div className="text-sm font-medium text-slate-200">Microsoft Account</div>
                                                    <div className="text-[10px] text-slate-500">Link your Minecraft Profile</div>
                                                </div>
                                            </div>
                                            <Plus size={16} className="text-slate-500" />
                                        </div>

                                        {/* Discord */}
                                        <div className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-900/50 border border-white/5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-[#5865F2]/20 text-[#5865F2] flex items-center justify-center">
                                                    <Gamepad2 size={16} />
                                                </div>
                                                <div className="text-left">
                                                    <div className="text-sm font-medium text-slate-200">Discord</div>
                                                    <div className="text-[10px] text-slate-500">Link for community rewards</div>
                                                </div>
                                            </div>
                                            <Plus size={16} className="text-slate-500" />
                                        </div>

                                        <div className="pt-4 border-t border-white/5 space-y-3">
                                            <div className="flex items-center gap-2 text-amber-400">
                                                <ShieldAlert size={16} />
                                                <span className="text-xs font-bold">Unsecured Account</span>
                                            </div>
                                            <p className="text-[10px] text-amber-200/70">Link an email and password to secure progress.</p>
                                        </div>
                                    </div>

                                    {/* Coming Soon Overlay */}
                                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-center p-6 bg-slate-900/10 rounded-2xl">
                                        <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl p-6 border border-white/10 shadow-2xl flex flex-col items-center gap-2 max-w-[240px]">
                                            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center mb-1">
                                                <Shield size={20} className="text-blue-400" />
                                            </div>
                                            <span className="text-lg font-black text-white uppercase tracking-tighter">Coming Soon</span>
                                            <p className="text-xs font-medium text-slate-400 leading-relaxed">
                                                We're adding new way to help you login faster.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Logout Action */}
                                <div className="pt-4 border-t border-white/5">
                                    <button
                                        onClick={() => setShowLogoutModal(true)}
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

                            {/* Instances Section */}
                            <div className="bg-slate-800/50 backdrop-blur-md rounded-2xl border border-white/5 p-6 relative overflow-hidden group">
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-xl font-bold text-slate-200 flex items-center gap-2">
                                        <Box className="text-indigo-400" size={20} /> Instances
                                    </h2>
                                </div>
                                {instances && instances.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {instances.map((inst) => (
                                            <div key={inst.id} className="group relative bg-slate-900/50 rounded-xl p-3 border border-white/5 hover:border-white/20 transition-all flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg overflow-hidden border border-white/5 flex-shrink-0">
                                                    <InstanceIcon instance={inst} size={40} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-bold text-slate-200 truncate">{inst.name}</div>
                                                    <div className="text-[10px] text-slate-500 flex items-center gap-1.5">
                                                        <span className="bg-slate-800 px-1 rounded uppercase tracking-wide">{inst.loader} {inst.version}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-12 text-slate-600 gap-3 bg-slate-900/30 rounded-xl border border-dashed border-white/5">
                                        <Box size={32} className="opacity-50" />
                                        <p className="text-sm font-medium">You don't have any crops yet.</p>
                                    </div>
                                )}
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
                                            <CosmeticCard key={item.id} item={item} />
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

                            {/* Owned Servers Section */}
                            <div className="bg-slate-800/50 backdrop-blur-md rounded-2xl border border-white/5 p-6 relative overflow-hidden group">
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-xl font-bold text-slate-200 flex items-center gap-2">
                                        <Server className="text-indigo-400" size={20} /> Your Servers
                                    </h2>
                                </div>
                                <div className="flex flex-col items-center justify-center py-12 text-slate-600 gap-3 border border-white/5 rounded-xl bg-slate-900/30 border-dashed">
                                    <Server size={32} className="opacity-50" />
                                    <div className="text-center">
                                        <p className="text-sm font-bold text-slate-400 tracking-wide">Server management coming soon...</p>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </div>

            {/* Logout Confirmation Modal */}
            {showLogoutModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-md"
                        onClick={() => setShowLogoutModal(false)}
                    />
                    <div className="relative bg-slate-900 border border-white/10 rounded-[2rem] p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
                        <div className="flex flex-col items-center text-center space-y-6">
                            <div className="w-16 h-16 bg-amber-500/20 rounded-2xl flex items-center justify-center">
                                <AlertTriangle className="text-amber-500" size={32} />
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-xl font-bold text-white">Confirm Logout</h3>
                                <p className="text-sm text-slate-400 leading-relaxed">
                                    You will be logged out of all Minecraft accounts and your CraftCorps account.
                                    Progress and instances will be saved, but you will need to log in again.
                                </p>
                                <p className="text-xs text-amber-500/70 pt-2 italic">
                                    Want to remove only one account? Use the account switching menu instead.
                                </p>
                            </div>

                            <div className="flex flex-col w-full gap-3">
                                <button
                                    onClick={async () => {
                                        setShowLogoutModal(false);
                                        try {
                                            if (window.electronAPI) {
                                                await window.electronAPI.logout();
                                            }
                                            if (onLogoutAll) onLogoutAll();
                                        } catch (e) {
                                            console.error(e);
                                            addToast('Logout failed on server-side', 'error');
                                            if (onLogoutAll) onLogoutAll();
                                        }
                                    }}
                                    className="w-full py-3.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                                >
                                    <LogOut size={16} /> Log Out Everywhere
                                </button>

                                <button
                                    onClick={() => {
                                        setShowLogoutModal(false);
                                        setActiveTab('home');
                                        setTimeout(() => setShowProfileMenu(true), 100);
                                    }}
                                    className="w-full py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                                >
                                    <Settings size={16} /> Open Account Switcher
                                </button>

                                <button
                                    onClick={() => setShowLogoutModal(false)}
                                    className="w-full py-2 text-slate-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest mt-2"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProfileView;
