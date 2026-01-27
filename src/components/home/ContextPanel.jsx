import React from 'react';
import { Clock, Download, Folder, Activity, Zap, CheckCircle2, AlertCircle } from 'lucide-react';

const ContextPanel = ({ selectedInstance, launchStatus }) => {
    // Mock Data for now - in a real app these would come from props or a store
    const updates = [
        { type: 'mod', name: 'Sodium', version: '0.5.3', status: 'available' },
        { type: 'loader', name: 'Fabric', version: '0.15.7', status: 'uptodate' }
    ];

    const recentActivity = [
        { action: 'Played', target: selectedInstance?.name || 'World', time: '2h ago' },
        { action: 'Updated', target: '3 mods', time: 'Yesterday' }
    ];

    return (
        <div className="w-[320px] h-full flex flex-col gap-6 pl-8 border-l border-white/5 animate-in slide-in-from-right-4 duration-500">

            {/* Section 1: Quick Actions / Status */}
            <div className="flex flex-col gap-3">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Quick Actions</h3>

                <button className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-colors text-left group">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                        <Folder size={16} />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-200">Open Folder</span>
                        <span className="text-[10px] text-slate-500">View files</span>
                    </div>
                </button>

                <button className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-colors text-left group">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                        <Download size={16} />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-200">Check Updates</span>
                        <span className="text-[10px] text-slate-500">Mods & Loader</span>
                    </div>
                </button>
            </div>

            {/* Section 2: Recent Activity */}
            <div className="flex flex-col gap-3">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Activity</h3>
                <div className="flex flex-col gap-2">
                    {recentActivity.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-3 py-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                            <div className="flex-1 text-sm text-slate-300">
                                <span className="text-slate-500">{item.action}</span> <span className="font-medium text-white">{item.target}</span>
                            </div>
                            <span className="text-[10px] text-slate-600 font-mono">{item.time}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Section 3: Status / Health */}
            <div className="flex flex-col gap-3 mt-auto mb-8">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">System Status</h3>
                <div className="p-4 rounded-xl bg-slate-900/50 border border-white/5 flex flex-col gap-3">
                    {updates.map((u, i) => (
                        <div key={i} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                {u.status === 'available' ? <AlertCircle size={14} className="text-amber-400" /> : <CheckCircle2 size={14} className="text-emerald-500" />}
                                <span className="text-xs font-medium text-slate-300">{u.name}</span>
                            </div>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${u.status === 'available' ? 'bg-amber-500/10 text-amber-400' : 'text-slate-500'}`}>
                                {u.status === 'available' ? 'Update' : 'Latest'}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

        </div>
    );
};

export default ContextPanel;
