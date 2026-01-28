import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, Gift, UserPlus, MessageSquare, Package, X } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

const getNotificationIcon = (type) => {
    switch (type) {
        case 'vote_reward':
            return <Gift size={16} className="text-emerald-400" />;
        case 'friend_request':
            return <UserPlus size={16} className="text-blue-400" />;
        case 'private_message':
            return <MessageSquare size={16} className="text-purple-400" />;
        case 'market_sale':
            return <Package size={16} className="text-amber-400" />;
        default:
            return <Bell size={16} className="text-slate-400" />;
    }
};

const formatTimestamp = (timestamp) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
};

function NotificationBell({ onNavigate }) {
    const { addToast } = useToast();
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const dropdownRef = useRef(null);
    const pollIntervalRef = useRef(null);
    const previousUnreadCount = useRef(0);
    const audioRef = useRef(null);

    // Play notification sound
    const playNotificationSound = () => {
        try {
            // Create audio element if not exists
            if (!audioRef.current) {
                audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBzaL0vLTgjMGHm7A7+OZPQ0QVrDp66hVFApGn+DyvmwhBzaL0vLTgjMGHm7A7+OZPQ0QVrDp66hVFApGn+DyvmwhBzaL0vLTgjMGHm7A7+OZPQ0QVrDp66hVFApGn+DyvmwhBzaL0vLTgjMGHm7A7+OZPQ0QVrDp66hVFApGn+DyvmwhBzaL0vLTgjMGHm7A7+OZPQ0QVrDp66hVFApGn+DyvmwhBzaL0vLTgjMGHm7A7+OZPQ0QVrDp66hVFApGn+DyvmwhBzaL0vLTgjMGHm7A7+OZPQ0QVrDp66hVFApGn+DyvmwhBzaL0vLTgjMGHm7A7+OZPQ0QVrDp66hVFApGn+DyvmwhBzaL0vLTgjMGHm7A7+OZPQ0QVrDp66hVFApGn+DyvmwhBzaL0vLTgjMGHm7A7+OZPQ0QVrDp66hVFApGn+DyvmwhBzaL0vLTgjMGHm7A7+OZPQ0QVrDp66hVFApGn+DyvmwhBzaL0vLTgjMGHm7A7+OZPQ0QVrDp66hVFApGn+DyvmwhBzaL0vLTgjMGHm7A7+OZPQ0QVrDp66hVFApGn+DyvmwhBzaL0vLTgjMGHm7A7+OZPQ0QVrDp66hVFApGn+DyvmwhBzaL0vLTgjMGHm7A7+OZPQ0QVrDp66hVFApGn+DyvmwhBzaL0vLTgjMGHm7A7+OZ');
                audioRef.current.volume = 0.3;
            }
            audioRef.current.play().catch(err => console.log('Sound play failed:', err));
        } catch (err) {
            console.log('Sound notification failed:', err);
        }
    };

    // Fetch unread count
    const fetchUnreadCount = async () => {
        if (!window.electronAPI?.getUnreadCount) return;
        try {
            const result = await window.electronAPI.getUnreadCount();
            const newCount = result.count || 0;

            // Play sound if count increased
            if (newCount > previousUnreadCount.current && previousUnreadCount.current > 0) {
                playNotificationSound();
                addToast('You have new notifications!', 'info');
            }

            previousUnreadCount.current = newCount;
            setUnreadCount(newCount);
        } catch (err) {
            console.error('Failed to fetch unread count:', err);
        }
    };

    // Fetch notifications
    const fetchNotifications = async () => {
        if (!window.electronAPI?.getNotifications) return;
        setIsLoading(true);
        try {
            const result = await window.electronAPI.getNotifications();
            setNotifications(result.notifications || []);
        } catch (err) {
            console.error('Failed to fetch notifications:', err);
        } finally {
            setIsLoading(false);
        }
    };

    // Mark notifications as read
    const markAsRead = async (notificationIds) => {
        if (!window.electronAPI?.markNotificationsRead || notificationIds.length === 0) return;
        try {
            await window.electronAPI.markNotificationsRead(notificationIds);
            // Update local state
            setNotifications(prev =>
                prev.map(n => notificationIds.includes(n._id) ? { ...n, read: true } : n)
            );
            setUnreadCount(prev => Math.max(0, prev - notificationIds.length));
        } catch (err) {
            console.error('Failed to mark notifications as read:', err);
        }
    };

    // Mark all as read
    const markAllAsRead = () => {
        const unreadIds = notifications.filter(n => !n.read).map(n => n._id);
        if (unreadIds.length > 0) {
            markAsRead(unreadIds);
        }
    };

    // Click outside to close
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    // Poll for unread count every 30 seconds
    useEffect(() => {
        fetchUnreadCount();
        pollIntervalRef.current = setInterval(() => {
            fetchUnreadCount();
        }, 30000); // Poll every 30 seconds

        return () => {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
            }
        };
    }, []);

    // Load notifications when opening dropdown
    useEffect(() => {
        if (isOpen) {
            fetchNotifications();
        }
    }, [isOpen]);

    const handleBellClick = () => {
        setIsOpen(!isOpen);
    };

    // Handle notification click for navigation
    const handleNotificationClick = (notification) => {
        // Mark as read
        if (!notification.read) {
            markAsRead([notification._id]);
        }

        // Navigate based on notification type
        if (onNavigate) {
            switch (notification.type) {
                case 'friend_request':
                    onNavigate('profile'); // Navigate to profile/friends
                    break;
                case 'private_message':
                    onNavigate('profile'); // Navigate to messages
                    break;
                case 'market_sale':
                    onNavigate('market'); // Navigate to market
                    break;
                case 'vote_reward':
                    // Just mark as read, no navigation needed
                    break;
                default:
                    break;
            }
        }

        setIsOpen(false);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Bell Icon Button */}
            <button
                onClick={handleBellClick}
                className="relative p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                title="Notifications"
            >
                <Bell size={16} />
                {unreadCount > 0 && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                        <span className="text-[10px] font-bold text-white">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    </div>
                )}
            </button>

            {/* Notification Dropdown */}
            {isOpen && (
                <div className="absolute top-full right-0 mt-2 w-96 max-h-[500px] bg-slate-900/95 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl overflow-hidden z-[200]">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-white/5">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <Bell size={14} />
                            Notifications
                        </h3>
                        {notifications.length > 0 && unreadCount > 0 && (
                            <button
                                onClick={markAllAsRead}
                                className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1"
                            >
                                <Check size={12} />
                                Mark all as read
                            </button>
                        )}
                    </div>

                    {/* Notifications List */}
                    <div className="overflow-y-auto max-h-[400px] custom-scrollbar">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                                <Bell size={32} className="opacity-50 mb-2" />
                                <p className="text-sm">No notifications</p>
                            </div>
                        ) : (
                            notifications.map((notification) => (
                                <div
                                    key={notification._id}
                                    className={`p-4 border-b border-white/5 hover:bg-slate-800/50 transition-colors cursor-pointer ${
                                        !notification.read ? 'bg-emerald-500/5' : ''
                                    }`}
                                    onClick={() => handleNotificationClick(notification)}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="mt-0.5 flex-shrink-0">
                                            {getNotificationIcon(notification.type)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-slate-200 leading-relaxed">
                                                {notification.message}
                                            </p>
                                            <div className="flex items-center justify-between mt-1">
                                                <span className="text-[10px] text-slate-500">
                                                    {formatTimestamp(notification.createdAt)}
                                                </span>
                                                {!notification.read && (
                                                    <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Footer */}
                    {notifications.length > 0 && (
                        <div className="p-3 border-t border-white/5 bg-slate-900/50">
                            <button
                                onClick={() => {
                                    setIsOpen(false);
                                    // TODO: Navigate to notifications page if needed
                                }}
                                className="w-full text-xs text-slate-400 hover:text-white transition-colors text-center"
                            >
                                View all notifications
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default NotificationBell;
