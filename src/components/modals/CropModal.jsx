import React, { useState, useEffect } from 'react';
import { X, Sprout, Save, Plus } from 'lucide-react';
import { LOADERS, VERSIONS, COLORS } from '../../data/mockData';

const CropModal = ({ isOpen, onClose, onSave, editingCrop }) => {
    const [name, setName] = useState('');
    const [loader, setLoader] = useState(LOADERS[0]);
    const [version, setVersion] = useState(VERSIONS[0]);
    const [selectedColor, setSelectedColor] = useState(COLORS[0]);

    // Reset or populate form when modal opens
    useEffect(() => {
        if (isOpen) {
            if (editingCrop) {
                setName(editingCrop.name);
                setLoader(editingCrop.loader);
                setVersion(editingCrop.version);
                const color = COLORS.find(c => c.class === editingCrop.iconColor) || COLORS[0];
                setSelectedColor(color);
            } else {
                setName('');
                setLoader(LOADERS[0]);
                setVersion(VERSIONS[0]);
                setSelectedColor(COLORS[0]);
            }
        }
    }, [isOpen, editingCrop]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name.trim()) return;

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
                        {editingCrop ? 'Prune Crop' : 'Cultivate Crop'}
                    </h3>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <form onSubmit={handleSubmit} className="relative z-10 space-y-6">

                    {/* Icon Selector */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Icon & Theme</label>
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
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Crop Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="My Awesome World"
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 transition-colors placeholder:text-slate-600"
                            autoFocus
                        />
                    </div>

                    {/* Loader & Version Row */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Loader</label>
                            <select
                                value={loader}
                                onChange={(e) => setLoader(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 transition-colors appearance-none"
                            >
                                {LOADERS.map(l => <option key={l} value={l}>{l}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Version</label>
                            <select
                                value={version}
                                onChange={(e) => setVersion(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 transition-colors appearance-none"
                            >
                                {VERSIONS.map(v => <option key={v} value={v}>{v}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 rounded-xl font-bold text-slate-400 hover:bg-slate-800 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-[2] bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-3 rounded-xl font-bold shadow-lg shadow-emerald-900/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                            {editingCrop ? <Save size={18} /> : <Plus size={18} />}
                            {editingCrop ? 'Update Crop' : 'Plant Crop'}
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
