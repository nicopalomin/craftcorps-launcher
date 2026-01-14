
import React from 'react';
import { Star, Users, Zap, CheckCircle2 } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

const MOCK_SERVERS = [
    {
        id: 1,
        name: "Hypixel Network",
        players: "45,230",
        description: "The world's largest Minecraft Server. Featuring Bed Wars, SkyBlock, and many more minigames!",
        tags: ["Minigames", "SkyBlock", "PvP"],
        color: "from-amber-400 to-orange-600",
        image: "https://images.unsplash.com/photo-1599587428811-736f8279930f?q=80&w=1000&auto=format&fit=crop"
    },
    {
        id: 2,
        name: "Wynncraft MMORPG",
        players: "2,105",
        description: "The largest MMORPG in Minecraft. Quests, leveling, dungeons, and a massive custom map to explore.",
        tags: ["MMO", "RPG", "Quests"],
        color: "from-emerald-400 to-teal-600",
        image: "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?q=80&w=1000&auto=format&fit=crop"
    },
    {
        id: 3,
        name: "Complex Gaming",
        players: "3,890",
        description: "Pixelmon, Skyblock, Factions, Survival, Creative, and more! Join the best community today.",
        tags: ["Pixelmon", "Survival", "Factions"],
        color: "from-purple-400 to-indigo-600",
        image: "https://images.unsplash.com/photo-1623934199716-dc28818a6ec7?q=80&w=1000&auto=format&fit=crop"
    }
];

const DiscoverView = () => {
    const { addToast } = useToast();

    const handleJoin = (serverName) => {
        addToast(`Connecting to ${serverName}...`, "info");
        // Logic to actually join the server would go here
    };

    return (
        <div className="flex-1 bg-slate-900 overflow-hidden relative flex flex-col select-none">
            {/* Construction Overlay */}
            <div className="absolute inset-0 z-50 flex items-center justify-center backdrop-blur-sm p-8 bg-slate-900/60">
                <div className="border-2 rounded-2xl p-12 max-w-2xl w-full text-center shadow-2xl shadow-black/50 transform rotate-1 bg-slate-900 border-amber-500/50">
                    <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-amber-500/10 mb-6 border border-amber-500/30">
                        <Star size={48} className="text-amber-500" />
                    </div>
                    <h1 className="text-4xl font-bold mb-4 text-white">Under Construction</h1>
                    <p className="text-xl max-w-lg mx-auto leading-relaxed text-slate-400">
                        We're indexing the best servers for you to explore.
                        <br />
                        <span className="text-amber-500 font-bold">Coming Soon to CraftCorps!</span>
                    </p>
                </div>
            </div>

            {/* Blurred Content */}
            <div className="flex-1 flex flex-col overflow-hidden filter blur-sm opacity-50 pointer-events-none">
                {/* Header Section */}
                <div className="relative z-10 p-8 pb-4">
                    <div className="flex items-center gap-4 mb-2">
                        <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center ring-1 ring-amber-500/30">
                            <Star size={24} className="text-amber-400 fill-amber-400/20" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-white tracking-tight">Discover Servers</h1>
                            <p className="text-slate-400">Find your next adventure and join with one click.</p>
                        </div>
                    </div>
                </div>

                {/* Server Grid */}
                <div className="flex-1 overflow-y-auto p-8 pt-4 custom-scrollbar">
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 max-w-7xl mx-auto">
                        {MOCK_SERVERS.map((server) => (
                            <div
                                key={server.id}
                                className="group bg-slate-800/50 hover:bg-slate-800 border border-white/5 hover:border-white/10 rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-black/20 hover:-translate-y-1"
                            >
                                {/* Banner Image */}
                                <div className="h-[60px] bg-slate-900 relative overflow-hidden">
                                    <div className="absolute inset-0 bg-slate-900/20 z-10" />
                                    <div className={`absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent z-20`} />
                                    <img
                                        src={server.image}
                                        alt={server.name}
                                        className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700 opacity-80 group-hover:opacity-100"
                                    />
                                    <div className="absolute top-4 right-4 z-30 bg-black/40 backdrop-blur-md text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1.5 border border-white/10">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                        {server.players} Online
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="p-6">
                                    <h3 className={`text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r ${server.color} mb-2`}>
                                        {server.name}
                                    </h3>
                                    <p className="text-slate-400 text-sm mb-4 line-clamp-2 min-h-[40px]">
                                        {server.description}
                                    </p>

                                    {/* Tags */}
                                    <div className="flex flex-wrap gap-2 mb-6">
                                        {server.tags.map(tag => (
                                            <span key={tag} className="text-xs font-medium text-slate-300 bg-slate-700/50 px-2 py-1 rounded-md border border-white/5">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>

                                    {/* Join Button */}
                                    <button
                                        onClick={() => handleJoin(server.name)}
                                        className="w-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white font-medium py-2.5 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 group/btn"
                                    >
                                        <Zap size={16} className={`group-hover/btn:fill-current group-hover/btn:text-yellow-400 text-slate-400 transition-colors`} />
                                        One-Click Join
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DiscoverView;
