import React from 'react';
import { Sprout } from 'lucide-react';

const LoadingScreen = () => {
    return (
        <div className="fixed inset-0 bg-slate-950 flex items-center justify-center z-[100]">
            {/* Background Pattern */}
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5" />

            {/* Gradient Orbs */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl animate-pulse delay-700" />

            {/* Main Content */}
            <div className="relative z-10 flex flex-col items-center gap-8 animate-in fade-in zoom-in-95 duration-500">
                {/* Logo/Icon */}
                <div className="relative">
                    <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-2xl shadow-emerald-900/50 animate-bounce-slow">
                        <Sprout size={48} className="text-white" />
                    </div>
                    {/* Spinning Ring */}
                    <div className="absolute inset-0 rounded-3xl border-4 border-transparent border-t-emerald-400 animate-spin" />
                </div>

                {/* Text */}
                <div className="text-center">
                    <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400 mb-2">
                        CraftCorps
                    </h1>
                    <p className="text-slate-400 text-sm animate-pulse">
                        Preparing your crops...
                    </p>
                </div>

                {/* Loading Bar */}
                <div className="w-64 h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 animate-loading-bar" />
                </div>
            </div>
        </div>
    );
};

export default LoadingScreen;
