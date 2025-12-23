export const INITIAL_INSTANCES = [
    {
        id: 'inst_1',
        name: 'Vanilla Harvest',
        version: '1.20.4',
        loader: 'Fabric',
        status: 'Ready',
        lastPlayed: null,
        iconColor: 'bg-emerald-500',
        bgGradient: 'from-emerald-900/40 to-slate-900'
    },
    {
        id: 'inst_2',
        name: 'Tech & Turnips',
        version: '1.19.2',
        loader: 'Forge',
        status: 'Update Available',
        lastPlayed: null,
        iconColor: 'bg-blue-500',
        bgGradient: 'from-blue-900/40 to-slate-900'
    },
    {
        id: 'inst_3',
        name: 'SkyBlock: Organic',
        version: '1.12.2',
        loader: 'Vanilla',
        status: 'Ready',
        lastPlayed: null,
        iconColor: 'bg-amber-500',
        bgGradient: 'from-amber-900/40 to-slate-900'
    }
];

export const MOCK_ACCOUNTS = [];

export const SKINS = [
    { id: 1, name: 'Farmer Classic', type: 'Slim', used: true, color: 'bg-emerald-600' },
    { id: 2, name: 'Redstone Engineer', type: 'Classic', used: false, color: 'bg-red-600' },
    { id: 3, name: 'Deep Dark Diver', type: 'Classic', used: false, color: 'bg-slate-700' },
];

export const ADS = [
    {
        id: 1,
        title: "Herobattles Server",
        description: "Join now at play.herobattles.net",
        color: "text-amber-400",
        bg: "bg-amber-500/10",
        border: "border-amber-500/20"
    }
];

export const VERSIONS = ['1.20.4', '1.20.1', '1.19.4', '1.19.2', '1.18.2', '1.16.5', '1.12.2'];
export const LOADERS = ['Vanilla', 'Fabric', 'Forge', 'Quilt', 'NeoForge'];
export const COLORS = [
    { name: 'Emerald', class: 'bg-emerald-500', grad: 'from-emerald-900/40 to-slate-900' },
    { name: 'Blue', class: 'bg-blue-500', grad: 'from-blue-900/40 to-slate-900' },
    { name: 'Amber', class: 'bg-amber-500', grad: 'from-amber-900/40 to-slate-900' },
    { name: 'Purple', class: 'bg-purple-500', grad: 'from-purple-900/40 to-slate-900' },
    { name: 'Rose', class: 'bg-rose-500', grad: 'from-rose-900/40 to-slate-900' },
    { name: 'Slate', class: 'bg-slate-500', grad: 'from-slate-800 to-slate-950' },
];
