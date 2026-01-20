import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Maximize2, Upload, HardDrive, User, Check, PlusCircle, Sparkles, Shirt, Save, Trash2, Edit2, Crown, Lock } from 'lucide-react';
import { SKINS } from '../data/mockData';
// import { MOCK_COSMETICS } from '../data/cosmetics'; // Removed
import SkinViewer from '../components/common/SkinViewer';
import Skin2DRender from '../components/common/Skin2DRender';
import Cape2DRender from '../components/common/Cape2DRender';
import { useToast } from '../contexts/ToastContext';
import { v4 as uuidv4 } from 'uuid';
import { fetchPlayerCosmetics, equipCosmetic, getCosmeticTextureUrl, fetchAllCosmetics, fetchDetailedCosmetics } from '../utils/cosmeticsApi';
import { FALLBACK_COSMETICS } from '../data/fallbackCosmetics';

const WardrobeView = ({ theme, activeAccount }) => {
    const { t } = useTranslation();
    const { addToast } = useToast();
    const [activeTab, setActiveTab] = useState('skins');

    // Saved Skins Library (Local Storage)
    const [savedSkins, setSavedSkins] = useState(() => {
        try {
            const saved = localStorage.getItem('craftcorps_saved_skins');
            return saved ? JSON.parse(saved) : [];
        } catch (e) { return []; }
    });

    // Update localStorage
    useEffect(() => {
        localStorage.setItem('craftcorps_saved_skins', JSON.stringify(savedSkins));
    }, [savedSkins]);

    // Current Equipped Skin on Mojang
    const [currentSkin, setCurrentSkin] = useState({
        skinUrl: null,
        capeUrl: null,
        model: 'classic'
    });

    // Currently Selected for Preview
    const [selectedSkin, setSelectedSkin] = useState(null);
    const [activeCosmetics, setActiveCosmetics] = useState([]);

    // Available Cosmetics (Fetched from API)
    const [ownedCosmetics, setOwnedCosmetics] = useState([]);
    const [isLoadingCosmetics, setIsLoadingCosmetics] = useState(false);

    // Loading States
    const [isLoading, setIsLoading] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    // Edit State
    const [editingSkinId, setEditingSkinId] = useState(null);
    const [editName, setEditName] = useState("");

    const startEditing = (e, skin) => {
        e.stopPropagation();
        setEditingSkinId(skin.id);
        setEditName(skin.name);
    }

    const saveName = () => {
        if (!editingSkinId) return;

        setSavedSkins(prev => prev.map(s =>
            s.id === editingSkinId ? { ...s, name: editName } : s
        ));

        // Update selectedSkin if we are editing the currently selected one
        if (selectedSkin && selectedSkin.id === editingSkinId) {
            setSelectedSkin(prev => ({ ...prev, name: editName }));
        }

        setEditingSkinId(null);
    }


    // Load active account skin
    const loadCurrentSkin = async (username) => {
        if (!username) return;
        setIsLoading(true);
        // Force reset
        setCurrentSkin(prev => ({ ...prev, skinUrl: null }));

        try {
            await new Promise(r => setTimeout(r, 100));
            const data = await window.electronAPI.getMinecraftSkin(username);

            if (data && !data.error) {
                console.log("[Wardrobe] Current Skin loaded:", data.skinUrl);
                const newData = {
                    id: 'current_mojang',
                    skinUrl: `${data.skinUrl}?t=${Date.now()}`,
                    capeUrl: data.capeUrl,
                    model: data.model,
                    name: 'Current Skin',
                    type: data.model === 'slim' ? 'Slim' : 'Classic',
                    source: 'mojang'
                };
                setCurrentSkin(newData);

                // If nothing selected, select current
                if (!selectedSkin) {
                    setSelectedSkin(newData);
                }
            } else {
                setCurrentSkin(prev => ({ ...prev, skinUrl: null }));
            }
        } catch (err) {
            console.error("Skin fetch error:", err);
        } finally {
            setIsLoading(false);
        }
    };

    // Load Cosmetics
    const loadCosmetics = async (username) => {
        console.log('[Wardrobe] loadCosmetics called for:', username);
        setIsLoadingCosmetics(true);
        try {
            console.log('[Wardrobe] Fetching catalog from API...');
            // 1. Fetch Catalog (All)
            const allCosmetics = await fetchAllCosmetics();
            console.log('[Wardrobe] API returned:', allCosmetics.length, 'cosmetics');

            // Use fallback if API is not deployed yet
            const catalogData = allCosmetics.length > 0 ? allCosmetics : FALLBACK_COSMETICS;

            // 2. Fetch Player Owned details
            let ownedIds = [];
            let activeSet = new Set();

            if (activeAccount) {
                let uuid = activeAccount.uuid || activeAccount.id;
                if (!uuid || uuid.length < 32) {
                    // Try to fetch UUID if missing
                    const data = await window.electronAPI.getMinecraftSkin(activeAccount.name);
                    if (data?.uuid) uuid = data.uuid;
                }

                if (uuid && uuid.length >= 32) {
                    // A. Use Authenticated Detailed Endpoint (Preferred)
                    if (activeAccount.accessToken) {
                        try {
                            const detailed = await fetchDetailedCosmetics(activeAccount.accessToken, uuid);
                            if (detailed && detailed.cosmetics) {
                                ownedIds = detailed.cosmetics.map(c => c.cosmeticId);
                                detailed.cosmetics.forEach(c => {
                                    if (c.isActive) activeSet.add(c.cosmeticId);
                                });
                                console.log('[Wardrobe] Loaded detailed cosmetics via Auth:', ownedIds);
                            }
                        } catch (err) {
                            console.warn("Auth fetch failed, falling back to public", err);
                        }
                    }

                    // B. Fallback to Public Endpoint if no auth or auth failed (and no owned found yet)
                    if (ownedIds.length === 0) {
                        ownedIds = await fetchPlayerCosmetics(uuid);
                    }
                }
            }

            // 3. Merge & Update State
            const enriched = catalogData.map(c => {
                // Handle texture URL - convert relative paths to full API URLs
                let textureUrl = c.textureUrl;
                if (textureUrl && textureUrl.startsWith('/')) {
                    // Relative path from API - convert to full URL
                    textureUrl = `https://api.craftcorps.net${textureUrl}`;
                } else if (!textureUrl) {
                    // No texture URL - use the cosmetic ID endpoint
                    textureUrl = getCosmeticTextureUrl(c.cosmeticId);
                }

                const id = c.cosmeticId; // Normalize
                return {
                    ...c,
                    texture: textureUrl,
                    id: id,
                    type: c.type || 'cape',
                    isOwned: ownedIds.includes(id)
                };
            });

            console.log('[Wardrobe] Enriched cosmetics:', enriched.length);

            setOwnedCosmetics(enriched);

            // Sync Active Cosmetics from Server State
            // Only update if we actually found ownership data (to rely on server state)
            if (activeSet.size > 0) {
                const activeItems = enriched.filter(c => activeSet.has(c.id));
                setActiveCosmetics(activeItems);
            } else if (ownedIds.length > 0) {
                // If we own items but server says none are active, clear active?
                // Or keep local default? Usually clear to match server.
                // But if fallback public API was used, it doesn't return active state.
                // activeSet is only populated by authenticated call.
                // So only clear if we successfully did authenticated call? 
                // Difficult to track exact success path here without boolean.
                // For now, if we have accessToken, we assume we want server state.
                if (activeAccount.accessToken) {
                    setActiveCosmetics([]);
                }
            }

        } catch (e) {
            console.error("Failed to load cosmetics", e);
            setOwnedCosmetics([]);
        } finally {
            setIsLoadingCosmetics(false);
        }
    }


    useEffect(() => {
        console.log('[Wardrobe] useEffect triggered, activeAccount:', activeAccount?.name);
        if (activeAccount?.name) {
            loadCurrentSkin(activeAccount.name);
            loadCosmetics(activeAccount.name); // Pass name, but logic uses UUID from account obj
        }
    }, [activeAccount]);

    const toggleCosmetic = async (cosmetic) => {
        // Equip Logic
        const isEquipped = activeCosmetics.find(c => c.id === cosmetic.id);

        try {
            if (isEquipped) {
                // Unequip?
                // If the API supports unequip (send null? or separate endpoint?).
                // Prompt only mentioned "Equip".
                // Let's assume re-clicking un-equips locally or we send empty ID?
                // For now, let's just toggle local state visually, but if we want to persist:
                // await equipCosmetic(activeAccount.accessToken, ""); // Maybe?
                setActiveCosmetics(prev => prev.filter(c => c.id !== cosmetic.id));
            } else {
                // Equip
                //  await equipCosmetic(activeAccount.accessToken, cosmetic.id);

                // Cosmetic logic: Only one cape at a time?
                setActiveCosmetics(prev => {
                    if (cosmetic.type === 'cape') {
                        return [...prev.filter(c => c.type !== 'cape'), cosmetic];
                    }
                    return [...prev, cosmetic];
                });

                await equipCosmetic(activeAccount.accessToken, cosmetic.id);
                addToast(`Equipped ${cosmetic.name}`, 'success');
            }
        } catch (e) {
            addToast("Failed to equip cosmetic", 'error');
            console.error(e);
        }
    };

    const handleImportSkin = async () => {
        try {
            const result = await window.electronAPI.showOpenDialog({
                title: "Import Skin",
                filters: [{ name: 'Images', extensions: ['png'] }],
                properties: ['openFile']
            });

            if (result.canceled || result.filePaths.length === 0) return;

            const filePath = result.filePaths[0];
            setIsProcessing(true);

            // Read and Validate
            const fileData = await window.electronAPI.readSkinFile(filePath);

            if (!fileData.success) {
                addToast(`Import failed: ${fileData.error}`, "error");
                setIsProcessing(false);
                return;
            }

            // Create Skin Object
            const newSkin = {
                id: uuidv4(),
                name: `Imported Skin ${savedSkins.length + 1}`,
                skinUrl: fileData.dataUri, // Base64 for viewing
                filePath: filePath, // For uploading
                model: 'classic', // Default, maybe ask user?
                type: 'Classic',
                dateAdded: Date.now(),
                source: 'local'
            };

            // Add to library
            setSavedSkins(prev => [newSkin, ...prev]);

            // Select it for preview
            setSelectedSkin(newSkin);
            addToast("Skin imported to Library!", "success");

        } catch (e) {
            console.error(e);
            addToast("Failed to import skin", "error");
        } finally {
            setIsProcessing(false);
        }
    };

    const backupCurrentSkin = async () => {
        if (!currentSkin?.skinUrl) return;

        try {
            // Strip params
            const cleanUrl = currentSkin.skinUrl.split('?')[0];
            const res = await fetch(cleanUrl);
            if (!res.ok) return;

            const blob = await res.blob();
            const base64 = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(blob);
            });

            // Check duplicates
            const isDuplicate = savedSkins.some(s => s.skinUrl === base64);
            if (isDuplicate) return;

            const newSkin = {
                id: uuidv4(),
                name: `Previous Skin (${new Date().toLocaleDateString()})`,
                skinUrl: base64,
                model: currentSkin.model,
                type: currentSkin.model === 'slim' ? 'Slim' : 'Classic',
                dateAdded: Date.now(),
                source: 'backup'
            };

            setSavedSkins(prev => [newSkin, ...prev]);
            addToast("Previous skin backed up to library", "success");

        } catch (e) {
            console.error("Backup failed", e);
        }
    };

    const handleApplySkin = async () => {
        if (!activeAccount) {
            addToast("Please login first!", "error");
            return;
        }

        if (!selectedSkin) return;

        // If it's already the current skin, do nothing
        if (selectedSkin.id === 'current_mojang' || selectedSkin.source === 'mojang') {
            addToast("This skin is already equipped!", "info");
            return;
        }

        if (!selectedSkin.filePath) {
            addToast("Cannot upload this skin (Missing file path).", "error");
            return;
        }

        // Backup current skin before applying new one
        await backupCurrentSkin();

        setIsProcessing(true);
        try {
            const variant = selectedSkin.model === 'slim' ? 'slim' : 'classic';

            const uploadRes = await window.electronAPI.uploadMinecraftSkin(
                activeAccount.accessToken,
                selectedSkin.filePath,
                variant
            );

            if (uploadRes.success) {
                addToast("Skin uploaded! Verifying...", "success");
                await new Promise(resolve => setTimeout(resolve, 4000));

                // Reload current skin from Mojang
                await loadCurrentSkin(activeAccount.name);

                addToast("Skin applied successfully!", "success");
            } else {
                addToast(`Upload failed: ${uploadRes.error}`, "error");
            }

        } catch (e) {
            console.error(e);
            addToast("Failed to apply skin", "error");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDeleteSkin = (e, id) => {
        e.stopPropagation();
        setSavedSkins(prev => prev.filter(s => s.id !== id));
        if (selectedSkin?.id === id) setSelectedSkin(currentSkin);
    };

    // Determine what to show in viewer
    const viewerSkin = selectedSkin || currentSkin;

    return (
        <div className="flex-1 p-8 animate-in fade-in slide-in-from-bottom-4 duration-300 flex flex-col h-full overflow-hidden relative select-none">
            <h2 className={`text-3xl font-bold mb-6 ${theme === 'white' ? 'text-slate-800' : 'text-white'}`}>{t('wardrobe_title')}</h2>

            <div className="flex flex-col lg:flex-row gap-8 flex-1 min-h-0">
                {/* Left Column: Preview */}
                <div className="lg:w-1/3 flex flex-col gap-4">
                    <div className="flex-1 flex flex-col items-center justify-center relative group min-h-[400px]">

                        {/* 3D Model Viewer */}
                        <div className="relative z-10 w-full h-full flex items-center justify-center">
                            {viewerSkin.skinUrl ? (
                                <SkinViewer
                                    skinUrl={viewerSkin.skinUrl}
                                    capeUrl={viewerSkin.capeUrl}
                                    model={viewerSkin.model}
                                    cosmetics={activeCosmetics}
                                    nameTag={activeAccount?.name || 'Player'}
                                />
                            ) : (
                                <div className="text-slate-500 flex flex-col items-center gap-2">
                                    <User size={48} className="opacity-50" />
                                    <span>{activeAccount ? (isLoading ? 'Loading...' : 'No Skin Selected') : 'No Account Selected'}</span>
                                </div>
                            )}
                        </div>

                        {/* Drag hint */}
                        <div className="absolute bottom-4 text-xs font-medium text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 backdrop-blur-sm px-3 py-1 rounded-full pointer-events-none">
                            Drag to rotate
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={handleImportSkin}
                            disabled={isProcessing}
                            className={`flex-1 py-3 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors border ${theme === 'white' ? 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300' : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'} ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <Upload size={16} /> Import Skin
                        </button>
                        <button
                            onClick={handleApplySkin}
                            disabled={isProcessing || !selectedSkin || selectedSkin.source === 'mojang'}
                            className={`flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white py-3 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors`}
                        >
                            {isProcessing ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : <Save size={16} />}
                            {isProcessing ? 'Applying...' : 'Apply to Minecraft'}
                        </button>
                    </div>
                </div>

                {/* Right Column: Library */}
                <div className={`flex-1 rounded-2xl border p-6 flex flex-col min-h-0 ${theme === 'white' ? 'bg-white/60 border-slate-200' : 'bg-slate-900/50 border-slate-800'}`}>

                    {/* Tabs */}
                    <div className="flex gap-4 mb-6 border-b border-slate-700/50 pb-2">
                        <button
                            onClick={() => setActiveTab('skins')}
                            className={`pb-2 font-bold text-sm transition-colors flex items-center gap-2 ${activeTab === 'skins' ? 'text-emerald-500 border-b-2 border-emerald-500 -mb-2.5' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            <Shirt size={16} /> My Skins
                        </button>
                        <button
                            onClick={() => setActiveTab('cosmetics')}
                            className={`pb-2 font-bold text-sm transition-colors flex items-center gap-2 ${activeTab === 'cosmetics' ? 'text-emerald-500 border-b-2 border-emerald-500 -mb-2.5' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            <Sparkles size={16} /> Cosmetics
                        </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 overflow-y-auto pr-2 custom-scrollbar">

                        {activeTab === 'skins' ? (
                            <>
                                {/* Current Equipped Card */}
                                {currentSkin.skinUrl && (
                                    <div
                                        onClick={() => setSelectedSkin(currentSkin)}
                                        className={`group relative rounded-xl p-3 border transition-all cursor-pointer ${theme === 'white' ? (currentSkin.id === selectedSkin?.id ? 'bg-slate-50 border-emerald-500 ring-1 ring-emerald-500/20' : 'bg-white border-slate-200 hover:border-slate-300') : (currentSkin.id === selectedSkin?.id ? 'bg-slate-800 border-emerald-500 ring-1 ring-emerald-500/20' : 'bg-slate-800 border-slate-700 hover:border-slate-500')}`}
                                    >
                                        <div className="aspect-[3/4] rounded-lg bg-emerald-900/20 mb-3 flex items-center justify-center relative overflow-hidden p-2">
                                            {/* Render 2D Front View */}
                                            <Skin2DRender
                                                skinUrl={currentSkin.skinUrl}
                                                model={currentSkin.model}
                                                scale={5}
                                                className="w-full h-full object-contain drop-shadow-xl"
                                            />
                                            <div className="absolute top-2 right-2 bg-emerald-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm">EQUIPPED</div>
                                        </div>
                                        <div className="mb-2">
                                            <h4 className={`text-sm font-bold truncate ${theme === 'white' ? 'text-slate-700' : 'text-slate-200'}`}>Current Skin</h4>
                                            <p className="text-xs text-slate-500">Mojang</p>
                                        </div>
                                    </div>
                                )}

                                {/* Validation: Saved Skins */}
                                {savedSkins.map(skin => (
                                    <div
                                        key={skin.id}
                                        onClick={() => setSelectedSkin(skin)}
                                        className={`group relative rounded-xl p-3 border transition-all cursor-pointer ${theme === 'white' ? (skin.id === selectedSkin?.id ? 'bg-slate-50 border-emerald-500 ring-1 ring-emerald-500/20' : 'bg-white border-slate-200 hover:border-slate-300') : (skin.id === selectedSkin?.id ? 'bg-slate-800 border-emerald-500 ring-1 ring-emerald-500/20' : 'bg-slate-800 border-slate-700 hover:border-slate-500')}`}
                                    >
                                        <div className="aspect-[3/4] rounded-lg bg-slate-700/50 mb-3 flex items-center justify-center relative overflow-hidden p-2">
                                            <Skin2DRender
                                                skinUrl={skin.skinUrl}
                                                model={skin.model || 'classic'}
                                                scale={5}
                                                className="w-full h-full object-contain drop-shadow-xl"
                                            />
                                            <button
                                                onClick={(e) => handleDeleteSkin(e, skin.id)}
                                                className="absolute top-2 right-2 bg-red-500/80 hover:bg-red-500 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                        <div className="mb-2">
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
                                                        onClick={(e) => startEditing(e, skin)}
                                                        className={`text-sm font-bold truncate cursor-text hover:underline decoration-dotted transition-colors ${theme === 'white' ? 'text-slate-700' : 'text-slate-200'} max-w-[80%]`}
                                                        title="Click to rename"
                                                    >
                                                        {skin.name}
                                                    </h4>
                                                    <button
                                                        onClick={(e) => startEditing(e, skin)}
                                                        className={`opacity-0 group-hover:opacity-100 group-hover/name:opacity-100 transition-all ${theme === 'white' ? 'text-slate-400 hover:text-emerald-500' : 'text-slate-500 hover:text-emerald-400'}`}
                                                    >
                                                        <Edit2 size={12} />
                                                    </button>
                                                </div>
                                            )}
                                            <p className="text-xs text-slate-500 capitalize">{skin.type}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button className={`w-full py-1.5 rounded text-xs font-medium transition-colors ${theme === 'white' ? 'bg-slate-100 text-slate-500' : 'bg-slate-900 text-slate-400 group-hover:bg-slate-700 group-hover:text-white'}`}>
                                                {skin.id === selectedSkin?.id ? 'Previewing' : 'Preview'}
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                {/* Add New Placeholder */}
                                <div
                                    onClick={handleImportSkin}
                                    className={`border border-dashed rounded-xl flex flex-col items-center justify-center gap-2 hover:text-emerald-400 hover:border-emerald-500/30 transition-all cursor-pointer aspect-[3/4] ${theme === 'white' ? 'bg-white/50 border-slate-300 text-slate-400 hover:bg-slate-50' : 'bg-slate-900/50 border-slate-700 text-slate-500 hover:bg-slate-900'}`}
                                >
                                    <PlusCircle size={24} />
                                    <span className="text-xs font-medium">Add to Library</span>
                                </div>
                            </>
                        ) : (
                            // COSMETICS RENDER (Dynamic)
                            isLoadingCosmetics ? (
                                <div className="col-span-full py-12 text-center text-slate-500">
                                    Loading cosmetics...
                                </div>
                            ) : ownedCosmetics.length === 0 ? (
                                <div className="col-span-full py-12 text-center text-slate-500 flex flex-col items-center gap-2">
                                    <Sparkles size={32} className="opacity-20" />
                                    <p>No cosmetics found.</p>
                                </div>
                            ) : (
                                ownedCosmetics.map((item, index) => {
                                    if (index === 0) console.log('[Wardrobe] Rendering', ownedCosmetics.length, 'cosmetics');
                                    // 'isOwned' comes from the enriched data. 
                                    const isOwned = item.isOwned === true; // Strict check
                                    const isEquipped = activeCosmetics.find(c => c.id === item.id);
                                    const isFounder = item.id === 'cape_founder';

                                    let cardBgClass = '';
                                    if (theme === 'white') {
                                        cardBgClass = isEquipped
                                            ? 'bg-slate-50 border-emerald-500 ring-1 ring-emerald-500/20'
                                            : 'bg-white border-slate-200 hover:border-slate-300';
                                    } else {
                                        cardBgClass = isEquipped
                                            ? 'bg-slate-800 border-emerald-500 ring-1 ring-emerald-500/20'
                                            : 'bg-slate-800 border-slate-700 hover:border-slate-500';
                                    }

                                    if (isFounder) {
                                        cardBgClass = isEquipped
                                            ? 'bg-gradient-to-br from-amber-900/40 to-purple-900/40 border-amber-500 ring-1 ring-amber-500/40'
                                            : 'bg-gradient-to-br from-amber-900/20 to-purple-900/20 border-amber-500/50 hover:border-amber-400';
                                    }

                                    // Locked State Styling
                                    if (!isOwned) {
                                        cardBgClass = theme === 'white'
                                            ? 'bg-slate-100 border-slate-200 opacity-70'
                                            : 'bg-slate-900/50 border-slate-800 opacity-60';
                                    }

                                    return (
                                        <div
                                            key={item.id}
                                            onClick={() => isOwned && toggleCosmetic(item)}
                                            className={`group relative rounded-xl p-3 border transition-all ${isOwned ? 'cursor-pointer' : 'cursor-not-allowed'} ${cardBgClass}`}
                                        >
                                            <div className={`aspect-square rounded-lg mb-3 flex items-center justify-center relative overflow-hidden ${isFounder ? 'bg-gradient-to-br from-black/60 via-purple-900/30 to-amber-900/30' : 'bg-slate-900/80'}`}>
                                                {!isOwned && (
                                                    <div className="absolute inset-0 z-20 bg-black/40 backdrop-blur-[1px] flex items-center justify-center">
                                                        <Lock size={20} className="text-white/80" />
                                                    </div>
                                                )}

                                                {/* Cape Texture Preview */}
                                                {item.texture ? (
                                                    <div className="relative w-full h-full flex items-center justify-center p-2">
                                                        <Cape2DRender
                                                            capeUrl={item.texture}
                                                            scale={4}
                                                            className={`drop-shadow-lg ${isFounder ? 'founder-cape-glow' : ''}`}
                                                        />
                                                    </div>
                                                ) : (
                                                    // No texture available - show icon
                                                    isFounder ? (
                                                        <Crown size={32} className="text-amber-400" />
                                                    ) : (
                                                        <Sparkles size={32} className="text-white/60" />
                                                    )
                                                )}

                                                {isEquipped && (
                                                    <div className={`absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center ${isFounder ? 'bg-amber-400' : 'bg-emerald-500'} shadow-lg`}>
                                                        <Check size={12} className="text-black" />
                                                    </div>
                                                )}

                                                {/* Special Badge for Founder */}
                                                {isFounder && isOwned && (
                                                    <div className="absolute bottom-2 left-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-md">
                                                        FOUNDER
                                                    </div>
                                                )}
                                            </div>
                                            <div className="mb-2">
                                                <h4 className={`text-sm font-bold truncate ${isFounder ? 'text-amber-400' : (theme === 'white' ? 'text-slate-700' : 'text-slate-200')}`}>{item.name}</h4>
                                                <p className={`text-xs capitalize ${isFounder ? 'text-amber-500/70' : 'text-slate-500'}`}>{item.type}</p>
                                            </div>
                                            <button
                                                disabled={!isOwned}
                                                className={`w-full py-1.5 rounded text-xs font-medium transition-colors ${!isOwned
                                                    ? 'bg-transparent text-slate-500 border border-slate-700/50'
                                                    : isFounder
                                                        ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                                                        : (theme === 'white' ? 'bg-slate-100 text-slate-500 hover:bg-slate-200' : 'bg-slate-900 text-slate-400 group-hover:bg-slate-700 group-hover:text-white')
                                                    }`}>
                                                {isOwned ? (isEquipped ? 'Unequip' : 'Equip') : 'Locked'}
                                            </button>
                                        </div>
                                    );
                                }))
                        )}

                    </div>
                </div>
            </div>
        </div>
    );
};

export default WardrobeView;
