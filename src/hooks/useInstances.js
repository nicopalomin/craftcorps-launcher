import { useState, useEffect } from 'react';
import { INITIAL_INSTANCES } from '../data/mockData';

export const useInstances = () => {
    const [instances, setInstances] = useState([]);
    const [selectedInstance, setSelectedInstance] = useState(null);
    const [editingCrop, setEditingCrop] = useState(null);
    const [showCropModal, setShowCropModal] = useState(false);
    const [isLoading, setIsLoading] = useState(true);


    // Load instances from backend (disk) on mount
    useEffect(() => {
        const loadInstances = async () => {
            setIsLoading(true);
            try {
                if (window.electronAPI && window.electronAPI.getInstances) {

                    // 1. Try to fast-load last selected instance
                    let hasSetInitial = false;
                    try {
                        const lastPath = await window.electronAPI.storeGet('lastSelectedInstancePath');
                        if (lastPath) {
                            const lastInstance = await window.electronAPI.getInstanceByPath(lastPath);
                            if (lastInstance) {
                                setSelectedInstance(lastInstance);
                                hasSetInitial = true;
                            }
                        }
                    } catch (e) {
                        console.warn("Fast-load failed:", e);
                    }

                    // 2. Load all instances
                    const loaded = await window.electronAPI.getInstances();

                    if (loaded && loaded.length > 0) {
                        // Sort by lastPlayed descending (newest first)
                        const sorted = loaded.sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0));
                        setInstances(sorted);

                        // Select first if we haven't set one yet
                        if (!hasSetInitial) {
                            setSelectedInstance(sorted[0]);
                        }
                    } else {
                        // Fallback to empty or initial
                        setInstances([]);
                    }
                } else {
                    // Fallback to localStorage or mock (dev mode)
                    try {
                        const saved = localStorage.getItem('craftcorps_instances');
                        setInstances(saved ? JSON.parse(saved) : INITIAL_INSTANCES);
                    } catch (e) {
                        setInstances(INITIAL_INSTANCES);
                    }
                }
            } catch (e) {
                console.error("Failed to load instances:", e);
            } finally {
                setIsLoading(false);
            }
        };
        loadInstances();
    }, []);

    // Sync selected instance status update if it was edited
    useEffect(() => {
        if (selectedInstance && instances.length > 0) {
            const updatedSelected = instances.find(i => i.id === selectedInstance.id);
            if (updatedSelected) {
                // If the object reference changed but ID is same, update selection to keep in sync
                // But avoid infinite loop if object is identical
                if (JSON.stringify(updatedSelected) !== JSON.stringify(selectedInstance)) {
                    setSelectedInstance(updatedSelected);
                }
            }
        }

        // Persist last selected instance path
        if (selectedInstance && selectedInstance.path && window.electronAPI?.storeSet) {
            window.electronAPI.storeSet('lastSelectedInstancePath', selectedInstance.path);
        }
    }, [instances, selectedInstance]);

    const handleSaveCrop = async (cropData) => {
        // Save to Backend
        if (window.electronAPI && window.electronAPI.saveInstance) {
            await window.electronAPI.saveInstance(cropData);
        }

        if (editingCrop) {
            // Update existing
            setInstances(prev => prev.map(inst => inst.id === cropData.id ? { ...inst, ...cropData } : inst));
        } else {
            // Create new
            setInstances(prev => {
                const newInstances = [...prev, cropData];
                // If it's the first one, or nothing is currently selected, auto-select it
                if (!selectedInstance || prev.length === 0) {
                    setSelectedInstance(cropData);
                }
                return newInstances;
            });
            if (!selectedInstance) setSelectedInstance(cropData);
        }
    };

    const handleDeleteCrop = async (id) => {
        const instanceToDelete = instances.find(i => i.id === id);

        // Remove from state first (optimistic UI update)
        const newInstances = instances.filter(i => i.id !== id);
        setInstances(newInstances);

        // If we deleted the currently selected one, fallback
        if (selectedInstance && selectedInstance.id === id) {
            setSelectedInstance(newInstances.length > 0 ? newInstances[0] : null);
        }

        // Delete File System Folder
        if (instanceToDelete && instanceToDelete.path && window.electronAPI) {
            try {
                // Delete folder
                const res = await window.electronAPI.deleteInstanceFolder(instanceToDelete.path);
                if (!res.success) {
                    console.error("Failed to delete folder:", res.error);
                }
            } catch (e) {
                console.error("Error invoking delete:", e);
            }
        }
    };

    const handleNewCrop = () => {
        setEditingCrop(null);
        setShowCropModal(true);
    };

    const handleEditCrop = (inst) => {
        setEditingCrop(inst);
        setShowCropModal(true);
    };

    const updateLastPlayed = (id) => {
        const targetId = id || (selectedInstance ? selectedInstance.id : null);
        if (!targetId) return;

        // Find the instance
        const instanceToUpdate = instances.find(i => i.id === targetId);

        if (!instanceToUpdate) return;

        // Update it
        const updatedInstance = { ...instanceToUpdate, lastPlayed: Date.now() };

        // Create new order: [updated, ...others]
        const otherInstances = instances.filter(i => i.id !== targetId);
        const newInstances = [updatedInstance, ...otherInstances];

        setInstances(newInstances);

        // Persist update
        if (window.electronAPI?.saveInstance) {
            window.electronAPI.saveInstance(updatedInstance);
        }
    };

    const reorderInstances = (startIndex, endIndex) => {
        setInstances(prev => {
            const result = Array.from(prev);
            const [removed] = result.splice(startIndex, 1);
            result.splice(endIndex, 0, removed);
            // Note: We don't persist order to disk yet unless we save a separate order file
            // or add an 'order' field to instance.json.
            // For now, reordering is memory-only until next reload :( 
            // To fix this we'd need to save all instances with new index, or use a config file.
            // Leaving as-is for now as per minimal changes for "downloaded modpacks" fix.
            return result;
        });
    };

    return {
        instances,
        setInstances,
        selectedInstance,
        setSelectedInstance,
        editingCrop,
        setEditingCrop,
        showCropModal,
        setShowCropModal,
        handleSaveCrop,
        handleDeleteCrop,
        handleNewCrop,
        handleEditCrop,
        updateLastPlayed,
        reorderInstances,
        isLoading
    };
};
