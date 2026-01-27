import React, { useEffect, useState } from 'react';
import { Server, Play, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const ServerItem = React.memo(({ server, onJoin }) => {
    const { t } = useTranslation();
    const [onlinePlayers, setOnlinePlayers] = useState(null);
    const [isOnline, setIsOnline] = useState(false);
    const [statusText, setStatusText] = useState('Pinging...');

    useEffect(() => {
        let active = true;
        const fetchStatus = async () => {
            // Fallback for missing IP
            const ip = server.ip || server.address;
            if (!ip) {
                if (active) setStatusText('Unknown Host');
                return;
            }

            try {
                const res = await fetch(`https://api.mcsrvstat.us/3/${ip}`);
                const data = await res.json();
                if (active) {
                    if (data.online) {
                        setOnlinePlayers(data.players.online);
                        setIsOnline(true);
                        setStatusText(`${data.players.online} Players Online`);
                    } else {
                        setIsOnline(false);
                        setStatusText('Offline');
                    }
                }
            } catch (e) {
                if (active) {
                    setIsOnline(false);
                    setStatusText('Unreachable');
                }
            }
        };

        fetchStatus();
        return () => { active = false; };
    }, [server.ip, server.address]);

    return (
        <button
            onClick={() => onJoin(server)}
            className="group relative flex items-center gap-4 p-3 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 hover:border-emerald-500/30 transition-all duration-300 select-none min-w-[280px] h-22"
        >
            <div className="w-14 h-14 rounded-lg bg-slate-900 flex-shrink-0 flex items-center justify-center overflow-hidden border border-white/10 group-hover:border-emerald-500/30 transition-colors">
                {server.icon ? (
                    <img src={server.icon} alt="" className="w-full h-full" />
                ) : (
                    <Server size={24} className="text-slate-500 group-hover:text-emerald-400 transition-colors" />
                )}
            </div>

            <div className="flex flex-col items-start min-w-0 flex-1 text-left">
                <span className="text-sm font-bold text-slate-100 truncate w-full group-hover:text-white transition-colors">
                    {server.ip || server.address || 'Localhost'}
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                    <div className={`w-1.5 h-1.5 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)] ${isOnline ? 'bg-emerald-500 shadow-emerald-500/50' : 'bg-rose-500'}`} />
                    <span className={`text-[10px] font-bold uppercase tracking-tight ${isOnline ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {statusText}
                    </span>
                </div>
            </div>

            <div className="opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0 pr-2">
                <Play size={16} fill="currentColor" className="text-emerald-400" />
            </div>
        </button>
    );
});

const ServerSwitchPanel = React.memo(({
    selectedInstance,
    onJoinServer,
    className = ""
}) => {
    const [servers, setServers] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (selectedInstance?.path) {
            setIsLoading(true);
            window.electronAPI.readServersDat(selectedInstance.path)
                .then(list => {
                    setServers(list || []);
                    setIsLoading(false);
                })
                .catch(() => {
                    setServers([]);
                    setIsLoading(false);
                });
        }
    }, [selectedInstance?.path]);

    if (!selectedInstance) return null;

    return (
        <div className={`flex items-center gap-4 p-2 rounded-2xl bg-slate-950 border border-white/5 ${className}`}>
            <div className="flex-1 flex flex-row gap-3 overflow-x-auto overflow-y-hidden custom-scrollbar no-scrollbar-buttons pb-1">
                {isLoading ? (
                    <div className="flex items-center gap-4 px-4 h-22">
                        <div className="w-5 h-5 rounded-full border-2 border-slate-500 border-t-white animate-spin" />
                        <span className="text-sm font-medium text-slate-500">Scanning for servers...</span>
                    </div>
                ) : servers.length === 0 ? (
                    <div className="flex items-center gap-4 px-6 h-22 w-full group">
                        <div className="w-14 h-14 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-slate-500 group-hover:text-emerald-400 group-hover:border-emerald-500/30 transition-all">
                            <Globe size={28} />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-base font-bold text-slate-300">No servers found</span>
                            <span className="text-sm text-slate-500">Browse on some servers!</span>
                        </div>
                    </div>
                ) : (
                    servers.map((server, idx) => (
                        <div key={idx} className="shrink-0">
                            <ServerItem
                                server={server}
                                onJoin={() => onJoinServer(server)}
                            />
                        </div>
                    ))
                )}
            </div>
        </div>
    );
});

export default ServerSwitchPanel;
