import React from 'react';

export default function DiscoverSkeleton() {
    return (
        <div className="flex-1 flex flex-col p-8 gap-6 animate-pulse overflow-hidden">
            {/* Search bar skeleton */}
            <div className="flex gap-4 items-center">
                <div className="flex-1 h-14 bg-slate-800/50 rounded-2xl border border-white/5" />
                <div className="h-14 w-14 bg-slate-800/50 rounded-xl" />
            </div>

            {/* Filters skeleton */}
            <div className="flex gap-3 overflow-x-auto pb-2">
                {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="h-10 w-24 bg-slate-800/50 rounded-xl flex-shrink-0" />
                ))}
            </div>

            {/* Hero card skeleton */}
            <div className="w-full h-64 bg-slate-800/50 rounded-3xl border border-white/5" />

            {/* Sub-featured grid skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-48 bg-slate-800/50 rounded-2xl border border-white/5" />
                ))}
            </div>

            {/* Server list skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-6">
                {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                    <div key={i} className="h-40 bg-slate-800/50 rounded-2xl border border-white/5" />
                ))}
            </div>
        </div>
    );
}
