import { useState, useEffect, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { fetchPlayerCosmetics, equipCosmetic, getCosmeticTextureUrl, fetchAllCosmetics, fetchDetailedCosmetics } from '../utils/cosmeticsApi';
import { FALLBACK_COSMETICS } from '../data/fallbackCosmetics';
import { useToast } from '../contexts/ToastContext';
import { normalizeSkin, categorizeCosmetics, getDefaultModel } from '../utils/wardrobeUtils';

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
        id: 'current_mojang',
        name: 'Current Skin',
        skinUrl: null,
        capeUrl: null,
        model: 'classic'
    });

    // Currently Selected for Preview
    const [selectedSkin, setSelectedSkin] = useState(null);

    // Active Cosmetics (Cached by Account ID)
    const [activeCosmetics, setActiveCosmetics] = useState(() => {
        if (!activeAccount) return [];
        try {
            const accountId = activeAccount.uuid || activeAccount.id;
            const saved = localStorage.getItem(`craftcorps_active_cosmetics_${accountId}`);
            return saved ? JSON.parse(saved) : [];
        } catch (e) { return []; }
    });

    // Update localStorage for active cosmetics
    useEffect(() => {
        if (activeAccount && activeCosmetics) {
            const accountId = activeAccount.uuid || activeAccount.id;
            localStorage.setItem(`craftcorps_active_cosmetics_${accountId}`, JSON.stringify(activeCosmetics));
        }
    }, [activeCosmetics, activeAccount]);

    // Available Cosmetics (Fetched from API)
    const [ownedCosmetics, setOwnedCosmetics] = useState(() => {
        if (!activeAccount) return [];
        try {
            const accountId = activeAccount.uuid || activeAccount.id;

            // 1. Try account-specific cache (Best: includes full enriched data + ownership)
            const saved = localStorage.getItem(`craftcorps_owned_cosmetics_${accountId}`);
            if (saved) return JSON.parse(saved);

            // 2. Try global catalog + account's pre-fetched ownership (Good fallback)
            const catalog = localStorage.getItem('craftcorps_cosmetic_catalog');
            if (catalog) {
                const parsed = JSON.parse(catalog);

                // Extract owned IDs from account object if available
                let ownedIds = [];
                if (activeAccount.cosmetics) {
                    const cosmetics = Array.isArray(activeAccount.cosmetics)
                        ? activeAccount.cosmetics
                        : activeAccount.cosmetics.cosmetics;

                    if (Array.isArray(cosmetics)) {
                        ownedIds = cosmetics.map(c => c.cosmeticId || c.id);
                    }
                }

                return parsed.map(c => ({
                    ...c,
                    isOwned: ownedIds.includes(c.cosmeticId)
                }));
            }
        } catch (e) { return []; }
        return [];
    });
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
                const defaultModel = getDefaultModel(activeAccount?.uuid);
                setCurrentSkin(prev => ({
                    ...prev,
                    id: 'current_mojang',
                    name: 'Current Skin',
                    skinUrl: null,
                    model: defaultModel,
                    type: defaultModel === 'slim' ? 'Slim' : 'Classic'
                }));
            }
        } catch (err) {
            console.error("Skin fetch error:", err);
        } finally {
            setIsLoading(false);
        }
    };

    // Load Cosmetics
    const loadCosmetics = async (username, forceRefresh = false) => {
        console.log('[useWardrobe] loadCosmetics called for:', username, 'force:', forceRefresh);
        setIsLoadingCosmetics(true);
        try {
            // 1. Fetch Catalog & Ownership in parallel
            console.log('[useWardrobe] Fetching catalog and ownership...');

            const uuid = activeAccount?.uuid || activeAccount?.id;

            // 15s Caching Check
            if (!forceRefresh && uuid) {
                const lastFetch = localStorage.getItem(`craftcorps_cosmetics_last_fetch_${uuid}`);
                if (lastFetch && (Date.now() - parseInt(lastFetch) < 15000)) {
                    console.log('[useWardrobe] Using 15s cached cosmetics');
                    setIsLoadingCosmetics(false);
                    return;
                }
            }

            // Define the fetches
            const catalogPromise = fetchAllCosmetics();

            // Only use cached detailed if not forcing refresh AND it's actually populated
            // CORTEX FIX: Removed activeAccount.cosmetics shortcut because it can be stale on startup, caused equipped items to vanish.
            const hasDetailedCache = false;
            const ownershipPromise = fetchDetailedCosmetics(activeAccount.backendAccessToken || activeAccount.accessToken, uuid);

            const [allCosmetics, detailed] = await Promise.all([catalogPromise, ownershipPromise]);

            // Use fallback if API is not deployed yet
            const catalogData = allCosmetics.length > 0 ? allCosmetics : FALLBACK_COSMETICS;

            // 2. Extract Owned IDs
            let ownedIds = [];
            let activeSet = new Set();

            if (detailed) {
                if (detailed.cosmetics) {
                    ownedIds = detailed.cosmetics.map(c => c.cosmeticId);
                }

                // New Format: check activeCosmetics map
                if (detailed.activeCosmetics) {
                    Object.values(detailed.activeCosmetics).forEach(cosmeticId => {
                        if (cosmeticId) activeSet.add(cosmeticId);
                    });
                } else if (detailed.cosmetics) {
                    detailed.cosmetics.forEach(c => {
                        if (c.isActive) activeSet.add(c.cosmeticId);
                    });
                }
            }

            // Fallback to public endpoint if no auth found or empty
            if (ownedIds.length === 0 && uuid) {
                ownedIds = await fetchPlayerCosmetics(uuid);
            }

            // 3. Merge & Update State
            const enrich = (catalog) => catalog.map(c => {
                let textureUrl = c.textureUrl;
                if (textureUrl && textureUrl.startsWith('/')) {
                    textureUrl = `https://api.craftcorps.net${textureUrl}`;
                } else if (!textureUrl) {
                    textureUrl = getCosmeticTextureUrl(c.cosmeticId);
                }

                const id = c.cosmeticId;
                return {
                    ...c,
                    texture: textureUrl,
                    id: id,
                    type: c.type || 'cape',
                    isOwned: ownedIds.includes(id)
                };
            });

            const enriched = enrich(catalogData);
            console.log('[useWardrobe] Enriched cosmetics:', enriched.length, 'Owned:', ownedIds.length);
            setOwnedCosmetics(enriched);

            // 4. Update Cache
            if (activeAccount) {
                const accountId = activeAccount.uuid || activeAccount.id;
                localStorage.setItem(`craftcorps_owned_cosmetics_${accountId}`, JSON.stringify(enriched));
            }
            localStorage.setItem('craftcorps_cosmetic_catalog', JSON.stringify(enriched.map(c => ({
                ...c,
                isOwned: false
            }))));

            // Update timestamp
            if (activeAccount) {
                localStorage.setItem(`craftcorps_cosmetics_last_fetch_${activeAccount.uuid || activeAccount.id}`, Date.now().toString());
            }

            // 5. Sync Active Cosmetics
            if (activeSet.size > 0) {
                const activeItems = enriched.filter(c => activeSet.has(c.id));
                setActiveCosmetics(activeItems);
            } else if (ownedIds.length > 0) {
                if (activeAccount?.backendAccessToken || activeAccount?.accessToken) {
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

    const [isInitializing, setIsInitializing] = useState(true);

    useEffect(() => {
        if (activeAccount?.name) {
            // Load cached cosmetics immediately for the new account
            const accountId = activeAccount.uuid || activeAccount.id;
            try {
                // 1. Sync Active (Equipped) items
                const savedActive = localStorage.getItem(`craftcorps_active_cosmetics_${accountId}`);
                if (savedActive) {
                    setActiveCosmetics(JSON.parse(savedActive));
                } else {
                    setActiveCosmetics([]);
                }

                // 2. Sync Owned list (to avoid "locked" look)
                const savedOwned = localStorage.getItem(`craftcorps_owned_cosmetics_${accountId}`);
                if (savedOwned) {
                    setOwnedCosmetics(JSON.parse(savedOwned));
                } else {
                    // Start fresh if no cache
                    setOwnedCosmetics([]);
                }
            } catch (e) {
                setActiveCosmetics([]);
                setOwnedCosmetics([]);
            }

            // Defer heavy network calls to let UI mount smoothly
            setIsInitializing(true);
            const timer = setTimeout(() => {
                Promise.all([
                    loadCurrentSkin(activeAccount.name),
                    loadCosmetics(activeAccount.name)
                ]).finally(() => {
                    setIsInitializing(false);
                });
            }, 200); // Reduced delay for snappier feel

            return () => clearTimeout(timer);
        } else {
            setIsInitializing(false);
        }
    }, [activeAccount]);

    const toggleCosmetic = async (cosmetic) => {
        const isEquipped = activeCosmetics.find(c => c.id === cosmetic.id);

        try {
            if (isEquipped) {
                // If already equipped, we just unequip it
                setActiveCosmetics(prev => prev.filter(c => c.id !== cosmetic.id));
                // Note: The backend likely un-equips items via its own logic, 
                // but we keep UI state in sync.
            } else {
                // If not equipped, add it and remove any other item of the SAME TYPE (Category Exclusivity)
                setActiveCosmetics(prev => {
                    const filtered = prev.filter(c => (c.type || '').toLowerCase() !== (cosmetic.type || '').toLowerCase());
                    return [...filtered, cosmetic];
                });

                if (activeAccount?.type?.toLowerCase() !== 'offline') {
                    await equipCosmetic(activeAccount.backendAccessToken || activeAccount.accessToken, cosmetic.id, activeAccount.uuid || activeAccount.id);
                    addToast(`Equipped ${cosmetic.name}`, 'success');

                    // Update fetch timestamp to prevent stale server data from overriding local state immediately
                    if (activeAccount) {
                        localStorage.setItem(`craftcorps_cosmetics_last_fetch_${activeAccount.uuid || activeAccount.id}`, Date.now().toString());
                    }
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

                // Update fetch timestamp to preserve local changes
                if (activeAccount) {
                    localStorage.setItem(`craftcorps_cosmetics_last_fetch_${activeAccount.uuid || activeAccount.id}`, Date.now().toString());
                }
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
        const STEVE_URL = "https://mc-heads.net/skin/steve";
        const ALEX_URL = "https://mc-heads.net/skin/alex";

        return {
            ...base,
            skinUrl: base.skinUrl || (base.model === 'slim' ? ALEX_URL : STEVE_URL),
        };
    }, [selectedSkin, currentSkin]);

    const unequippedCosmeticSlots = useMemo(() => {
        const allTypes = ['Capes', 'Wings', 'Heads', 'Jackets'];
        return allTypes.filter(type => !categorizedCosmetics[type] || categorizedCosmetics[type].every(item => !activeCosmetics.some(c => c.id === item.id)));
    }, [categorizedCosmetics, activeCosmetics]);

    const refreshCosmetics = () => {
        if (activeAccount?.name) {
            loadCosmetics(activeAccount.name, false);
        }
    };

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
        unequippedCosmeticSlots,
        refreshCosmetics,
        isInitializing
    };
};
