import React, { useState } from 'react';
import {
    User, CreditCard, Shirt, Link as LinkIcon,
    Clock, Shield, Box, Star, Mail,
    Gamepad2, Globe, CheckCircle2, MoreHorizontal,
    Calendar, Award, Layout, Server, Crown, Activity
} from 'lucide-react';

const ProfileView = ({ activeAccount, accounts, instances, theme }) => {
    // Mock Data
    const walletBalance = 1250;
    const votes = 42;
    const playtime = "142h 30m";
    const accountStatus = "Verified";

    // New Stats Data
    const memberSince = "Nov 2023";
    const themesOwned = 12;
    const badges = [
        { id: 'b1', name: 'Early Bird', icon: '🐦', color: 'bg-sky-500/10 text-sky-400 border-sky-500/20' },
        { id: 'b2', name: 'Bug Hunter', icon: '🐛', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
        { id: 'b3', name: 'Supporter', icon: '💎', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
    ];

    const serversOwned = [
        { id: 1, name: 'SMP Season 4', status: 'Online', players: '12/50', type: 'Survival' },
        { id: 2, name: 'Creative Plot', status: 'Offline', players: '0/20', type: 'Creative' },
    ];

    const mostPlayedServers = [
        { id: 's1', name: 'Hypixel', ip: 'mc.hypixel.net', time: '420h', icon: 'https://api.mcsrvstat.us/icon/mc.hypixel.net' },
        { id: 's2', name: 'Wynncraft', ip: 'play.wynncraft.com', time: '150h', icon: 'https://api.mcsrvstat.us/icon/play.wynncraft.com' },
    ];

    // Mock Cosmetics
    const cosmetics = [
        { id: 1, name: "Golden Cape", type: "Cape", rarity: "Legendary", color: "from-yellow-400 to-amber-600" },
        { id: 2, name: "Emerald Wings", type: "Back", rarity: "Epic", color: "from-emerald-400 to-teal-600" },
        { id: 3, name: "Diamond Halo", type: "Head", rarity: "Rare", color: "from-cyan-400 to-blue-600" },
        { id: 4, name: "Obsidian Shield", type: "Hand", rarity: "Epic", color: "from-slate-700 to-black" },
        { id: 5, name: "Ruby Amulet", type: "Neck", rarity: "Common", color: "from-red-400 to-rose-600" },
    ];

    // Mock Connections
    const [connections, setConnections] = useState([
        { provider: 'Google', connected: true, email: 'player@gmail.com', icon: Globe },
        { provider: 'Discord', connected: false, icon: Gamepad2 },
        { provider: 'Apple', connected: false, icon: Box }, // Placeholder icon
    ]);

    const handleConnect = (provider) => {
        // Placeholder for connection logic
        console.log(`Connect to ${provider}`);
    };

    const getRarityColor = (rarity) => {
        switch (rarity) {
            case 'Legendary': return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
            case 'Epic': return 'text-purple-400 border-purple-500/30 bg-purple-500/10';
            case 'Rare': return 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10';
            default: return 'text-slate-400 border-slate-500/30 bg-slate-500/10';
        }
    };

    return (
        <div className="flex-1 overflow-y-auto h-full p-8 pb-20 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
            <div className="max-w-6xl mx-auto space-y-8">

                {/* Header Profile Card */}
                <div className="relative overflow-hidden bg-slate-800/50 backdrop-blur-md rounded-2xl border border-white/5 p-8">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-3xl rounded-full -mr-32 -mt-32 pointer-events-none" />

                    <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
                        {/* Avatar / Head */}
                        <div className="relative group">
                            <div className="w-32 h-32 rounded-2xl bg-slate-900 border-4 border-slate-700 overflow-hidden shadow-2xl transition-transform duration-500 hover:scale-105">
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
                            <div className="absolute -bottom-2 -right-2 bg-slate-900 rounded-full p-1.5 border border-slate-700">
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
                                    <span className="bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/20 flex items-center gap-2">
                                        <Shield size={12} /> {accountStatus}
                                    </span>
                                    <span className="bg-slate-700/30 text-slate-300 px-3 py-1 rounded-full border border-white/5 flex items-center gap-2">
                                        <Calendar size={12} /> Since {memberSince}
                                    </span>
                                </div>
                            </div>

                            {/* Badges Row */}
                            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                                {badges.map((badge) => (
                                    <div key={badge.id} className={`px-2 py-1 rounded-md border ${badge.color} text-xs font-medium flex items-center gap-1.5`} title={badge.name}>
                                        <span>{badge.icon}</span>
                                        <span>{badge.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Wallet Balance */}
                        <div className="flex flex-col items-center md:items-end justify-center bg-slate-900/50 p-4 rounded-xl border border-white/5 min-w-[200px]">
                            <div className="flex items-center gap-2 text-slate-400 mb-1">
                                <CreditCard size={16} />
                                <span className="uppercase text-xs font-bold tracking-wider">Wallet Balance</span>
                            </div>
                            <div className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-300 to-yellow-500">
                                {walletBalance.toLocaleString()} <span className="text-sm text-yellow-500/50">CC</span>
                            </div>
                            <button className="mt-2 text-xs text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1">
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
                                <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-white/5">
                                    <div className="flex items-center gap-3 text-slate-400">
                                        <Clock size={16} />
                                        <span>Total Playtime</span>
                                    </div>
                                    <span className="text-white font-mono">{playtime}</span>
                                </div>
                                <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-white/5">
                                    <div className="flex items-center gap-3 text-slate-400">
                                        <Box size={16} />
                                        <span>Instances Created</span>
                                    </div>
                                    <span className="text-white font-mono">{instances?.length || 0}</span>
                                </div>
                                <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-white/5">
                                    <div className="flex items-center gap-3 text-slate-400">
                                        <CheckCircle2 size={16} />
                                        <span>Server Votes</span>
                                    </div>
                                    <span className="text-white font-mono">{votes}</span>
                                </div>
                                <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-white/5">
                                    <div className="flex items-center gap-3 text-slate-400">
                                        <Layout size={16} />
                                        <span>Themes Owned</span>
                                    </div>
                                    <span className="text-white font-mono">{themesOwned}</span>
                                </div>
                            </div>
                        </div>

                        {/* Connections Card */}
                        <div className="bg-slate-800/50 backdrop-blur-md rounded-2xl border border-white/5 p-6 space-y-4">
                            <h2 className="text-xl font-bold text-slate-200 flex items-center gap-2">
                                <LinkIcon className="text-blue-400" size={20} /> Linked Accounts
                            </h2>
                            <div className="space-y-2">
                                {connections.map((conn) => (
                                    <div key={conn.provider} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-white/5 group hover:border-white/10 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-white transition-colors">
                                                <conn.icon size={16} />
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-slate-200">{conn.provider}</div>
                                                {conn.connected && (
                                                    <div className="text-xs text-slate-500">{conn.email}</div>
                                                )}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleConnect(conn.provider)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${conn.connected
                                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                                }`}
                                        >
                                            {conn.connected ? 'Connected' : 'Connect'}
                                        </button>
                                    </div>
                                ))}
                            </div>

                            {/* Minecraft Accounts List */}
                            <div className="pt-4 border-t border-white/5">
                                <h3 className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wider">Minecraft Accounts</h3>
                                <div className="space-y-2">
                                    {(accounts && accounts.length > 0 ? accounts : [activeAccount]).map((acc) => (
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
                            </div>
                        </div>

                    </div>

                    {/* Right Column: Servers, Playtime, & Cosmetics */}
                    <div className="lg:col-span-2 space-y-8">

                        {/* Owned Servers Section */}
                        <div className="bg-slate-800/50 backdrop-blur-md rounded-2xl border border-white/5 p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold text-slate-200 flex items-center gap-2">
                                    <Server className="text-indigo-400" size={20} /> Your Servers
                                </h2>
                                <button className="text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-1">
                                    Manage All <MoreHorizontal size={16} />
                                </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {serversOwned.map((server) => (
                                    <div key={server.id} className="group relative bg-slate-900 rounded-xl p-4 border border-white/5 hover:border-white/20 transition-all duration-300">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                                                    <Box size={20} />
                                                </div>
                                                <div>
                                                    <div className="text-base font-bold text-white">{server.name}</div>
                                                    <div className="text-xs text-slate-400">{server.type}</div>
                                                </div>
                                            </div>
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold border ${server.status === 'Online' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-700/30 text-slate-400 border-slate-600/30'}`}>
                                                {server.status}
                                            </span>
                                        </div>
                                        <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                                            <span>Players: {server.players}</span>
                                            <button className="text-indigo-400 hover:text-indigo-300 transition-colors">
                                                Dashboard &rarr;
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {/* Add New Server Card */}
                                <div className="group bg-slate-900/30 border border-dashed border-slate-700 rounded-xl p-4 flex flex-col items-center justify-center gap-2 hover:bg-slate-800/50 hover:border-slate-500 transition-all cursor-pointer min-h-[100px]">
                                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 group-hover:text-indigo-400 transition-colors">
                                        <MoreHorizontal size={16} />
                                    </div>
                                    <span className="text-sm font-medium text-slate-500 group-hover:text-indigo-400 transition-colors">Create Server</span>
                                </div>
                            </div>
                        </div>

                        {/* Most Played Servers Section */}
                        <div className="bg-slate-800/50 backdrop-blur-md rounded-2xl border border-white/5 p-6">
                            <h2 className="text-xl font-bold text-slate-200 flex items-center gap-2 mb-6">
                                <Activity className="text-orange-400" size={20} /> Most Played Servers
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {mostPlayedServers.map((server) => (
                                    <div key={server.id} className="flex items-center gap-4 bg-slate-900 rounded-xl p-4 border border-white/5">
                                        <img src={server.icon} alt={server.name} className="w-12 h-12 rounded-lg bg-slate-800" />
                                        <div className="flex-1 min-w-0">
                                            <div className="text-base font-bold text-white truncate">{server.name}</div>
                                            <div className="text-xs text-slate-500 truncate">{server.ip}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-mono text-orange-400">{server.time}</div>
                                            <div className="text-[10px] text-slate-600 uppercase">Played</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-4 text-center">
                                <span className="text-[10px] uppercase tracking-widest text-slate-600/60 font-medium">
                                    Requires CraftCorps Client
                                </span>
                            </div>
                        </div>

                        {/* Cosmetics Showcase */}
                        <div className="bg-slate-800/50 backdrop-blur-md rounded-2xl border border-white/5 p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold text-slate-200 flex items-center gap-2">
                                    <Shirt className="text-pink-400" size={20} /> Cosmetics
                                </h2>
                                <button className="text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-1">
                                    View Wardrobe <MoreHorizontal size={16} />
                                </button>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {cosmetics.map((item) => (
                                    <div key={item.id} className="group relative bg-slate-900 rounded-xl p-4 border border-white/5 hover:border-white/20 transition-all duration-300 hover:-translate-y-1">
                                        <div className={`absolute inset-0 bg-gradient-to-br ${item.color} opacity-0 group-hover:opacity-10 rounded-xl transition-opacity duration-500`} />

                                        <div className="relative z-10 flex flex-col items-center text-center space-y-3">
                                            <div className="w-16 h-16 rounded-lg bg-slate-800 shadow-inner flex items-center justify-center mb-2 group-hover:scale-110 transition-transform duration-300">
                                                {/* Placeholder for cosmetic preview */}
                                                <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${item.color}`} />
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

                                {/* Add New / Shop Card */}
                                <div className="group relative bg-slate-900/50 border border-dashed border-slate-700 rounded-xl p-4 flex flex-col items-center justify-center gap-2 hover:bg-slate-800/50 hover:border-slate-500 transition-all cursor-pointer">
                                    <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 group-hover:text-emerald-400 transition-colors">
                                        <MoreHorizontal size={20} />
                                    </div>
                                    <span className="text-sm font-medium text-slate-500 group-hover:text-emerald-400 transition-colors">Browse Shop</span>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfileView;
