import { useState, useEffect, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { fetchPlayerCosmetics, equipCosmetic, getCosmeticTextureUrl, fetchAllCosmetics, fetchDetailedCosmetics } from '../utils/cosmeticsApi';
import { FALLBACK_COSMETICS } from '../data/fallbackCosmetics';
import { useToast } from '../contexts/ToastContext';
import { normalizeSkin, categorizeCosmetics } from '../utils/wardrobeUtils';

export const useWardrobe = (activeAccount) => {
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

    // Cape Preview Mode (3D or 2D)
    const [cape3DMode, setCape3DMode] = useState(true);

    const startEditing = (e, skin) => {
        if (e) e.stopPropagation();
        setEditingSkinId(skin.id);
        setEditName(skin.name);
    };

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
    };

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
                console.log("[useWardrobe] Current Skin loaded:", data.skinUrl);
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
        console.log('[useWardrobe] loadCosmetics called for:', username);
        setIsLoadingCosmetics(true);
        try {
            console.log('[useWardrobe] Fetching catalog from API...');
            // 1. Fetch Catalog (All)
            const allCosmetics = await fetchAllCosmetics();
            console.log('[useWardrobe] API returned:', allCosmetics.length, 'cosmetics');

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
                                console.log('[useWardrobe] Loaded detailed cosmetics via Auth:', ownedIds);
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

            console.log('[useWardrobe] Enriched cosmetics:', enriched.length);
            setOwnedCosmetics(enriched);

            // Sync Active Cosmetics from Server State
            if (activeSet.size > 0) {
                const activeItems = enriched.filter(c => activeSet.has(c.id));
                setActiveCosmetics(activeItems);
            } else if (ownedIds.length > 0) {
                if (activeAccount?.accessToken) {
                    setActiveCosmetics([]);
                }
            }

        } catch (e) {
            console.error("Failed to load cosmetics", e);
            setOwnedCosmetics([]);
        } finally {
            setIsLoadingCosmetics(false);
        }
    };

    useEffect(() => {
        if (activeAccount?.name) {
            loadCurrentSkin(activeAccount.name);
            loadCosmetics(activeAccount.name);
        }
    }, [activeAccount]);

    const toggleCosmetic = async (cosmetic) => {
        const isEquipped = activeCosmetics.find(c => c.id === cosmetic.id);

        try {
            if (isEquipped) {
                setActiveCosmetics(prev => prev.filter(c => c.id !== cosmetic.id));
            } else {
                setActiveCosmetics(prev => {
                    if (cosmetic.type === 'cape') {
                        return [...prev.filter(c => c.type !== 'cape'), cosmetic];
                    }
                    return [...prev, cosmetic];
                });

                if (activeAccount?.type?.toLowerCase() !== 'offline') {
                    await equipCosmetic(activeAccount.accessToken, cosmetic.id, activeAccount.uuid || activeAccount.id);
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

            const fileData = await window.electronAPI.readSkinFile(filePath);

            if (!fileData.success) {
                addToast(`Import failed: ${fileData.error}`, "error");
                setIsProcessing(false);
                return;
            }

            const normalizedDataUri = await normalizeSkin(fileData.dataUri);

            const newSkin = {
                id: uuidv4(),
                name: `Imported Skin ${savedSkins.length + 1}`,
                skinUrl: normalizedDataUri,
                filePath: filePath,
                model: 'classic',
                type: 'Classic',
                dateAdded: Date.now(),
                source: 'local'
            };

            setSavedSkins(prev => [newSkin, ...prev]);
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
            const cleanUrl = currentSkin.skinUrl.split('?')[0];
            const res = await fetch(cleanUrl);
            if (!res.ok) return;

            const blob = await res.blob();
            const base64 = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(blob);
            });

            const normalizedBase64 = await normalizeSkin(base64);

            let isDuplicate = false;
            for (const s of savedSkins) {
                if (s.skinUrl === base64 || s.skinUrl === normalizedBase64) {
                    isDuplicate = true;
                    break;
                }
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
                skinUrl: normalizedBase64,
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

        if (selectedSkin.id === 'current_mojang' || selectedSkin.source === 'mojang') {
            addToast("This skin is already equipped!", "info");
            return;
        }

        if (!selectedSkin.filePath) {
            addToast("Cannot upload this skin (Missing file path).", "error");
            return;
        }

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
        if (e) e.stopPropagation();
        setSavedSkins(prev => prev.filter(s => s.id !== id));
        if (selectedSkin?.id === id) setSelectedSkin(currentSkin);
    };

    const categorizedCosmetics = useMemo(() => categorizeCosmetics(ownedCosmetics), [ownedCosmetics]);

    const viewerSkin = useMemo(() => {
        const base = selectedSkin || currentSkin;
        return {
            ...base,
            skinUrl: base.skinUrl || "https://textures.minecraft.net/texture/3b60a1f6d5aa4abb850eb34673899478148b6154564c4786650bf6b1fd85a3",
        };
    }, [selectedSkin, currentSkin]);

    const unequippedCosmeticSlots = useMemo(() => {
        const allTypes = ['Capes', 'Wings', 'Heads', 'Jackets'];
        return allTypes.filter(type => !categorizedCosmetics[type] || categorizedCosmetics[type].every(item => !activeCosmetics.some(c => c.id === item.id)));
    }, [categorizedCosmetics, activeCosmetics]);

    return {
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
        unequippedCosmeticSlots
    };
};
