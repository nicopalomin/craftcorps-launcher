import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Sprout, Save, Plus } from 'lucide-react';
import { LOADERS, COLORS, FALLBACK_VERSIONS } from '../../data/mockData';
import { fetchMinecraftVersions } from '../../utils/minecraftApi';

const CropModal = ({ isOpen, onClose, onSave, editingCrop }) => {
    const { t } = useTranslation();
    const [name, setName] = useState('');
    const [loader, setLoader] = useState(LOADERS[0]);
    const [version, setVersion] = useState('');
    const [selectedColor, setSelectedColor] = useState(COLORS[0]);
    const [versions, setVersions] = useState(FALLBACK_VERSIONS);
    const [loadingVersions, setLoadingVersions] = useState(false);
    const [errors, setErrors] = useState({});
    const [autoConnect, setAutoConnect] = useState(false);
    const [serverAddress, setServerAddress] = useState('');

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
            if (editingCrop) {
                setName(editingCrop.name);
                setLoader(editingCrop.loader);
                setVersion(editingCrop.version);
                setAutoConnect(editingCrop.autoConnect || false);
                setServerAddress(editingCrop.serverAddress || '');
                const color = COLORS.find(c => c.class === editingCrop.iconColor) || COLORS[0];
                setSelectedColor(color);
            } else {
                setName('');
                setLoader(LOADERS[0]);
                setVersion(versions[0] || '1.21.4');
                setAutoConnect(false);
                setServerAddress('');
                setSelectedColor(COLORS[0]);
            }
        }
    }, [isOpen, editingCrop, versions]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
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

        // Clear errors and submit
        setErrors({});

        onSave({
            ...(editingCrop || {}), // Preserve existing ID, lastPlayed, status if editing
            id: editingCrop ? editingCrop.id : `inst_${Date.now()}`,
            name,
            loader,
            version,
            iconColor: selectedColor.class,
            bgGradient: selectedColor.grad,
            status: editingCrop ? editingCrop.status : 'Ready',
            lastPlayed: editingCrop ? editingCrop.lastPlayed : null,
            autoConnect,
            serverAddress: autoConnect ? serverAddress.trim() : ''
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
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <form onSubmit={handleSubmit} className="relative z-10 space-y-6">

                    {/* Icon Selector */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{t('crop_section_icon')}</label>
                        <div className="flex items-center gap-4">
                            <div className={`w-16 h-16 rounded-xl ${selectedColor.class} flex items-center justify-center text-slate-900 shadow-lg`}>
                                <Sprout size={32} />
                            </div>
                            <div className="flex-1 grid grid-cols-6 gap-2">
                                {COLORS.map(color => (
                                    <button
                                        key={color.name}
                                        type="button"
                                        onClick={() => setSelectedColor(color)}
                                        className={`w-full aspect-square rounded-lg ${color.class} ${selectedColor.name === color.name ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900' : 'opacity-70 hover:opacity-100'} transition-all`}
                                    />
                                ))}
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
                                {LOADERS.map(l => (
                                    <option
                                        key={l}
                                        value={l}
                                        disabled={l !== 'Vanilla'}
                                        className={l !== 'Vanilla' ? 'text-slate-600' : ''}
                                    >
                                        {l === 'Vanilla' ? t('crop_loader_vanilla') : l}{l !== 'Vanilla' ? ` ${t('crop_coming_soon')}` : ''}
                                    </option>
                                ))}
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

                    {/* Color Picker */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{t('crop_label_color')}</label>
                        <div className="flex gap-2">
                            {COLORS.map(color => (
                                <button
                                    key={color.name}
                                    type="button"
                                    onClick={() => setSelectedColor(color)}
                                    className={`w-10 h-10 rounded-lg ${color.class} transition-all ${selectedColor.name === color.name ? 'ring-2 ring-white scale-110' : 'opacity-60 hover:opacity-100'}`}
                                    title={color.name}
                                />
                            ))}
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

                {/* Decorative BG */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            </div>
        </div>
    );
};

export default CropModal;
