export const INITIAL_INSTANCES = [
    {
        id: 'inst_1',
        name: 'Latest Version',
        version: '1.21.1',
        loader: 'Vanilla',
        status: 'Ready',
        lastPlayed: null,
        iconColor: 'bg-emerald-500',
        bgGradient: 'from-emerald-900/40 to-slate-900'
    },
    {
        id: 'inst_2',
        name: 'Fabric Kingdom',
        version: '1.20.1',
        loader: 'Fabric',
        status: 'Ready',
        lastPlayed: null,
        iconColor: 'bg-indigo-500',
        bgGradient: 'from-indigo-900/40 to-slate-900',
        mods: [
            { name: 'Sodium', version: '0.5.3', enabled: true },
            { name: 'Lithium', version: '0.11.2', enabled: true },
            { name: 'Iris Shaders', version: '1.6.10', enabled: true },
            { name: 'Mod Menu', version: '7.2.2', enabled: true },
            { name: 'Fabric API', version: '0.90.0', enabled: true },
            { name: 'Indium', version: '1.0.2', enabled: false },
            { name: 'Continuity', version: '3.0.0-beta', enabled: true },
        ],
        resourcePacks: [
            { name: 'Faithful 32x', enabled: true },
            { name: 'Fresh Animations', enabled: true }
        ]
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

// Fallback versions if API fails
export const FALLBACK_VERSIONS = [
    '1.21.4', '1.21.3', '1.21.1', '1.21',
    '1.20.6', '1.20.5', '1.20.4', '1.20.3', '1.20.2', '1.20.1', '1.20',
    '1.19.4', '1.19.3', '1.19.2', '1.19.1', '1.19',
    '1.18.2', '1.18.1', '1.18',
    '1.17.1', '1.17',
    '1.16.5', '1.16.4', '1.16.3', '1.16.2', '1.16.1',
    '1.15.2', '1.14.4', '1.13.2', '1.12.2', '1.8.9'
];

export const LOADERS = ['Vanilla', 'Fabric', 'Forge', 'Quilt', 'NeoForge'];
export const COLORS = [
    { name: 'Emerald', class: 'bg-emerald-500', grad: 'from-emerald-900/40 to-slate-900' },
    { name: 'Blue', class: 'bg-blue-500', grad: 'from-blue-900/40 to-slate-900' },
    { name: 'Amber', class: 'bg-amber-500', grad: 'from-amber-900/40 to-slate-900' },
    { name: 'Purple', class: 'bg-purple-500', grad: 'from-purple-900/40 to-slate-900' },
    { name: 'Rose', class: 'bg-rose-500', grad: 'from-rose-900/40 to-slate-900' },
    { name: 'Slate', class: 'bg-slate-500', grad: 'from-slate-800 to-slate-950' },
];
