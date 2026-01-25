
import React from 'react';
import { Flame, Server, Search, Sparkles, Crown } from 'lucide-react';

import HeroServerBanner from './HeroServerBanner';
import ServerCard from './ServerCard';
import CompactServerRow from './CompactServerRow';
import SectionHeader from './SectionHeader';

const DiscoverGrid = React.memo(({
    loading,
    servers,
    sections,
    hasMore,
    loadingMore,
    loadServers,
    handleJoin,
    handleCopy,
    joiningServers = new Set(),
    playingServerIp = null,
    isBusy = false,
    handleStop // [NEW]
}) => {
    return (
        <div className="relative z-0">
            {loading ? (
                <div className="max-w-7xl mx-auto space-y-8 pb-16">
                    <div className="h-[400px] w-full bg-slate-800/50 rounded-3xl animate-pulse" />
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {[...Array(2)].map((_, i) => (
                            <div key={i} className="h-64 bg-slate-800/50 rounded-3xl animate-pulse" />
                        ))}
                    </div>
                </div>
            ) : (
                <div className="max-w-7xl mx-auto pb-20 space-y-12">

                    {/* HERO: Most Popular (Seed) */}
                    {sections.hero && (
                        <HeroServerBanner
                            server={sections.hero}
                            onJoin={handleJoin}
                            onCopy={handleCopy}
                            onStop={handleStop} // [NEW]
                            isJoining={joiningServers.has(sections.hero.ip)}
                            isPlaying={playingServerIp === sections.hero.ip}
                            disabled={isBusy}
                        />
                    )}

                    {/* SUB-FEATURED: Next 2 (Seed) */}
                    {sections.subFeatured?.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {sections.subFeatured.map((server) => (
                                <ServerCard
                                    key={`sub-${server.ip}`}
                                    server={server}
                                    variant="big"
                                    onJoin={handleJoin}
                                    onCopy={handleCopy}
                                    onStop={handleStop} // [NEW]
                                    isJoining={joiningServers.has(server.ip)}
                                    isPlaying={playingServerIp === server.ip}
                                    disabled={isBusy}
                                />
                            ))}
                        </div>
                    )}

                    {/* TRENDING: Top 10 List (Seed) */}
                    {sections.trending?.length > 0 && (
                        <div className="space-y-4">
                            <SectionHeader
                                icon={Flame}
                                title="Trending Servers"
                                subtitle="High traffic and growing fast."
                            />
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-3">
                                {sections.trending.map((server, idx) => (
                                    <CompactServerRow
                                        key={`trend-${server.ip}`}
                                        server={server}
                                        rank={idx + 4}
                                        onJoin={handleJoin}
                                        onCopy={handleCopy}
                                        onStop={handleStop} // [NEW]
                                        isJoining={joiningServers.has(server.ip)}
                                        isPlaying={playingServerIp === server.ip}
                                        disabled={isBusy}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* CRAFTCORPS FEATURED (Registered) */}
                    <div className="space-y-4">
                        <SectionHeader
                            icon={Crown}
                            title="CraftCorps Featured"
                            subtitle="Community servers verified by us."
                        />
                        {sections.featuredCorp?.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {sections.featuredCorp.map((server) => (
                                    <ServerCard
                                        key={`feat-${server.ip}`}
                                        server={server}
                                        onJoin={handleJoin}
                                        onCopy={handleCopy}
                                        onStop={handleStop} // [NEW]
                                        isJoining={joiningServers.has(server.ip)}
                                        isPlaying={playingServerIp === server.ip}
                                        disabled={isBusy}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="w-full p-8 rounded-3xl bg-slate-800/40 border border-white/5 flex flex-col items-center justify-center text-center gap-2">
                                <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 mb-2">
                                    <Sparkles size={20} />
                                </div>
                                <h3 className="text-white font-medium">No Featured Servers Yet</h3>
                                <p className="text-slate-400 text-sm max-w-sm">
                                    CraftCorps Featured servers are coming soon!
                                </p>
                            </div>
                        )}
                    </div>

                    {/* MAIN LIST: Explore All */}
                    {sections.list?.length > 0 && (
                        <div className="space-y-4">
                            <SectionHeader
                                icon={sections.hero ? Server : Search}
                                title={sections.hero ? "Explore All" : `Found ${servers.length} Servers`}
                                subtitle={sections.hero ? "Discover hidden gems in the void." : "Results matching your criteria"}
                            />
                            <div
                                className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-3"
                                style={{ contentVisibility: 'auto', containIntrinsicSize: '100px' }}
                            >
                                {sections.list.map((server, idx) => (
                                    <CompactServerRow
                                        key={`list-${server.ip}`}
                                        server={server}
                                        rank={idx + (sections.trending?.length || 0) + 4}
                                        onJoin={handleJoin}
                                        onCopy={handleCopy}
                                        onStop={handleStop} // [NEW]
                                        isJoining={joiningServers.has(server.ip)}
                                        isPlaying={playingServerIp === server.ip}
                                        disabled={isBusy}
                                    />
                                ))}
                            </div>
                            {hasMore && (
                                <div className="flex justify-center pt-8">
                                    <button
                                        onClick={() => loadServers(false)}
                                        disabled={loadingMore}
                                        className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl border border-white/5 transition-colors disabled:opacity-50"
                                    >
                                        {loadingMore ? "Loading More..." : "Load More Servers"}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* PREMIUM EMPTY STATE */}
                    {servers.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-32 px-6 animate-in fade-in zoom-in duration-500">
                            <div className="relative mb-8">
                                <div className="absolute inset-0 bg-blue-500/20 blur-[60px] rounded-full scale-150" />
                                <div className="relative bg-slate-900 border border-white/10 p-8 rounded-3xl shadow-2xl">
                                    <Server size={48} className="text-slate-500 opacity-50" strokeWidth={1.5} />
                                    <div className="absolute -top-1 -right-1 bg-red-500 w-4 h-4 rounded-full border-2 border-slate-900" />
                                </div>
                            </div>

                            <h2 className="text-2xl font-bold text-white mb-3">
                                No Discovery Servers Found
                            </h2>
                            <p className="text-slate-400 text-center max-w-sm mb-10 leading-relaxed">
                                Please check your internet connection and try again later. We couldn't fetch the server list at this time.
                            </p>

                            <button
                                onClick={() => loadServers(true)}
                                className="group relative px-8 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg shadow-blue-900/40 overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                                <span className="relative flex items-center gap-2">
                                    <Sparkles size={18} />
                                    Try Again
                                </span>
                            </button>
                        </div>
                    )}

                    {/* LOAD MORE (Fallback if not inside List header) */}
                    {hasMore && !sections.list?.length && (
                        <div className="flex justify-center pt-8">
                            <button
                                onClick={() => loadServers(false)}
                                disabled={loadingMore}
                                className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl border border-white/5 transition-colors disabled:opacity-50"
                            >
                                {loadingMore ? "Loading More..." : "Load More Servers"}
                            </button>
                        </div>
                    )}

                </div >
            )}
        </div >
    );
});

export default DiscoverGrid;
