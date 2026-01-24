import React, { useState } from 'react';
import { Lock, Sparkles, Check, Crown } from 'lucide-react';
import Cape3DRender from '../common/Cape3DRender';
import Cape2DRender from '../common/Cape2DRender';
import Model3DRender from '../common/Model3DRender';

const CosmeticCard = ({
    item,
    activeCosmetics,
    toggleCosmetic,
    theme,
    cape3DMode
}) => {
    const [isHovered, setIsHovered] = useState(false);

    const isOwned = item.isOwned === true;
    const isEquipped = activeCosmetics.find(c => c.id === item.id);
    const isFounder = item.id === 'cape_founder';

    let cardBgClass = '';
    if (theme === 'white') {
        cardBgClass = isEquipped
            ? 'bg-slate-50 border-emerald-500'
            : 'bg-white border-slate-200 hover:border-slate-300';
    } else {
        cardBgClass = isEquipped
            ? 'bg-slate-800/60 border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.1)]'
            : 'bg-slate-800/40 border-white/5 hover:border-white/10';
    }

    if (isFounder) {
        cardBgClass = isEquipped
            ? 'bg-gradient-to-br from-amber-900/40 to-purple-900/40 border-amber-500 shadow-[0_0_25px_rgba(245,158,11,0.2)]'
            : 'bg-gradient-to-br from-amber-900/10 to-purple-900/10 border-amber-500/30 hover:border-amber-400';
    }

    if (!isOwned) {
        cardBgClass = theme === 'white'
            ? 'bg-slate-100 border-slate-200 opacity-70'
            : 'bg-slate-900/30 border-white/5 opacity-70';
    }

    return (
        <div
            onClick={() => isOwned && toggleCosmetic(item)}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={`group relative rounded-3xl p-4 border transition-all overflow-hidden ${isOwned ? 'cursor-pointer' : 'cursor-not-allowed'} ${cardBgClass}`}
        >
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.05] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out pointer-events-none" />
            {isEquipped && <div className="equipped-pulse-ring rounded-3xl" />}

            <div className={`aspect-square rounded-2xl mb-4 flex items-center justify-center relative overflow-hidden z-10 ${isFounder ? 'bg-gradient-to-br from-black/80 via-purple-950/40 to-amber-950/40' : 'bg-slate-950 shadow-inner'}`}>
                {!isOwned && (
                    <div className="absolute top-2 right-2 z-20 bg-slate-900/90 backdrop-blur-sm p-1.5 rounded-lg border border-white/10 shadow-lg">
                        <Lock size={14} className="text-slate-400" />
                    </div>
                )}

                {item.texture ? (
                    item.type?.toLowerCase() === 'cape' ? (
                        (cape3DMode && isHovered) ? (
                            <div className={`w-full h-full relative transition-transform duration-700 ${isOwned ? 'scale-105' : ''}`}>
                                <Cape3DRender
                                    capeUrl={item.texture}
                                    className={`w-full h-full ${isFounder ? 'founder-cape-glow' : ''}`}
                                />
                            </div>
                        ) : (
                            <div className={`w-full h-full flex items-center justify-center p-4 transition-transform duration-700 ${isOwned ? 'group-hover:scale-115' : ''}`}>
                                <Cape2DRender
                                    capeUrl={item.texture}
                                    scale={8}
                                    className={`w-auto h-full max-h-[90%] drop-shadow-[0_15px_15px_rgba(0,0,0,0.8)] ${isFounder ? 'founder-cape-glow' : ''}`}
                                />
                            </div>
                        )
                    ) : item.model ? (
                        (cape3DMode && isHovered) ? (
                            <div className={`w-full h-full relative transition-transform duration-700 ${isOwned ? 'scale-105' : ''}`}>
                                <Model3DRender
                                    modelUrl={item.model}
                                    textureUrl={item.texture}
                                    className="w-full h-full"
                                />
                            </div>
                        ) : (
                            <img src={item.texture} alt={item.name} className="w-20 h-20 object-contain drop-shadow-2xl transition-transform duration-700 group-hover:scale-115" />
                        )
                    ) : (
                        <img src={item.texture} alt={item.name} className="w-20 h-20 object-contain drop-shadow-2xl transition-transform duration-700 group-hover:scale-115" />
                    )
                ) : (
                    <Sparkles size={24} className="text-slate-800" />
                )}

                {isEquipped && (
                    <div className="absolute top-3 right-3 bg-emerald-500 text-black p-1.5 rounded-full shadow-xl z-20 animate-in zoom-in duration-500">
                        <Check size={8} strokeWidth={5} />
                    </div>
                )}
            </div>

            <div>
                <h4 className={`text-sm font-bold truncate ${isFounder ? 'text-amber-400' : (theme === 'white' ? 'text-slate-700' : 'text-slate-200')}`}>
                    {item.name}
                </h4>
                <div className="flex items-center justify-between mt-1 opacity-60">
                    <span className="text-[9px] font-black uppercase tracking-widest">
                        {item.type || 'Cosmetic'}
                    </span>
                    {isFounder && (
                        <Crown size={12} className="text-amber-500" />
                    )}
                </div>
            </div>
        </div>
    );
};

export default CosmeticCard;
