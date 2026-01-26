import React, { useState, useEffect, useRef } from 'react';
import { Activity, Power, Globe, ExternalLink } from 'lucide-react';
import InstanceIcon from './InstanceIcon';

const ActiveInstances = ({ onInstanceClick }) => {
    const [instances, setInstances] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const popoverRef = useRef(null);

    useEffect(() => {
        const fetchInstances = async () => {
            if (window.electronAPI?.getRunningInstances) {
                const list = await window.electronAPI.getRunningInstances();
                setInstances(list || []);
            }
        };
        fetchInstances();

        const handleUpdate = (list) => {
            setInstances(list || []);
        };

        if (window.electronAPI?.onRunningInstancesChanged) {
            window.electronAPI.onRunningInstancesChanged(handleUpdate);
        }
        return () => window.electronAPI?.removeRunningInstancesListener?.();
    }, []);

    // Close popover if clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (instances.length === 0) return null;

    return (
        <div className="relative ml-3 no-drag" ref={popoverRef}>
            {/* The Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors cursor-pointer"
                title={`${instances.length} Active Instances`}
            >
                <Activity size={10} className="animate-pulse" />
                <span className="font-medium text-xs">
                    {instances.length} Active
                </span>
            </button>

            {/* Popover List */}
            {isOpen && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-[#0F172A] border border-slate-700 rounded-lg shadow-xl overflow-hidden z-[100] flex flex-col">
                    <div className="px-3 py-2 border-b border-slate-700 bg-slate-800/50 flex justify-between items-center">
                        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Processes</h3>
                    </div>
                    <div className="max-h-64 overflow-y-auto p-1 space-y-1">
                        {instances.map((inst) => (
                            <div
                                key={inst.gameDir}
                                onClick={() => {
                                    if (onInstanceClick) onInstanceClick(inst.gameDir);
                                    setIsOpen(false);
                                }}
                                className="p-2 rounded hover:bg-slate-800/50 flex items-center justify-between group/item transition-colors cursor-pointer"
                            >
                                <div className="flex items-center gap-2 overflow-hidden">
                                    {/* Icon */}
                                    {/* Icon */}
                                    <div className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center shrink-0 overflow-hidden">
                                        <InstanceIcon instance={inst} size={24} />
                                    </div>
                                    <div className="flex flex-col overflow-hidden min-w-0">
                                        <span className="text-xs font-medium text-slate-200 truncate">{inst.name}</span>
                                        <span className="text-[10px] text-slate-500 truncate">{inst.version}</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-1 opacity-100 transition-opacity">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (window.electronAPI?.focusGame) {
                                                window.electronAPI.focusGame(inst.gameDir);
                                                setIsOpen(false);
                                            }
                                        }}
                                        className="p-1 rounded hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-400 transition-colors"
                                        title="Switch to Game"
                                    >
                                        <ExternalLink size={12} />
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (window.electronAPI?.stopGame) {
                                                window.electronAPI.stopGame(inst.gameDir);
                                            }
                                        }}
                                        className="p-1 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                                        title="Stop Game"
                                    >
                                        <Power size={12} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ActiveInstances;
