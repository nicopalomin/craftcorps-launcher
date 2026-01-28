import React, { useState, useEffect } from 'react';
import { Users, Loader2, UserPlus, MessageSquare } from 'lucide-react';

function FriendsList({ activeAccount }) {
    const [friends, setFriends] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const loadFriends = async () => {
            if (!activeAccount || !window.electronAPI?.getFriends) return;
            setIsLoading(true);
            try {
                const result = await window.electronAPI.getFriends();
                setFriends(result.friends || []);
            } catch (err) {
                console.error('Failed to load friends:', err);
            } finally {
                setIsLoading(false);
            }
        };

        loadFriends();

        // Refresh every 30 seconds
        const interval = setInterval(loadFriends, 30000);
        return () => clearInterval(interval);
    }, [activeAccount]);

    return (
        <div className="bg-slate-800/50 backdrop-blur-md rounded-2xl border border-white/5 p-6 space-y-4">
            <h2 className="text-xl font-bold text-slate-200 flex items-center gap-2">
                <Users className="text-blue-400" size={20} /> Friends
            </h2>

            {isLoading ? (
                <div className="flex items-center justify-center py-8">
                    <Loader2 size={24} className="animate-spin text-emerald-500" />
                </div>
            ) : friends.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-slate-500 gap-3 bg-slate-900/30 rounded-xl border border-white/5">
                    <Users size={32} className="opacity-20" />
                    <div className="text-center">
                        <p className="text-sm font-bold text-slate-400">No friends yet</p>
                        <p className="text-xs text-slate-600 mt-1">Add friends in-game with /friend add</p>
                    </div>
                </div>
            ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
                    {friends.map((friend) => (
                        <div
                            key={friend.uuid}
                            className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-xl border border-white/5 hover:border-white/10 transition-colors"
                        >
                            {/* Avatar */}
                            <img
                                src={`https://mc-heads.net/avatar/${friend.uuid}/64`}
                                alt={friend.username}
                                className="w-10 h-10 rounded-lg bg-slate-800 object-cover rendering-pixelated"
                            />

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-bold text-slate-200 truncate">
                                    {friend.username}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                    {friend.isOnline ? (
                                        <>
                                            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                                            <span className="text-[10px] text-emerald-400 font-medium uppercase">
                                                Online {friend.server && `(${friend.server.toUpperCase()})`}
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            <div className="w-2 h-2 bg-slate-600 rounded-full"></div>
                                            <span className="text-[10px] text-slate-500 font-medium uppercase">
                                                Offline
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Actions */}
                            <button
                                onClick={() => {
                                    // TODO: Open message dialog
                                    console.log('Message friend:', friend.username);
                                }}
                                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                                title="Send Message"
                            >
                                <MessageSquare size={16} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Footer */}
            <div className="pt-3 border-t border-white/5 text-center">
                <p className="text-xs text-slate-500">
                    {friends.length} friend{friends.length !== 1 ? 's' : ''}
                </p>
            </div>
        </div>
    );
}

export default FriendsList;
