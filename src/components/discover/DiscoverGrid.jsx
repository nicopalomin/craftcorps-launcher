
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
        <div className="flex-1 overflow-y-auto p-8 pt-0 custom-scrollbar relative z-0">
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
                                right={
                                    hasMore ? (
                                        <button
                                            onClick={() => loadServers(false)}
                                            disabled={loadingMore}
                                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg border border-white/5 transition-colors disabled:opacity-50"
                                        >
                                            {loadingMore ? "Loading..." : "Load More"}
                                        </button>
                                    ) : null
                                }
                            />
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-3">
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
                        </div>
                    )}

                    {/* EMPTY STATE */}
                    {servers.length === 0 && (
                        <div className="text-center py-20 text-slate-500">
                            No servers found matching your criteria.
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
