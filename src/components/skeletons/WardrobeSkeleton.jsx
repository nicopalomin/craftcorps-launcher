import React from 'react';

export default function WardrobeSkeleton() {
    return (
        <div className="flex-1 flex flex-col p-8 gap-6 animate-pulse">
            {/* Skin preview skeleton */}
            <div className="flex gap-6">
                <div className="w-96 h-96 bg-slate-800/50 rounded-2xl border border-white/5" />
                <div className="flex-1 flex flex-col gap-4">
                    <div className="h-12 bg-slate-800/50 rounded-xl w-3/4" />
                    <div className="h-8 bg-slate-800/30 rounded-lg w-1/2" />
                    <div className="flex gap-3 mt-4">
                        <div className="h-12 w-32 bg-slate-800/50 rounded-xl" />
                        <div className="h-12 w-32 bg-slate-800/50 rounded-xl" />
                    </div>
                </div>
            </div>

            {/* Categories skeleton */}
            <div className="flex gap-3 mt-6">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-12 w-28 bg-slate-800/50 rounded-xl" />
                ))}
            </div>

            {/* Grid skeleton */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mt-4">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
                    <div key={i} className="aspect-square bg-slate-800/50 rounded-2xl border border-white/5" />
                ))}
            </div>
        </div>
    );
}
