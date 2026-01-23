import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Maximize2, Upload, HardDrive, User, Check, PlusCircle, Sparkles, Shirt, Save, Trash2, Edit2, Crown, Lock, ShieldAlert } from 'lucide-react';
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

            // INJECT TEST ITEM
            enriched.unshift({
                id: 'test_beaver_hat',
                cosmeticId: 'test_beaver_hat',
                name: 'Beaver Hat',
                type: 'HAT', // Will map to 'Hats' category
                texture: '/example_renderable/beaver_hat.png',
                model: '/example_renderable/beaver_hat.json',
                isOwned: true
            });

            console.log('[Wardrobe] Enriched cosmetics:', enriched.length);
            setOwnedCosmetics(enriched);

            // AUTO-EQUIP TEST HAT FOR DEBUGGING
            const testHat = enriched.find(c => c.id === 'test_beaver_hat');
            if (testHat) {
                console.log('[Wardrobe] Auto-equipping test hat');
                setActiveCosmetics(prev => {
                    if (prev.find(c => c.id === testHat.id)) return prev;
                    return [...prev, testHat];
                });
            }

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

                if (activeAccount?.type?.toLowerCase() !== 'offline') {
                    await equipCosmetic(activeAccount.accessToken, cosmetic.id);
                    addToast(`Equipped ${cosmetic.name}`, 'success');
                } else {
                    addToast(`Previewing ${cosmetic.name} (Offline Mode)`, 'info');
                }
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
            // Normalize on import to match backup behavior
            const normalizedDataUri = await normalizeSkin(fileData.dataUri);

            const newSkin = {
                id: uuidv4(),
                name: `Imported Skin ${savedSkins.length + 1}`,
                skinUrl: normalizedDataUri,
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

    const normalizeSkin = (dataUri) => {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL());
            };
            img.onerror = () => resolve(dataUri);
            img.src = dataUri;
        });
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

            // Normalize for consistent comparison
            const normalizedBase64 = await normalizeSkin(base64);

            // Check duplicates (Compare against both raw and normalized to catch all)
            // We use a async-friendly approach for "some" with normalization if needed, 
            // but for performance assume savedSkins are either raw or normalized.
            // Best effort: Compare normalized to normalized.

            // Note: normalizing ALL saved skins on every backup is heavy if list is huge. 
            // But usually list is small (<50).
            let isDuplicate = false;
            for (const s of savedSkins) {
                if (s.skinUrl === base64 || s.skinUrl === normalizedBase64) {
                    isDuplicate = true;
                    break;
                }
                // Deep check: normalize saved skin if it looks different but might match
                // Only do this if we really suspect duplicates are slipping through.
                // For now, let's try direct comparison first.
                // If the saved skin was imported via handleImportSkin (which we will also update to normalize),
                // then normalizedBase64 === s.skinUrl should match.

                // If s.skinUrl is "raw" from old import, different compression might mismatch.
                // Let's normalize s.skinUrl on the fly.
                const normS = await normalizeSkin(s.skinUrl);
                if (normS === normalizedBase64) {
                    isDuplicate = true;
                    break;
                }
            }

            if (isDuplicate) return;

            const newSkin = {
                id: uuidv4(),
                name: `Previous Skin (${new Date().toLocaleDateString()})`,
                skinUrl: normalizedBase64, // Save normalized
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

    // Group cosmetics by type
    const categorizedCosmetics = useMemo(() => {
        const order = [
            'Capes',
            'Name Tags',
            'Hats',
            'Glasses',
            'Wings',
            'Item Skins',
            'Emotes',
            'UI & HUD Enchantments',
            'Kill Effects'
        ];

        const groups = {};
        order.forEach(cat => groups[cat] = []);

        ownedCosmetics.forEach(item => {
            const rawType = item.type || 'Cosmetic';
            let typeKey = rawType;

            // Normalize
            const upper = rawType.toUpperCase();
            if (upper === 'CAPE') typeKey = 'Capes';
            else if (upper === 'WING') typeKey = 'Wings';
            else if (upper === 'HAT' || upper === 'HEAD') typeKey = 'Hats';
            else if (upper === 'NAMETAG' || upper === 'NAME TAG') typeKey = 'Name Tags';
            else if (upper === 'GLASS' || upper === 'GLASSES') typeKey = 'Glasses';
            else if (upper === 'ITEMSKIN' || upper === 'ITEM SKIN') typeKey = 'Item Skins';
            else if (upper === 'EMOTE') typeKey = 'Emotes';
            else if (upper === 'HUD' || upper === 'UI & HUD' || upper === 'UI & HUD ENCHANTMENTS') typeKey = 'UI & HUD Enchantments';
            else if (upper === 'KILLEFFECT' || upper === 'KILL EFFECT') typeKey = 'Kill Effects';
            else {
                typeKey = rawType.charAt(0).toUpperCase() + rawType.slice(1).toLowerCase() + 's';
            }

            if (!groups[typeKey]) groups[typeKey] = [];
            groups[typeKey].push(item);
        });

        const result = {};
        order.forEach(key => {
            result[key] = groups[key] || [];
            delete groups[key];
        });

        Object.keys(groups).sort().forEach(key => {
            result[key] = groups[key];
        });

        return result;
    }, [ownedCosmetics]);

    // Determine what to show in viewer
    const viewerSkin = selectedSkin || currentSkin;

    // Get unequipped cosmetic slots for display
    const unequippedCosmeticSlots = useMemo(() => {
        const allTypes = ['Capes', 'Wings', 'Heads', 'Jackets']; // Define all possible cosmetic types
        return allTypes.filter(type => !categorizedCosmetics[type] || categorizedCosmetics[type].every(item => !activeCosmetics.some(c => c.id === item.id)));
    }, [categorizedCosmetics, activeCosmetics]);


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

            <div className="flex-1 flex flex-row min-h-0 p-8 pt-4 gap-8 relative z-20">

                {/* Left Column: Preview */}
                <div className="lg:w-2/5 flex flex-col gap-6">
                    <div className="flex-1 flex flex-col items-center justify-center relative group min-h-[450px] bg-slate-900/40 rounded-[2rem] border border-white/5 overflow-hidden shadow-inner group/card">
                        {/* Slow Background Shine */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent animate-slow-sweep pointer-events-none" />

                        {/* Shimmer and Glow */}
                        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.05] via-transparent to-transparent opacity-50 pointer-events-none" />
                        <div className="absolute inset-0 animate-shimmer opacity-[0.03] pointer-events-none" />

                        {/* 3D Model Viewer */}
                        <div className="relative z-10 w-full h-full flex items-center justify-center">
                            <SkinViewer
                                skinUrl={viewerSkin.skinUrl}
                                model={viewerSkin.model}
                                cosmetics={activeCosmetics}
                                className="w-full h-full"
                            />
                        </div>

                        {/* Drag hint */}
                        <div className="absolute bottom-6 text-[10px] font-bold tracking-widest uppercase text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-md px-4 py-2 rounded-full pointer-events-none z-20 border border-white/5">
                            Rotate Preview
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={handleImportSkin}
                            disabled={isProcessing}
                            className={`flex-1 py-4 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all border ${theme === 'white' ? 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200' : 'bg-slate-800/40 hover:bg-slate-700/60 text-slate-200 border-white/5'} ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02] active:scale-[0.98]'}`}
                        >
                            <Upload size={14} /> Import Skin
                        </button>
                        <button
                            onClick={handleApplySkin}
                            disabled={isProcessing || !selectedSkin || selectedSkin.source === 'mojang' || activeAccount?.type?.toLowerCase() === 'offline'}
                            className={`flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 disabled:border-transparent text-white py-4 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-900/20 active:scale-[0.98] ${!isProcessing && selectedSkin && selectedSkin.source !== 'mojang' && activeAccount?.type?.toLowerCase() !== 'offline' ? 'hover:scale-[1.02]' : ''}`}
                        >
                            {isProcessing ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : <Save size={14} />}
                            {isProcessing ? 'Processing...' : 'Apply Details'}
                        </button>
                    </div>
                </div>

                {/* Right Column: Library */}
                <div className={`flex-1 rounded-[2rem] border p-8 flex flex-col min-h-0 relative overflow-hidden group/card ${theme === 'white' ? 'bg-white/60 border-slate-200 shadow-xl' : 'bg-slate-900/40 border-white/10 shadow-2xl backdrop-blur-xl'}`}>
                    {/* Border Glow (Orders) */}
                    <div className="absolute -inset-[2px] bg-gradient-to-br from-emerald-500/20 via-transparent to-emerald-500/20 rounded-[2rem] blur-sm animate-slow-pulse pointer-events-none" />

                    {/* Slow Background Shine */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent animate-slow-sweep pointer-events-none" />

                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] via-transparent to-transparent opacity-50 pointer-events-none" />
                    <div className="absolute inset-0 animate-shimmer opacity-[0.02] pointer-events-none" />

                    {/* Tabs */}
                    <div className="flex gap-8 mb-8 border-b border-white/5 pb-0">
                        <button
                            onClick={() => setActiveTab('skins')}
                            className={`pb-4 font-bold text-sm tracking-tight transition-all relative ${activeTab === 'skins' ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            <div className="flex items-center gap-2">
                                <Shirt size={16} /> My Skins
                            </div>
                            {activeTab === 'skins' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-400 rounded-t-full shadow-[0_-4px_10px_rgba(16,185,129,0.5)] animate-in slide-in-from-bottom-1" />}
                        </button>
                        <button
                            onClick={() => setActiveTab('cosmetics')}
                            className={`pb-4 font-bold text-sm tracking-tight transition-all relative ${activeTab === 'cosmetics' ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            <div className="flex items-center gap-2">
                                <Sparkles size={16} /> Cosmetics
                            </div>
                            {activeTab === 'cosmetics' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-400 rounded-t-full shadow-[0_-4px_10px_rgba(16,185,129,0.5)] animate-in slide-in-from-bottom-1" />}
                        </button>
                    </div>

                    {/* Offline Warning (Skins Tab Only) moved to status-pill in header */}

                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">

                        {activeTab === 'skins' ? (
                            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-8">
                                {/* Current Equipped Card */}
                                {currentSkin.skinUrl && (
                                    <div
                                        onClick={() => setSelectedSkin(currentSkin)}
                                        className={`group relative rounded-3xl p-4 border transition-all cursor-pointer overflow-hidden ${theme === 'white' ? (currentSkin.id === selectedSkin?.id ? 'bg-slate-50 border-emerald-500 ring-1 ring-emerald-500/20' : 'bg-white border-slate-200 hover:border-slate-300') : (currentSkin.id === selectedSkin?.id ? 'bg-slate-800/60 border-emerald-500' : 'bg-slate-800/40 border-white/5 hover:border-white/10')}`}
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.05] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out pointer-events-none" />
                                        <div className={`aspect-[3/4] rounded-2xl bg-emerald-950/20 mb-4 flex items-center justify-center relative p-2`}>
                                            {/* Pulse ring for equipped */}
                                            <div className="equipped-pulse-ring" />

                                            <Skin2DRender
                                                skinUrl={currentSkin.skinUrl}
                                                model={currentSkin.model}
                                                scale={6}
                                                className="w-full h-full object-contain drop-shadow-[0_12px_12px_rgba(0,0,0,0.6)] relative z-10"
                                            />
                                            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-emerald-500 text-black text-[9px] font-black px-3 py-1 rounded-full shadow-lg z-20 flex items-center gap-1.5 whitespace-nowrap">
                                                <Check size={10} strokeWidth={4} /> EQUIPPED
                                            </div>
                                        </div>
                                        <div className="px-1">
                                            <h4 className={`text-sm font-bold truncate ${theme === 'white' ? 'text-slate-700' : 'text-slate-200'}`}>Current Skin</h4>
                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Mojang Official</p>
                                        </div>
                                    </div>
                                )}

                                {savedSkins.map(skin => (
                                    <div
                                        key={skin.id}
                                        onClick={() => setSelectedSkin(skin)}
                                        className={`group relative rounded-3xl p-4 border transition-all cursor-pointer overflow-hidden ${theme === 'white' ? (skin.id === selectedSkin?.id ? 'bg-slate-50 border-emerald-500' : 'bg-white border-slate-200 hover:border-slate-300') : (skin.id === selectedSkin?.id ? 'bg-slate-800/60 border-emerald-500' : 'bg-slate-800/40 border-white/5 hover:border-white/10')}`}
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.05] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out pointer-events-none" />
                                        <div className="aspect-[3/4] rounded-2xl bg-slate-900/60 mb-4 flex items-center justify-center relative border border-white/5 overflow-hidden p-2">
                                            <Skin2DRender
                                                skinUrl={skin.skinUrl}
                                                model={skin.model || 'classic'}
                                                scale={6}
                                                className="w-full h-full object-contain drop-shadow-[0_12px_12px_rgba(0,0,0,0.6)]"
                                            />
                                            <button
                                                onClick={(e) => handleDeleteSkin(e, skin.id)}
                                                className="absolute top-3 right-3 bg-red-500/80 hover:bg-red-500 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-lg hover:scale-110 active:scale-95"
                                            >
                                                <Trash2 size={12} />
                                            </button>
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
                                                        onClick={(e) => startEditing(e, skin)}
                                                        className={`text-sm font-bold truncate cursor-text hover:text-emerald-400 transition-colors ${theme === 'white' ? 'text-slate-700' : 'text-slate-200'} max-w-[80%]`}
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
                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">{skin.type}</p>
                                        </div>
                                    </div>
                                ))}

                                <div
                                    onClick={handleImportSkin}
                                    className={`border-2 border-dashed rounded-3xl flex flex-col items-center justify-center gap-3 hover:text-emerald-400 hover:border-emerald-500/40 transition-all cursor-pointer aspect-[3/4] group ${theme === 'white' ? 'bg-white/50 border-slate-300 text-slate-400 hover:bg-slate-50 shadow-inner' : 'bg-slate-900/20 border-white/5 text-slate-500 hover:bg-slate-800/40'}`}
                                >
                                    <div className="w-12 h-12 rounded-full border-2 border-dashed border-current flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <PlusCircle size={24} />
                                    </div>
                                    <span className="text-xs font-bold uppercase tracking-widest">Add Skin</span>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-12 pb-8">
                                {isLoadingCosmetics ? (
                                    <div className="py-20 text-center">
                                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500 mx-auto mb-4 shadow-[0_0_15px_rgba(16,185,129,0.3)]"></div>
                                        <p className="text-slate-500 font-medium">Synchronizing wardrobe...</p>
                                    </div>
                                ) : Object.keys(categorizedCosmetics).length === 0 && unequippedCosmeticSlots.length === 0 ? (
                                    <div className="py-20 text-center text-slate-500 flex flex-col items-center gap-4">
                                        <div className="w-16 h-16 bg-slate-900/40 rounded-full flex items-center justify-center border border-white/5">
                                            <Sparkles size={32} className="opacity-20" />
                                        </div>
                                        <p className="font-medium">No cosmetics discovered yet.</p>
                                    </div>
                                ) : (
                                    <>
                                        {Object.entries(categorizedCosmetics).map(([category, items]) => (
                                            <div key={category} className="space-y-6">
                                                <div className="flex items-center gap-4">
                                                    <h3 className="text-xs font-black text-white tracking-widest uppercase bg-slate-800 border border-white/10 px-4 py-1.5 rounded-full shadow-lg">
                                                        {category}
                                                    </h3>
                                                    {items.length === 0 && (
                                                        <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-[9px] font-black text-emerald-400 animate-pulse">
                                                            <Sparkles size={10} />
                                                            <span>COMING SOON...</span>
                                                        </div>
                                                    )}
                                                    <div className="flex-1 h-[1px] bg-gradient-to-r from-white/10 to-transparent" />
                                                    <span className="text-[10px] font-black text-slate-600 tracking-tighter">{items.length} ITEMS</span>
                                                </div>

                                                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                                    {items.length > 0 ? (
                                                        items.map((item) => {
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
                                                                    ? 'bg-slate-100 border-slate-200 opacity-60'
                                                                    : 'bg-slate-900/30 border-white/5 opacity-50';
                                                            }

                                                            return (
                                                                <div
                                                                    key={item.id}
                                                                    onClick={() => isOwned && toggleCosmetic(item)}
                                                                    className={`group relative rounded-3xl p-4 border transition-all overflow-hidden ${isOwned ? 'cursor-pointer' : 'cursor-not-allowed'} ${cardBgClass}`}
                                                                >
                                                                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.05] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out pointer-events-none" />
                                                                    {isEquipped && <div className="equipped-pulse-ring rounded-3xl" />}

                                                                    <div className={`aspect-square rounded-2xl mb-4 flex items-center justify-center relative overflow-hidden z-10 ${isFounder ? 'bg-gradient-to-br from-black/80 via-purple-950/40 to-amber-950/40' : 'bg-slate-950 shadow-inner'}`}>
                                                                        {!isOwned && (
                                                                            <div className="absolute inset-0 z-20 bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2">
                                                                                <Lock size={18} className="text-white/40" />
                                                                                <span className="text-[8px] font-black tracking-widest text-white/40 uppercase">Locked</span>
                                                                            </div>
                                                                        )}

                                                                        {item.texture ? (
                                                                            item.type?.toLowerCase() === 'cape' ? (
                                                                                <div className={`w-full h-full flex items-center justify-center p-6 transition-transform duration-700 ${isOwned ? 'group-hover:scale-115' : ''}`}>
                                                                                    <Cape2DRender
                                                                                        capeUrl={item.texture}
                                                                                        className={`w-auto h-full max-h-[85%] drop-shadow-[0_15px_15px_rgba(0,0,0,0.8)] ${isFounder ? 'founder-cape-glow' : ''}`}
                                                                                    />
                                                                                </div>
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
                                                        })
                                                    ) : (
                                                        <div className="group relative rounded-3xl p-4 border border-dashed border-white/5 bg-white/[0.02] opacity-20 transition-all">
                                                            <div className="aspect-square rounded-2xl mb-4 flex items-center justify-center relative overflow-hidden bg-black/40 border border-dashed border-white/5">
                                                                <Shirt size={24} className="text-white/20" />
                                                            </div>
                                                            <div className="h-3 w-2/3 bg-white/10 rounded-full mb-2" />
                                                            <div className="h-2 w-1/3 bg-white/5 rounded-full" />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WardrobeView;
