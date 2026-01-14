import React from 'react';
import Shimmer from '../common/Shimmer';

const HomeSkeleton = ({ theme }) => {
    // Determine background style based on theme matchng InstanceHero styles
    const cardBg = theme === 'white'
        ? 'bg-white/60 border-slate-200'
        : 'bg-slate-900/40 border-white/5';

    return (
        <div className="flex flex-col items-center w-full max-w-4xl mx-auto px-8 pb-8 pt-10 animate-in fade-in duration-500">
            {/* Vertical Hero Skeleton matching default InstanceHero */}

            {/* Icon */}
            <div className="mb-8">
                <Shimmer className="w-32 h-32 rounded-3xl" />
            </div>

            {/* Title */}
            <Shimmer className="h-12 w-64 rounded-xl mb-6" />

            {/* Tags */}
            <div className="flex justify-center gap-3 mb-8">
                <Shimmer className="h-8 w-16 rounded-lg" />
                <Shimmer className="h-8 w-24 rounded-lg" />
                <Shimmer className="h-8 w-20 rounded-lg" />
            </div>

            {/* Play Button */}
            <Shimmer className="w-full max-w-sm h-20 rounded-2xl" />

            {/* Last Played Text */}
            <Shimmer className="mt-6 h-4 w-48 rounded" />
        </div>
    );
};

export default HomeSkeleton;
