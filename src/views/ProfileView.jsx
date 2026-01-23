import React, { useState, useEffect } from 'react';
import {
    User, CreditCard, Shirt, Link as LinkIcon,
    Clock, Shield, Box, Star, Mail,
    Gamepad2, Globe, CheckCircle2, MoreHorizontal,
    Calendar, Award, Layout, Server, Crown, Activity,
    ShieldAlert, Loader2, Plus
} from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { fetchPlayerCosmetics, fetchDetailedCosmetics, fetchAllCosmetics, getCosmeticTextureUrl } from '../utils/cosmeticsApi';
import { FALLBACK_COSMETICS } from '../data/fallbackCosmetics';

const ComingSoonOverlay = ({ title = "Coming Soon", description }) => (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm rounded-2xl select-none border border-white/5 transition-all duration-500">
        <div className="bg-slate-900/90 p-4 rounded-xl border border-white/10 flex flex-col items-center animate-in zoom-in-95 duration-300 shadow-2xl">
            <span className="text-xs font-bold text-emerald-400 tracking-widest uppercase mb-1 flex items-center gap-2">
                <Clock size={12} /> {title}
            </span>
            {description && <span className="text-[10px] text-slate-400 text-center max-w-[150px] leading-tight">{description}</span>}
        </div>
    </div>
);

const ProfileView = ({ activeAccount, accounts, instances, theme }) => {
    const { addToast } = useToast();

    // Data States
    const [ownedCosmetics, setOwnedCosmetics] = useState([]);
    const [isLoadingCosmetics, setIsLoadingCosmetics] = useState(false);

    // Mock Data for "Coming Soon" Backgrounds
    const mockServers = [
        { id: 1, name: 'SMP Season 4', status: 'Online', players: '12/50', type: 'Survival' },
        { id: 2, name: 'Creative Plot', status: 'Offline', players: '0/20', type: 'Creative' },
    ];

    const mockMostPlayed = [
        { id: 's1', name: 'Hypixel', ip: 'mc.hypixel.net', time: '420h', icon: 'https://api.mcsrvstat.us/icon/mc.hypixel.net' },
        { id: 's2', name: 'Wynncraft', ip: 'play.wynncraft.com', time: '150h', icon: 'https://api.mcsrvstat.us/icon/play.wynncraft.com' },
    ];

    const mockSocials = [
        { provider: 'Google', connected: true, email: 'player@gmail.com', icon: Globe },
        { provider: 'Discord', connected: false, icon: Gamepad2 },
    ];

    // Load Cosmetics Logic (Simplified from WardrobeView)
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
                if (activeAccount.accessToken) {
                    try {
                        const detailed = await fetchDetailedCosmetics(activeAccount.accessToken, uuid);
                        if (detailed && detailed.cosmetics) {
                            ownedIds = detailed.cosmetics.map(c => c.cosmeticId);
                        }
                    } catch (e) {
                        // Fallback
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
                        color: c.color || 'from-slate-700 to-slate-900' // Fallback color
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

    // Status Logic
    const isOffline = activeAccount?.type === 'offline';
    const statusText = isOffline ? 'Offline Mode' : 'Verified';
    const statusColor = isOffline ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    const StatusIcon = isOffline ? ShieldAlert : Shield;

    return (
        <div className="relative flex-1 overflow-hidden mask-linear-fade bg-slate-950">
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto h-full p-8 pb-20 custom-scrollbar">
                <div className="max-w-6xl mx-auto space-y-8">

                    {/* Header Profile Card */}
                    <div className="relative overflow-hidden bg-slate-800/50 backdrop-blur-md rounded-2xl border border-white/5 p-8">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-3xl rounded-full -mr-32 -mt-32 pointer-events-none" />

                        <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
                            {/* Avatar / Head */}
                            <div className="relative group">
                                {/* Skin Render Glow */}
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
                                        {/* Member Since - Hidden if not available (Real Data Policy) */}
                                    </div>
                                </div>

                                <div className="text-xs text-slate-500 font-medium">
                                    Manage your account settings and preferences.
                                </div>
                            </div>

                            {/* Wallet Balance - COMING SOON */}
                            <div className="relative overflow-hidden flex flex-col items-center md:items-end justify-center bg-slate-900/50 p-4 rounded-xl border border-white/5 min-w-[200px]">
                                <ComingSoonOverlay title="Wallet" description="Economy system coming soon" />
                                {/* Mock Content Under Blur */}
                                <div className="flex items-center gap-2 text-slate-400 mb-1 blur-sm opacity-50">
                                    <CreditCard size={16} />
                                    <span className="uppercase text-xs font-bold tracking-wider">Wallet Balance</span>
                                </div>
                                <div className="text-3xl font-bold text-slate-600 blur-sm opacity-50">
                                    1,250 <span className="text-sm">CC</span>
                                </div>
                                <button className="mt-2 text-xs text-slate-500 flex items-center gap-1 blur-sm opacity-50">
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
                                    {/* Real Data: Instances Created */}
                                    <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-white/5 hover:border-emerald-500/30 transition-colors">
                                        <div className="flex items-center gap-3 text-slate-400">
                                            <Box size={16} />
                                            <span>Instances Created</span>
                                        </div>
                                        <span className="text-white font-mono">{instances?.length || 0}</span>
                                    </div>

                                    {/* Placeholder for future stats - Optional or just hide */}
                                    {/* Hiding other stats as they are not real yet */}
                                </div>
                            </div>

                            {/* Connections Card */}
                            <div className="bg-slate-800/50 backdrop-blur-md rounded-2xl border border-white/5 p-6 space-y-4 relative overflow-hidden">
                                <h2 className="text-xl font-bold text-slate-200 flex items-center gap-2">
                                    <LinkIcon className="text-blue-400" size={20} /> Linked Accounts
                                </h2>

                                {/* Minecraft Accounts (Real) */}
                                <div className="space-y-2">
                                    <h3 className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Minecraft Accounts</h3>
                                    {(accounts && accounts.length > 0 ? accounts : (activeAccount ? [activeAccount] : [])).map((acc) => (
                                        acc && (
                                            <div key={acc.id} className={`flex items-center gap-3 p-2 rounded-lg border transition-colors ${acc.id === activeAccount?.id ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-slate-900/30 border-transparent hover:bg-slate-900/50'}`}>
                                                <img
                                                    src={`https://mc-heads.net/avatar/${acc.uuid || acc.id}/32`}
                                                    alt={acc.name}
                                                    className="w-8 h-8 rounded-md"
                                                />
                                                <div className="flex-1 overflow-hidden">
                                                    <div className={`text-sm font-medium truncate ${acc.id === activeAccount?.id ? 'text-emerald-400' : 'text-slate-300'}`}>
                                                        {acc.name}
                                                    </div>
                                                    <div className="text-[10px] text-slate-500 truncate">
                                                        {acc.type === 'microsoft' ? 'Microsoft' : 'Offline'}
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    ))}
                                </div>

                                {/* Socials (Coming Soon) */}
                                <div className="relative pt-4 mt-4 border-t border-white/5 min-h-[100px] rounded-lg overflow-hidden">
                                    <ComingSoonOverlay title="Socials" description="Link Discord & more soon" />
                                    <div className="space-y-2 blur-sm opacity-40">
                                        {mockSocials.map((conn) => (
                                            <div key={conn.provider} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-white/5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                                                        <conn.icon size={16} />
                                                    </div>
                                                    <span className="text-sm font-medium text-slate-200">{conn.provider}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                        </div>

                        {/* Right Column: Servers, Playtime, & Cosmetics */}
                        <div className="lg:col-span-2 space-y-8">

                            {/* Owned Servers Section - COMING SOON */}
                            <div className="bg-slate-800/50 backdrop-blur-md rounded-2xl border border-white/5 p-6 relative overflow-hidden group">
                                <ComingSoonOverlay title="Server Managers" description="Host your own servers" />
                                <div className="flex items-center justify-between mb-6 blur-sm opacity-40">
                                    <h2 className="text-xl font-bold text-slate-200 flex items-center gap-2">
                                        <Server className="text-indigo-400" size={20} /> Your Servers
                                    </h2>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 blur-sm opacity-40 hover:opacity-50 transition-opacity duration-700">
                                    {mockServers.map((server) => (
                                        <div key={server.id} className="bg-slate-900 rounded-xl p-4 border border-white/5">
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-12 h-12 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                                                        <Box size={20} />
                                                    </div>
                                                    <div>
                                                        <div className="text-base font-bold text-white">{server.name}</div>
                                                        <div className="text-xs text-slate-400">{server.type}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Most Played Servers Section - COMING SOON */}
                            <div className="bg-slate-800/50 backdrop-blur-md rounded-2xl border border-white/5 p-6 relative overflow-hidden">
                                <ComingSoonOverlay title="Server Tracker" description="Track your playtime" />
                                <h2 className="text-xl font-bold text-slate-200 flex items-center gap-2 mb-6 blur-sm opacity-40">
                                    <Activity className="text-orange-400" size={20} /> Most Played Servers
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 blur-sm opacity-40">
                                    {mockMostPlayed.map((server) => (
                                        <div key={server.id} className="flex items-center gap-4 bg-slate-900 rounded-xl p-4 border border-white/5">
                                            <div className="w-12 h-12 rounded-lg bg-slate-800" />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-base font-bold text-white truncate">{server.name}</div>
                                                <div className="text-xs text-slate-500 truncate">{server.ip}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Cosmetics Showcase - REAL DATA */}
                            <div className="bg-slate-800/50 backdrop-blur-md rounded-2xl border border-white/5 p-6">
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-xl font-bold text-slate-200 flex items-center gap-2">
                                        <Shirt className="text-pink-400" size={20} /> Cosmetics Showcase
                                    </h2>
                                    {/* Optional: Link to Wardrobe */}
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
                                                {/* widget background glow */}
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
