import { useState, useEffect } from 'react';
import { INITIAL_INSTANCES } from '../data/mockData';

export const useInstances = () => {
    const [instances, setInstances] = useState(() => {
        try {
            const saved = localStorage.getItem('craftcrops_instances');
            return saved ? JSON.parse(saved) : INITIAL_INSTANCES;
        } catch (e) {
            return INITIAL_INSTANCES;
        }
    });
    const [selectedInstance, setSelectedInstance] = useState(INITIAL_INSTANCES[0]);
    const [editingCrop, setEditingCrop] = useState(null);
    const [showCropModal, setShowCropModal] = useState(false);

    // Sync instances to localStorage
    useEffect(() => {
        localStorage.setItem('craftcrops_instances', JSON.stringify(instances));
    }, [instances]);

    // Sync selected instance status update if it was edited
    useEffect(() => {
        if (selectedInstance && instances.length > 0) {
            const updatedSelected = instances.find(i => i.id === selectedInstance.id);
            if (updatedSelected) {
                setSelectedInstance(updatedSelected);
            }
        }
    }, [instances, selectedInstance]);

    const handleSaveCrop = (cropData) => {
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

            // Fallback for safety if state update is async/batched - ensure immediate feedback if empty
            if (!selectedInstance) {
                setSelectedInstance(cropData);
            }
        }
    };

    const handleDeleteCrop = (id) => {
        const newInstances = instances.filter(i => i.id !== id);
        setInstances(newInstances);

        // If we deleted the currently selected one, fallback to first available or null
        if (selectedInstance && selectedInstance.id === id) {
            setSelectedInstance(newInstances.length > 0 ? newInstances[0] : null);
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

        setInstances(prev => prev.map(inst => {
            if (inst.id === targetId) {
                return { ...inst, lastPlayed: Date.now() };
            }
            return inst;
        }));
    };

    const reorderInstances = (startIndex, endIndex) => {
        setInstances(prev => {
            const result = Array.from(prev);
            const [removed] = result.splice(startIndex, 1);
            result.splice(endIndex, 0, removed);
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
        reorderInstances
    };
};
