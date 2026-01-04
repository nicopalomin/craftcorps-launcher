import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    X, Sprout, Save, Plus, FolderOpen, Download,
    Pickaxe, Axe, Sword, Shield, Box,
    Map, Compass, Flame, Snowflake, Droplet,
    Zap, Heart, Skull, Ghost, Trophy, Loader2
} from 'lucide-react';
import { LOADERS, COLORS, FALLBACK_VERSIONS, INSTANCE_ICONS, GLYPH_COLORS } from '../../data/mockData';
import { fetchMinecraftVersions } from '../../utils/minecraftApi';
import { useToast } from '../../contexts/ToastContext';

const ICON_MAP = {
    Sprout, Pickaxe, Axe, Sword, Shield, Box,
    Map, Compass, Flame, Snowflake, Droplet,
    Zap, Heart, Skull, Ghost, Trophy
};

const CropModal = ({ isOpen, onClose, onSave, editingCrop }) => {
    const { t } = useTranslation();
    const { addToast: showToast } = useToast();
    const [name, setName] = useState('');
    const [loader, setLoader] = useState(LOADERS[0]);
    const [version, setVersion] = useState('');
    const [selectedColor, setSelectedColor] = useState(COLORS[0]);
    const [selectedIcon, setSelectedIcon] = useState('Sprout');
    const [selectedGlyphColor, setSelectedGlyphColor] = useState(GLYPH_COLORS[0]);
    const [versions, setVersions] = useState(FALLBACK_VERSIONS);
    const [loadingVersions, setLoadingVersions] = useState(false);
    const [errors, setErrors] = useState({});
    const [autoConnect, setAutoConnect] = useState(false);
    const [serverAddress, setServerAddress] = useState('');
    const [isImporting, setIsImporting] = useState(false);

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
            setErrors({}); // Clear errors when opening modal
            setIsImporting(false);
            if (editingCrop) {
                setName(editingCrop.name);
                setLoader(editingCrop.loader);
                setVersion(editingCrop.version);
                setAutoConnect(editingCrop.autoConnect || false);
                setServerAddress(editingCrop.serverAddress || '');
                const color = COLORS.find(c => c.class === editingCrop.iconColor) || COLORS[0];
                setSelectedColor(color);
                setSelectedIcon(editingCrop.iconKey || 'Sprout');
                const gColor = GLYPH_COLORS.find(c => c.class === editingCrop.glyphColor) || GLYPH_COLORS[0];
                setSelectedGlyphColor(gColor);
            } else {
                setName('');
                setLoader(LOADERS[0]);
                setVersion(versions[0] || '1.21.4');
                setAutoConnect(false);
                setServerAddress('');
                setSelectedColor(COLORS[0]);
                setSelectedIcon('Sprout');
                setSelectedGlyphColor(GLYPH_COLORS[0]);
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

        // If there are errors, set them and don't submit
        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        // Clear errors
        setErrors({});

        let path = editingCrop?.path;
        // Generate path for new instances
        if (!editingCrop && window.electronAPI) {
            try {
                path = await window.electronAPI.getNewInstancePath(name);
            } catch (err) {
                console.error("Failed to generate instance path:", err);
            }
        }

        onSave({
            ...(editingCrop || {}), // Preserve existing ID, lastPlayed, status if editing
            id: editingCrop ? editingCrop.id : `inst_${Date.now()}`,
            name,
            loader,
            version,
            iconColor: selectedColor.class,
            iconKey: selectedIcon,
            glyphColor: selectedGlyphColor.class,
            bgGradient: selectedColor.grad,
            status: editingCrop ? editingCrop.status : 'Ready',
            lastPlayed: editingCrop ? editingCrop.lastPlayed : null,
            autoConnect,
            serverAddress: autoConnect ? serverAddress.trim() : '',
            path: path // Ensure path is saved
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 w-full max-w-lg rounded-2xl border border-slate-700 shadow-2xl p-6 relative overflow-hidden">

                {/* Header */}
                <div className="flex justify-between items-center mb-6 relative z-10">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <Sprout size={20} className="text-emerald-500" />
                        {editingCrop ? t('crop_title_edit') : t('crop_title_new')}
                    </h3>
                    <div className="flex items-center gap-2">
                        {!editingCrop && (
                            <button
                                type="button"
                                onClick={handleImport}
                                disabled={isImporting}
                                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-300 hover:text-white rounded-lg text-xs font-bold transition-all flex items-center gap-2"
                                title="Import from Folder"
                            >
                                <Download size={14} /> Import
                            </button>
                        )}
                        <button onClick={onClose} disabled={isImporting} className="text-slate-500 hover:text-white transition-colors disabled:opacity-50">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <form onSubmit={handleSubmit} className={`relative z-10 space-y-6 ${isImporting ? 'opacity-30 pointer-events-none' : ''}`}>

                    {/* Icon Selector */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{t('crop_section_icon')}</label>
                        <div className="flex items-start gap-4">
                            <div className={`w-16 h-16 shrink-0 rounded-xl ${editingCrop?.icon ? 'bg-transparent' : selectedColor.class} flex items-center justify-center ${selectedGlyphColor.class} shadow-lg overflow-hidden transition-colors`}>
                                {editingCrop?.icon ? (
                                    <img src={editingCrop.icon} alt={editingCrop.name} className="w-full h-full object-cover" />
                                ) : (
                                    React.createElement(ICON_MAP[selectedIcon] || Sprout, { size: 32 })
                                )}
                            </div>
                            <div className="flex-1 space-y-4">
                                {/* Background */}
                                <div>
                                    <div className="text-[10px] text-slate-500 font-bold mb-2 uppercase">Background</div>
                                    <div className="flex flex-wrap gap-2">
                                        {COLORS.map(color => (
                                            <button
                                                key={color.name}
                                                type="button"
                                                onClick={() => setSelectedColor(color)}
                                                className={`w-10 h-10 rounded-lg ${color.class} ${selectedColor.name === color.name ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-105' : 'opacity-70 hover:opacity-100'} transition-all`}
                                                title={color.name}
                                            />
                                        ))}
                                    </div>
                                </div>

                                {/* Glyph Colors */}
                                <div>
                                    <div className="text-[10px] text-slate-500 font-bold mb-2 uppercase">Icon Paint</div>
                                    <div className="flex flex-wrap gap-2">
                                        {GLYPH_COLORS.map(gColor => (
                                            <button
                                                key={gColor.name}
                                                type="button"
                                                onClick={() => setSelectedGlyphColor(gColor)}
                                                className={`w-10 h-10 rounded-lg ${gColor.bgClass} border-2 relative transition-all ${selectedGlyphColor.name === gColor.name ? 'border-white scale-110 ring-2 ring-slate-900 shadow-lg z-10' : 'border-transparent hover:border-white/50 hover:scale-105 ring-1 ring-inset ring-white/10 opacity-90 hover:opacity-100'}`}
                                                title={gColor.name}
                                            />
                                        ))}
                                    </div>
                                </div>

                                {/* Icons Grid */}
                                <div>
                                    <div className="text-[10px] text-slate-500 font-bold mb-2 uppercase">Icon Shape</div>
                                    <div className="grid grid-cols-8 gap-2">
                                        {INSTANCE_ICONS.map(iconKey => {
                                            const Icon = ICON_MAP[iconKey];
                                            return (
                                                <button
                                                    key={iconKey}
                                                    type="button"
                                                    onClick={() => setSelectedIcon(iconKey)}
                                                    className={`w-full aspect-square rounded-lg flex items-center justify-center bg-slate-800 border ${selectedIcon === iconKey ? 'border-emerald-500 text-emerald-500 bg-emerald-500/10' : 'border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-700'} transition-all`}
                                                    title={iconKey}
                                                >
                                                    <Icon size={16} />
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

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
                            className={`w-full bg-slate-950 border rounded-xl px-4 py-3 text-white focus:outline-none transition-colors placeholder:text-slate-600 ${errors.name
                                ? 'border-red-500 focus:border-red-500'
                                : 'border-slate-800 focus:border-emerald-500/50'
                                }`}
                            autoFocus
                        />
                    </div>

                    {/* Loader & Version Row */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                {t('crop_label_loader')} <span className="text-xs font-normal text-slate-600">{t('crop_loader_others')}</span>
                            </label>
                            <select
                                value={loader}
                                onChange={(e) => setLoader(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 transition-colors appearance-none"
                            >
                                {LOADERS.map(l => {
                                    const isDisabled = ['Quilt', 'NeoForge'].includes(l);
                                    return (
                                        <option
                                            key={l}
                                            value={l}
                                            disabled={isDisabled}
                                            className={isDisabled ? 'text-slate-600' : ''}
                                        >
                                            {l === 'Vanilla' ? t('crop_loader_vanilla') : l}{isDisabled ? ` ${t('crop_coming_soon')}` : ''}
                                        </option>
                                    );
                                })}
                            </select>
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
                                    disabled={loadingVersions}
                                    className="text-xs font-bold text-emerald-500 hover:text-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {t('crop_btn_latest')}
                                </button>
                            </div>
                            <select
                                value={version}
                                onChange={(e) => {
                                    setVersion(e.target.value);
                                    if (errors.version) setErrors(prev => ({ ...prev, version: false }));
                                }}
                                className={`w-full bg-slate-950 border rounded-xl px-4 py-3 text-white focus:outline-none transition-colors appearance-none ${errors.version
                                    ? 'border-red-500 focus:border-red-500'
                                    : 'border-slate-800 focus:border-emerald-500/50'
                                    }`}
                                disabled={loadingVersions}
                            >
                                {loadingVersions ? (
                                    <option>Loading versions...</option>
                                ) : (
                                    versions.map((v, index) => (
                                        <option key={v} value={v}>
                                            {index === 0 ? `${v} ${t('crop_version_latest')}` : v}
                                        </option>
                                    ))
                                )}
                            </select>
                        </div>
                    </div>



                    {/* Server Auto-Connect */}
                    <div className="border-t border-slate-800 pt-4">
                        <label className="flex items-center gap-3 cursor-pointer group">
                            <input
                                type="checkbox"
                                checked={autoConnect}
                                onChange={(e) => setAutoConnect(e.target.checked)}
                                className="w-5 h-5 rounded bg-slate-950 border-slate-700 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-0 cursor-pointer"
                            />
                            <div>
                                <span className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors">{t('crop_check_autoconnect')}</span>
                                <p className="text-xs text-slate-500">{t('crop_desc_autoconnect')}</p>
                            </div>
                        </label>

                        {autoConnect && (
                            <div className="mt-3 animate-in fade-in slide-in-from-top-2 duration-200">
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
                                    className={`w-full bg-slate-950 border rounded-xl px-4 py-3 text-white focus:outline-none transition-colors placeholder:text-slate-600 font-mono text-sm ${errors.serverAddress
                                        ? 'border-red-500 focus:border-red-500'
                                        : 'border-slate-800 focus:border-emerald-500/50'
                                        }`}
                                />
                            </div>
                        )}
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-3 pt-2">
                        {editingCrop && editingCrop.path && (
                            <button
                                type="button"
                                onClick={() => window.electronAPI.openPath(editingCrop.path)}
                                className="px-4 py-3 rounded-xl font-bold text-slate-400 hover:bg-slate-800 hover:text-white transition-colors flex items-center gap-2"
                                title={t('crop_btn_open_folder', { defaultValue: 'Open Folder' })}
                            >
                                <FolderOpen size={20} />
                            </button>
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
                </form>

                {/* Loading Widget / Overlay */}
                {isImporting && (
                    <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center animate-in fade-in duration-300">
                        <Loader2 size={48} className="text-emerald-500 animate-spin mb-4" />
                        <h4 className="text-lg font-bold text-white mb-1">Importing Modpack...</h4>
                        <p className="text-slate-400 text-sm">Copying files via Warp Drive</p>
                    </div>
                )}

                {/* Decorative BG */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            </div>
        </div>
    );
};

export default CropModal;
