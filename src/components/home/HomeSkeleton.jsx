import React from 'react';
import Shimmer from '../common/Shimmer';

const HomeSkeleton = ({ theme }) => {
    // Determine background style based on theme matchng InstanceHero styles
    const cardBg = theme === 'white'
        ? 'bg-white/60 border-slate-200'
        : 'bg-slate-900/40 border-white/5';

    return (
        <div className="flex flex-col items-center w-full max-w-7xl mx-auto px-8 pb-8 pt-16 animate-in fade-in duration-500">
            {/* Hero Card Skeleton */}
            <div className={`flex items-start gap-8 w-full p-8 rounded-3xl backdrop-blur-sm shadow-xl border ${cardBg}`}>

                {/* Icon */}
                <Shimmer className="w-24 h-24 rounded-3xl shrink-0" />

                {/* Content */}
                <div className="flex-1 space-y-4 py-2">
                    {/* Title */}
                    <Shimmer className="h-10 w-1/3 rounded-lg" />

                    {/* Tags */}
                    <div className="flex gap-3 mt-4">
                        <Shimmer className="h-8 w-20 rounded-lg" />
                        <Shimmer className="h-8 w-24 rounded-lg" />
                        <Shimmer className="h-8 w-16 rounded-lg" />
                    </div>
                </div>

                {/* Play Button Area */}
                <Shimmer className="w-64 h-20 rounded-2xl shrink-0" />
            </div>

            {/* Content Area Skeleton (Mods list etc) */}
            <div className={`mt-8 w-full h-[600px] rounded-3xl border backdrop-blur-sm overflow-hidden flex flex-col ${cardBg}`}>
                {/* Tabs */}
                <div className="flex justify-center p-6 border-b border-white/5">
                    <Shimmer className="h-10 w-72 rounded-xl" />
                </div>

                {/* List Items */}
                <div className="p-8 space-y-4 flex-1">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="flex items-center gap-4 p-2">
                            <Shimmer className="w-12 h-12 rounded-lg shrink-0" />
                            <div className="flex-1 space-y-3">
                                <Shimmer className="h-5 w-1/4 rounded" />
                                <Shimmer className="h-3 w-1/2 rounded" />
                            </div>
                            <Shimmer className="w-24 h-8 rounded-lg shrink-0" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default HomeSkeleton;
