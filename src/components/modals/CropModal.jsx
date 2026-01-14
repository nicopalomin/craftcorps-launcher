import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
    X, Sprout, Save, Plus, FolderOpen, Download, Trash2,
    Pickaxe, Axe, Sword, Shield, Box,
    Map, Compass, Flame, Snowflake, Droplet,
    Zap, Heart, Skull, Ghost, Trophy, Loader2, ChevronDown
} from 'lucide-react';
import { LOADERS, COLORS, FALLBACK_VERSIONS, INSTANCE_ICONS } from '../../data/mockData';
import { fetchMinecraftVersions } from '../../utils/minecraftApi';
import { useToast } from '../../contexts/ToastContext';

const ICON_MAP = {
    Sprout, Pickaxe, Axe, Sword, Shield, Box,
    Map, Compass, Flame, Snowflake, Droplet,
    Zap, Heart, Skull, Ghost, Trophy
};

const PRESETS = [
    { id: 'survival', label: 'Survival', icon: 'Pickaxe' },
    { id: 'creative', label: 'Creative', icon: 'Box' },
    { id: 'modded', label: 'Modded', icon: 'Zap' },
    { id: 'pvp', label: 'PvP', icon: 'Sword' },
    { id: 'hardcore', label: 'Hardcore', icon: 'Skull' },
];

const THEMES = [
    { id: 'grass', label: 'Grass', colorName: 'Emerald' },
    { id: 'stone', label: 'Stone', colorName: 'Slate' },
    { id: 'nether', label: 'Nether', colorName: 'Rose' },
    { id: 'end', label: 'End', colorName: 'Purple' },
    { id: 'ocean', label: 'Ocean', colorName: 'Blue' },
];

const CustomSelect = ({ value, onChange, options, disabled, loading, placeholder }) => {
    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef(null);
    const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

    const toggleOpen = () => {
        if (disabled || loading) return;

        if (isOpen) {
            setIsOpen(false);
            return;
        }

        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setCoords({
                top: rect.bottom + 8,
                left: rect.left,
                width: rect.width
            });
            setIsOpen(true);
        }
    };

    // Handle closing on click outside or scroll
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (triggerRef.current && !triggerRef.current.contains(e.target) && !e.target.closest('.custom-select-dropdown')) {
                setIsOpen(false);
            }
        };
        const handleScroll = (e) => {
            if (e.target.classList?.contains('custom-select-dropdown')) return;
            if (isOpen) setIsOpen(false);
        };

        if (isOpen) {
            window.addEventListener('mousedown', handleClickOutside);
            window.addEventListener('scroll', handleScroll, true);
        }
        return () => {
            window.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('scroll', handleScroll, true);
        };
    }, [isOpen]);

    const selectedOption = options.find(o => o.value === value);

    return (
        <>
            <div
                ref={triggerRef}
                onClick={toggleOpen}
                className={`w-full bg-slate-950 border rounded-xl px-4 py-3 text-slate-200 flex items-center justify-between transition-colors cursor-pointer select-none ${disabled ? 'opacity-50 cursor-not-allowed border-slate-800' :
                    isOpen ? 'border-emerald-500' : 'border-slate-800 hover:border-slate-700'
                    }`}
            >
                <span className={`truncate ${!selectedOption && !loading ? 'text-slate-500' : ''}`}>
                    {loading ? 'Loading...' : (selectedOption ? selectedOption.label : placeholder || 'Select...')}
                </span>
                <ChevronDown size={16} className={`text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {isOpen && createPortal(
                <div
                    className="custom-select-dropdown fixed z-[9999] bg-slate-900 border border-slate-700 rounded-xl overflow-y-auto custom-scrollbar shadow-2xl animate-in fade-in zoom-in-95 duration-100"
                    style={{
                        top: coords.top,
                        left: coords.left,
                        width: coords.width,
                        maxHeight: '200px' // Shortened height
                    }}
                >
                    {options.map((option) => (
                        <div
                            key={option.value}
                            onClick={() => {
                                if (!option.disabled) {
                                    onChange(option.value);
                                    setIsOpen(false);
                                }
                            }}
                            className={`px-4 py-2 text-sm cursor-pointer transition-colors flex items-center justify-between select-none ${option.disabled ? 'opacity-50 cursor-not-allowed text-slate-600' :
                                option.value === value ? 'bg-emerald-500/10 text-emerald-400 font-medium' : 'text-slate-300 hover:bg-white/5'
                                }`}
                        >
                            {option.label}
                            {option.value === value && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                        </div>
                    ))}
                    {options.length === 0 && (
                        <div className="px-4 py-3 text-sm text-slate-500 text-center">No options</div>
                    )}
                </div>,
                document.body
            )}
        </>
    );
};

const CropModal = ({ isOpen, onClose, onSave, editingCrop, onDelete }) => {
    const { t } = useTranslation();
    const { addToast: showToast } = useToast();
    const [name, setName] = useState('');
    const [loader, setLoader] = useState(LOADERS[0]);
    const [version, setVersion] = useState('');

    // New simplified state
    const [selectedPreset, setSelectedPreset] = useState(PRESETS[0]);
    const [selectedTheme, setSelectedTheme] = useState(THEMES[0]);

    const [versions, setVersions] = useState(FALLBACK_VERSIONS);
    const [loadingVersions, setLoadingVersions] = useState(false);
    const [errors, setErrors] = useState({});
    const [autoConnect, setAutoConnect] = useState(false);
    const [serverAddress, setServerAddress] = useState('');
    const [isImporting, setIsImporting] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

    // Fetch Minecraft versions on mount
    useEffect(() => {
        const loadVersions = async () => {
            setLoadingVersions(true);
            const fetchedVersions = await fetchMinecraftVersions();
            setVersions(fetchedVersions);
            setLoadingVersions(false);
        };
        loadVersions();
    }, []);

    // Reset or populate form when modal opens
    useEffect(() => {
        if (isOpen) {
            setErrors({});
            setIsImporting(false);
            setIsDeleteConfirmOpen(false);
            if (editingCrop) {
                setName(editingCrop.name);
                const matchedLoader = LOADERS.find(l => l.toLowerCase() === (editingCrop.loader || '').toLowerCase());
                setLoader(matchedLoader || editingCrop.loader);
                setVersion(editingCrop.version);
                setAutoConnect(editingCrop.autoConnect || false);
                setServerAddress(editingCrop.serverAddress || '');

                // Try to match existing data to presets/themes
                const foundPreset = PRESETS.find(p => p.icon === editingCrop.iconKey) || PRESETS[0];
                setSelectedPreset(foundPreset);

                const foundColor = COLORS.find(c => c.class === editingCrop.iconColor);
                const foundTheme = THEMES.find(t => t.colorName === foundColor?.name) || THEMES[0];
                setSelectedTheme(foundTheme);

            } else {
                setName('');
                setLoader(LOADERS[0]);
                setVersion(versions[0] || '1.21.4');
                setAutoConnect(false);
                setServerAddress('');
                setSelectedPreset(PRESETS[0]);
                setSelectedTheme(THEMES[0]);
            }
        }
    }, [isOpen, editingCrop, versions]);

    const handleImport = async () => {
        try {
            const dialogRes = await window.electronAPI.importInstanceDialog();
            if (dialogRes.cancelled) return;
            if (!dialogRes.success) {
                showToast(dialogRes.error, 'error');
                return;
            }

            setIsImporting(true);
            await new Promise(r => setTimeout(r, 100)); // UI update delay

            const res = await window.electronAPI.performImportInstance(dialogRes.path);

            setIsImporting(false);
            if (res.success) {
                showToast(`Imported ${res.instance.name} successfully!`, 'success');
                window.location.reload();
            } else {
                showToast(`Import failed: ${res.error}`, 'error');
            }
        } catch (e) {
            setIsImporting(false);
            showToast(e.message, 'error');
        }
    };

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validate fields
        const newErrors = {};
        if (!name.trim()) {
            newErrors.name = true;
        }
        if (!version) {
            newErrors.version = true;
        }
        if (autoConnect && !serverAddress.trim()) {
            newErrors.serverAddress = true;
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        setErrors({});

        let path = editingCrop?.path;
        if (!editingCrop && window.electronAPI) {
            try {
                path = await window.electronAPI.getNewInstancePath(name);
            } catch (err) {
                console.error("Failed to generate instance path:", err);
            }
        }

        // Derive color data from theme
        const colorData = COLORS.find(c => c.name === selectedTheme.colorName) || COLORS[0];

        onSave({
            ...(editingCrop || {}),
            id: editingCrop ? editingCrop.id : `inst_${Date.now()}`,
            name,
            loader,
            version,
            // Map new simplified state to data model
            iconColor: colorData.class,
            iconKey: selectedPreset.icon,
            glyphColor: 'text-white', // Defaulting to white for legibility
            bgGradient: colorData.grad,

            status: editingCrop ? editingCrop.status : 'Ready',
            lastPlayed: editingCrop ? editingCrop.lastPlayed : null,
            autoConnect,
            serverAddress: autoConnect ? serverAddress.trim() : '',
            path: path
        });
        onClose();
    };

    const SelectedIcon = ICON_MAP[selectedPreset.icon] || Sprout;
    const activeColorData = COLORS.find(c => c.name === selectedTheme.colorName) || COLORS[0];

    // Prepare options for custom selects
    const loaderOptions = LOADERS.map(l => ({
        value: l,
        label: l === 'Vanilla' ? t('crop_loader_vanilla') : l,
        disabled: [].includes(l)
    }));

    const versionOptions = versions.map((v, index) => ({
        value: v,
        label: index === 0 ? `${v} ${t('crop_version_latest')}` : v
    }));

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 w-full max-w-lg rounded-2xl border border-slate-700 shadow-2xl relative flex flex-col max-h-[85vh] overflow-hidden">

                {/* Decorative BG */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

                {/* Header */}
                <div className="shrink-0 p-6 pb-4 flex justify-between items-center relative z-10">
                    <h3 className="text-xl font-bold text-slate-200 flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg ${activeColorData.class} bg-opacity-20`}>
                            <SelectedIcon size={20} className="text-white" />
                        </div>
                        {editingCrop ? t('crop_title_edit') : t('crop_title_new')}
                    </h3>
                    <div className="flex items-center gap-2">
                        {!editingCrop && (
                            <button
                                type="button"
                                onClick={handleImport}
                                disabled={isImporting}
                                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-300 hover:text-slate-200 rounded-lg text-xs font-bold transition-all flex items-center gap-2"
                                title="Import from Folder"
                            >
                                <Download size={14} /> Import
                            </button>
                        )}
                        <button onClick={onClose} disabled={isImporting} className="text-slate-500 hover:text-slate-200 transition-colors disabled:opacity-50">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <form onSubmit={handleSubmit} className={`flex flex-col flex-1 min-h-0 relative z-10 ${isImporting ? 'opacity-30 pointer-events-none' : ''}`}>

                    {/* Scrollable Area */}
                    <div className="flex-1 overflow-y-auto p-6 pt-0 space-y-8 custom-scrollbar pb-10">

                        {/* Name Input */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                {t('crop_label_name')} {errors.name && <span className="text-red-500">{t('crop_required')}</span>}
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => {
                                    setName(e.target.value);
                                    if (errors.name) setErrors(prev => ({ ...prev, name: false }));
                                }}
                                placeholder="My Awesome World"
                                className={`w-full bg-slate-950 border rounded-xl px-4 py-3 text-slate-200 focus:outline-none transition-colors placeholder:text-slate-600 ${errors.name
                                    ? 'border-red-500 focus:border-red-500'
                                    : 'border-slate-800 focus:border-emerald-500/50'
                                    }`}
                                autoFocus
                            />
                        </div>

                        {/* World Style (New Design) */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                                {t('crop_section_icon', { defaultValue: 'World Style' })}
                            </label>

                            {/* Presets Grid */}
                            <div className="grid grid-cols-5 gap-2 mb-4">
                                {PRESETS.map(preset => {
                                    const Icon = ICON_MAP[preset.icon];
                                    const isSelected = selectedPreset.id === preset.id;
                                    return (
                                        <button
                                            key={preset.id}
                                            type="button"
                                            onClick={() => setSelectedPreset(preset)}
                                            className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all duration-200 ${isSelected
                                                ? 'bg-slate-800 border-emerald-500 shadow-lg shadow-emerald-500/10'
                                                : 'bg-slate-950/50 border-slate-800 hover:bg-slate-800 hover:border-slate-700'
                                                }`}
                                        >
                                            <Icon
                                                size={24}
                                                className={`transition-colors ${isSelected ? 'text-emerald-400' : 'text-slate-500'}`}
                                                strokeWidth={2}
                                            />
                                            <span className={`text-[10px] font-bold uppercase tracking-wide ${isSelected ? 'text-slate-200' : 'text-slate-500'}`}>
                                                {preset.label}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Themes Grid */}
                            <div className="grid grid-cols-5 gap-2">
                                {THEMES.map(theme => {
                                    const color = COLORS.find(c => c.name === theme.colorName);
                                    const isSelected = selectedTheme.id === theme.id;
                                    return (
                                        <button
                                            key={theme.id}
                                            type="button"
                                            onClick={() => setSelectedTheme(theme)}
                                            className={`group relative h-10 rounded-lg overflow-hidden border transition-all duration-200 ${isSelected
                                                ? 'border-white scale-105 ring-2 ring-slate-900 shadow-lg'
                                                : 'border-transparent opacity-60 hover:opacity-100 hover:scale-105'
                                                }`}
                                        >
                                            <div className={`absolute inset-0 ${color?.class}`} />
                                            <span className="relative z-10 text-[10px] font-bold text-white uppercase tracking-wider shadow-sm drop-shadow-md">
                                                {theme.label}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Loader & Version Row */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                    {t('crop_label_loader')}
                                </label>
                                <CustomSelect
                                    value={loader}
                                    onChange={setLoader}
                                    options={loaderOptions}
                                    disabled={editingCrop && editingCrop.modpackProjectId}
                                />
                            </div>
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                                        {t('crop_label_version')} {errors.version && <span className="text-red-500">{t('crop_required')}</span>}
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setVersion(versions[0]);
                                            if (errors.version) setErrors(prev => ({ ...prev, version: false }));
                                        }}
                                        disabled={loadingVersions || (editingCrop && editingCrop.modpackProjectId)}
                                        className="text-xs font-bold text-emerald-500 hover:text-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        {t('crop_btn_latest')}
                                    </button>
                                </div>
                                <CustomSelect
                                    value={version}
                                    onChange={(val) => {
                                        setVersion(val);
                                        if (errors.version) setErrors(prev => ({ ...prev, version: false }));
                                    }}
                                    options={versionOptions}
                                    loading={loadingVersions}
                                    disabled={loadingVersions || (editingCrop && editingCrop.modpackProjectId)}
                                />
                            </div>
                        </div>

                        {/* Server Auto-Connect */}
                        <div className="border-t border-slate-800 pt-6">
                            <div
                                onClick={() => setAutoConnect(!autoConnect)}
                                className="bg-slate-950/50 border border-slate-800 hover:border-slate-700 rounded-xl p-4 flex items-center justify-between cursor-pointer group transition-all"
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${autoConnect ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-800/50 text-slate-500'} transition-colors`}>
                                        <Box size={18} />
                                    </div>
                                    <span className={`font-bold text-sm ${autoConnect ? 'text-slate-200' : 'text-slate-400'} transition-colors`}>
                                        Auto-join server on launch
                                    </span>
                                </div>

                                {/* Toggle Switch */}
                                <div className={`w-11 h-6 rounded-full relative transition-colors duration-200 ${autoConnect ? 'bg-emerald-500' : 'bg-slate-800'}`}>
                                    <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${autoConnect ? 'translate-x-5' : 'translate-x-0'}`} />
                                </div>
                            </div>

                            {autoConnect && (
                                <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-200 pl-1">
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                        {t('crop_label_server')} {errors.serverAddress && <span className="text-red-500">{t('crop_required')}</span>}
                                    </label>
                                    <input
                                        type="text"
                                        value={serverAddress}
                                        onChange={(e) => {
                                            setServerAddress(e.target.value);
                                            if (errors.serverAddress) setErrors(prev => ({ ...prev, serverAddress: false }));
                                        }}
                                        placeholder="play.hypixel.net"
                                        className={`w-full bg-slate-950 border rounded-xl px-4 py-3 text-slate-200 focus:outline-none transition-colors placeholder:text-slate-600 font-mono text-sm ${errors.serverAddress
                                            ? 'border-red-500 focus:border-red-500'
                                            : 'border-slate-800 focus:border-emerald-500/50'
                                            }`}
                                        autoFocus
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer / Buttons */}
                    <div className="shrink-0 p-6 pt-4 border-t border-slate-800 bg-slate-900/50 backdrop-blur-md">
                        <div className="flex gap-3">
                            {editingCrop && (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => setIsDeleteConfirmOpen(true)}
                                        className="px-4 py-3 rounded-xl font-bold text-red-500 hover:bg-red-500/10 transition-colors flex items-center gap-2"
                                        title="Delete Crop"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                    {editingCrop.path && (
                                        <button
                                            type="button"
                                            onClick={() => window.electronAPI.openPath(editingCrop.path)}
                                            className="px-4 py-3 rounded-xl font-bold text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors flex items-center gap-2"
                                            title={t('crop_btn_open_folder', { defaultValue: 'Open Folder' })}
                                        >
                                            <FolderOpen size={20} />
                                        </button>
                                    )}
                                </>
                            )}
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 px-4 py-3 rounded-xl font-bold text-slate-400 hover:bg-slate-800 transition-colors"
                            >
                                {t('btn_cancel')}
                            </button>
                            <button
                                type="submit"
                                className="flex-[2] bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-3 rounded-xl font-bold shadow-lg shadow-emerald-900/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                            >
                                {editingCrop ? <Save size={18} /> : <Plus size={18} />}
                                {editingCrop ? t('crop_btn_save_edit') : t('crop_btn_save_new')}
                            </button>
                        </div>
                    </div>
                </form>

                {/* Delete Confirmation Overlay */}
                {isDeleteConfirmOpen && (
                    <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-sm z-40 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-200">
                        {/* Red Glow */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />

                        <div className="relative z-10 w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4 text-red-500 animate-in zoom-in duration-300 ring-1 ring-red-500/20">
                            <Trash2 size={32} />
                        </div>
                        <h4 className="relative z-10 text-xl font-bold text-slate-200 mb-2">Delete Instance?</h4>
                        <p className="relative z-10 text-slate-400 mb-8 max-w-xs text-sm">
                            Are you sure you want to delete <span className="font-bold text-slate-200">{editingCrop?.name}</span>?
                            <br /><span className="text-red-400/80">This action cannot be undone.</span>
                        </p>
                        <div className="relative z-10 flex gap-3 w-full">
                            <button
                                type="button"
                                onClick={() => setIsDeleteConfirmOpen(false)}
                                className="flex-1 px-4 py-3 rounded-xl font-bold text-slate-400 hover:bg-slate-800 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    onDelete(editingCrop.id);
                                    onClose();
                                }}
                                className="flex-1 bg-red-600 hover:bg-red-500 text-white px-4 py-3 rounded-xl font-bold shadow-lg shadow-red-900/20 transition-all active:scale-95"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                )}

                {/* Loading Widget / Overlay */}
                {isImporting && (
                    <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center animate-in fade-in duration-300">
                        <Loader2 size={48} className="text-emerald-500 animate-spin mb-4" />
                        <h4 className="text-lg font-bold text-slate-200 mb-1">Importing Modpack...</h4>
                        <p className="text-slate-400 text-sm">Copying files via Warp Drive</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CropModal;
