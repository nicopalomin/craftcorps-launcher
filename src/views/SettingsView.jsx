import React from 'react';
import { Cpu } from 'lucide-react';

const SettingsView = ({ ram, setRam, hideOnLaunch, setHideOnLaunch, disableAnimations, setDisableAnimations }) => {
    return (
        <div className="flex-1 overflow-y-auto p-8 max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-300 select-none">
            <h2 className="text-3xl font-bold text-white mb-8">Settings</h2>

            <div className="space-y-6">
                <div className="bg-slate-900 rounded-xl p-6 border border-slate-800">
                    <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                        <Cpu size={18} className="text-emerald-500" /> Java Settings
                    </h3>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm text-slate-400 mb-2">Java Path</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value="C:\Program Files\Java\jdk-17.0.2\bin\javaw.exe"
                                    readOnly
                                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-400 font-mono"
                                />
                                <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-medium text-slate-200">Browse</button>
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between mb-2">
                                <label className="block text-sm text-slate-400">Memory Allocation (RAM)</label>
                                <span className="text-sm font-bold text-emerald-400">{ram} GB</span>
                            </div>
                            <input
                                type="range"
                                min="2"
                                max="16"
                                step="0.5"
                                value={ram}
                                onChange={(e) => setRam(e.target.value)}
                                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                            />
                        </div>
                    </div>
                </div>

                <div className="bg-slate-900 rounded-xl p-6 border border-slate-800">
                    <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                        Launcher Settings
                    </h3>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-200 font-medium">Hide Launcher on Play</p>
                            <p className="text-xs text-slate-500">Minimize the launcher when the game starts</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={hideOnLaunch}
                                onChange={(e) => setHideOnLaunch(e.target.checked)}
                            />
                            <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                        </label>
                    </div>

                    <div className="flex items-center justify-between mt-6 pt-6 border-t border-slate-800/50">
                        <div>
                            <p className="text-sm text-slate-200 font-medium">Disable Background Animations</p>
                            <p className="text-xs text-slate-500">Reduce CPU usage by disabling background blobs</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={disableAnimations}
                                onChange={(e) => setDisableAnimations(e.target.checked)}
                            />
                            <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                        </label>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsView;
