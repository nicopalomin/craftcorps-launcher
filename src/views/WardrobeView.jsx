import React from 'react';
import { User, ShieldAlert } from 'lucide-react';
import WardrobePreview from '../components/wardrobe/WardrobePreview';
import WardrobeLibrary from '../components/wardrobe/WardrobeLibrary';
import { useWardrobe } from '../hooks/useWardrobe';

/**
 * WardrobeView Component
 * High-level view for character customization (Skins and Cosmetics).
 * Uses useWardrobe hook for state and business logic.
 */
const WardrobeView = ({ theme, activeAccount, isActive }) => {
    const {
        activeTab,
        setActiveTab,
        savedSkins,
        currentSkin,
        selectedSkin,
        setSelectedSkin,
        activeCosmetics,
        isLoadingCosmetics,
        isProcessing,
        editingSkinId,
        editName,
        setEditName,
        cape3DMode,
        setCape3DMode,
        startEditing,
        saveName,
        handleImportSkin,
        handleApplySkin,
        handleDeleteSkin,
        toggleCosmetic,
        categorizedCosmetics,
        viewerSkin,
        unequippedCosmeticSlots,
        refreshCosmetics,
        isInitializing
    } = useWardrobe(activeAccount);

    return (
        <div className="flex-1 overflow-hidden h-full flex flex-col relative bg-slate-950 p-8 animate-in fade-in slide-in-from-bottom-4 duration-500 select-none">
            {/* Deep FX Layers */}
            <div className="noise-overlay" />
            <div className="vignette-overlay" />

            {/* Header Area */}
            <div className="px-8 pt-4 pb-4 flex items-end justify-between relative z-20">
                <div className="flex flex-col">
                    <span className="label-caps mb-2">Character Customization</span>
                    <h1 className="typography-wardrobe-title text-white">Wardrobe</h1>
                </div>

                {/* Status Pill Cluster */}
                <div className="flex items-center gap-3">
                    {activeAccount?.type?.toLowerCase() === 'offline' && (
                        <div className="status-pill border-amber-500/30 text-amber-500 animate-in fade-in duration-700">
                            <ShieldAlert size={12} className="shrink-0" />
                            <span>Offline Profile · Limited Sync</span>
                            <button className="ml-1 text-[9px] hover:underline opacity-60">Learn more</button>
                        </div>
                    )}
                    <div className="status-pill text-slate-400">
                        <User size={12} />
                        <span>{activeAccount?.name || 'Guest'}</span>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex flex-row min-h-0 p-8 pt-4 gap-8 relative z-20 h-full">
                {/* Left Column: Preview */}
                <WardrobePreview
                    viewerSkin={viewerSkin}
                    activeCosmetics={activeCosmetics}
                    handleImportSkin={handleImportSkin}
                    handleApplySkin={handleApplySkin}
                    isProcessing={isProcessing}
                    selectedSkin={selectedSkin}
                    activeAccount={activeAccount}
                    theme={theme}
                    isActive={isActive}
                    isInitializing={isInitializing}
                />

                {/* Right Column: Library */}
                <WardrobeLibrary
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    theme={theme}
                    cape3DMode={cape3DMode}
                    setCape3DMode={setCape3DMode}
                    currentSkin={currentSkin}
                    selectedSkin={selectedSkin}
                    setSelectedSkin={setSelectedSkin}
                    savedSkins={savedSkins}
                    handleDeleteSkin={handleDeleteSkin}
                    editingSkinId={editingSkinId}
                    editName={editName}
                    setEditName={setEditName}
                    startEditing={startEditing}
                    saveName={saveName}
                    handleImportSkin={handleImportSkin}
                    isLoadingCosmetics={isLoadingCosmetics}
                    categorizedCosmetics={categorizedCosmetics}
                    unequippedCosmeticSlots={unequippedCosmeticSlots}
                    activeCosmetics={activeCosmetics}
                    toggleCosmetic={toggleCosmetic}
                    refreshCosmetics={refreshCosmetics}
                />
            </div>
        </div>
    );
};

export default WardrobeView;
