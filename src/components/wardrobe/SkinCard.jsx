import React from 'react';
import { Trash2, Edit2, Check } from 'lucide-react';
import Skin2DRender from '../common/Skin2DRender';

const SkinCard = ({
    skin,
    selectedSkin,
    isCurrentMojang = false,
    theme,
    editingSkinId,
    editName,
    setSelectedSkin,
    handleDeleteSkin,
    startEditing,
    setEditName,
    saveName
}) => {
    const isSelected = skin.id === selectedSkin?.id;

    let cardClass = '';
    if (theme === 'white') {
        cardClass = isSelected
            ? 'bg-slate-50 border-emerald-500 ring-1 ring-emerald-500/20'
            : 'bg-white border-slate-200 hover:border-slate-300';
    } else {
        cardClass = isSelected
            ? 'bg-slate-800/60 border-emerald-500'
            : 'bg-slate-800/40 border-white/5 hover:border-white/10';
    }

    return (
        <div
            onClick={() => setSelectedSkin(skin)}
            className={`group relative rounded-3xl p-4 border transition-all cursor-pointer overflow-hidden ${cardClass}`}
        >
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.05] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out pointer-events-none" />
            <div className={`aspect-[3/4] rounded-2xl ${isCurrentMojang ? 'bg-emerald-950/20' : 'bg-slate-900/60'} mb-4 flex items-center justify-center relative border border-white/5 p-2`}>
                {isCurrentMojang && <div className="equipped-pulse-ring" />}

                <Skin2DRender
                    skinUrl={skin.skinUrl}
                    model={skin.model || 'classic'}
                    scale={6}
                    className="w-full h-full object-contain drop-shadow-[0_12px_12px_rgba(0,0,0,0.6)] relative z-10"
                />

                {isCurrentMojang && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-emerald-500 text-black text-[9px] font-black px-3 py-1 rounded-full shadow-lg z-20 flex items-center gap-1.5 whitespace-nowrap">
                        <Check size={10} strokeWidth={4} /> EQUIPPED
                    </div>
                )}

                {!isCurrentMojang && (
                    <button
                        onClick={(e) => handleDeleteSkin(e, skin.id)}
                        className="absolute top-3 right-3 bg-red-500/80 hover:bg-red-500 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-lg hover:scale-110 active:scale-95 z-20"
                    >
                        <Trash2 size={12} />
                    </button>
                )}
            </div>
            <div className="px-1">
                {editingSkinId === skin.id ? (
                    <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') saveName();
                            e.stopPropagation();
                        }}
                        onBlur={saveName}
                        autoFocus
                        className={`w-full text-sm font-bold bg-transparent border-b outline-none ${theme === 'white' ? 'border-emerald-500 text-slate-800' : 'border-emerald-500 text-white'}`}
                    />
                ) : (
                    <div className="flex items-center gap-1.5 group/name">
                        <h4
                            onClick={(e) => !isCurrentMojang && startEditing(e, skin)}
                            className={`text-sm font-bold truncate ${!isCurrentMojang ? 'cursor-text hover:text-emerald-400' : ''} transition-colors ${theme === 'white' ? 'text-slate-700' : 'text-slate-200'} max-w-[80%]`}
                            title={!isCurrentMojang ? "Click to rename" : ""}
                        >
                            {skin.name}
                        </h4>
                        {!isCurrentMojang && (
                            <button
                                onClick={(e) => startEditing(e, skin)}
                                className={`opacity-0 group-hover:opacity-100 group-hover/name:opacity-100 transition-all ${theme === 'white' ? 'text-slate-400 hover:text-emerald-500' : 'text-slate-500 hover:text-emerald-400'}`}
                            >
                                <Edit2 size={12} />
                            </button>
                        )}
                    </div>
                )}
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                    {isCurrentMojang ? 'Mojang Official' : skin.type}
                </p>
            </div>
        </div>
    );
};

export default SkinCard;
