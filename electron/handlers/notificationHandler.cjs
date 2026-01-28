const { ipcMain, Notification } = require('electron');
const authService = require('../services/authService.cjs');
const log = require('electron-log');
const path = require('path');

const API_BASE = 'https://craftcorps.net/api/launcher';

async function getNotifications(event) {
    try {
        log.info('[NotificationHandler] Fetching notifications...');

        const response = await authService.fetchAuthenticated(`${API_BASE}/notifications/list`);

        if (!response.ok) {
            log.error(`[NotificationHandler] Failed to fetch notifications: ${response.status}`);
            return { notifications: [] };
        }

        const data = await response.json();
        return data;
    } catch (error) {
        log.error('[NotificationHandler] Error fetching notifications:', error);
        return { notifications: [] };
    }
}

async function getUnreadCount(event) {
    try {
        const response = await authService.fetchAuthenticated(`${API_BASE}/notifications/unread-count`);

        if (!response.ok) {
            return { count: 0 };
        }

        const data = await response.json();
        return data;
    } catch (error) {
        log.error('[NotificationHandler] Error fetching unread count:', error);
        return { count: 0 };
    }
}

async function markNotificationsRead(event, { ids }) {
    try {
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return { success: false, error: 'Invalid notification IDs' };
        }

        log.info(`[NotificationHandler] Marking ${ids.length} notifications as read...`);

        const response = await authService.fetchAuthenticated(`${API_BASE}/notifications/mark-read`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids })
        });

        if (!response.ok) {
            log.error(`[NotificationHandler] Failed to mark notifications read: ${response.status}`);
            return { success: false, error: 'Failed to mark notifications as read' };
        }

        const data = await response.json();
        return data;
    } catch (error) {
        log.error('[NotificationHandler] Error marking notifications read:', error);
        return { success: false, error: error.message };
    }
}

async function getBalance(event) {
    try {
        const response = await authService.fetchAuthenticated(`${API_BASE}/balance`);

        if (!response.ok) {
            return { balance: 0 };
        }

        const data = await response.json();
        return data;
    } catch (error) {
        log.error('[NotificationHandler] Error fetching balance:', error);
        return { balance: 0 };
    }
}

async function getFriends(event) {
    try {
        const response = await authService.fetchAuthenticated(`${API_BASE}/friends`);

        if (!response.ok) {
            return { friends: [] };
        }

        const data = await response.json();
        return data;
    } catch (error) {
        log.error('[NotificationHandler] Error fetching friends:', error);
        return { friends: [] };
    }
}

async function getDashboardStats(event) {
    try {
        const response = await authService.fetchAuthenticated(`${API_BASE}/stats`);

        if (!response.ok) {
            return {
                balance: 0,
                claimsCount: { eu: 0, india: 0, total: 0 },
                friendsCount: 0,
                playtime: { eu: 0, india: 0, total: 0 },
                pendingRequestsCount: 0,
                recentMessagesCount: 0,
                stats: { deaths: 0, mobKills: 0, playerKills: 0, teleports: 0 },
            };
        }

        const data = await response.json();
        return data;
    } catch (error) {
        log.error('[NotificationHandler] Error fetching dashboard stats:', error);
        return {
            balance: 0,
            claimsCount: { eu: 0, india: 0, total: 0 },
            friendsCount: 0,
            playtime: { eu: 0, india: 0, total: 0 },
            pendingRequestsCount: 0,
            recentMessagesCount: 0,
            stats: { deaths: 0, mobKills: 0, playerKills: 0, teleports: 0 },
        };
    }
}

function setupNotificationHandlers() {
    ipcMain.removeHandler('get-notifications');
    ipcMain.removeHandler('get-unread-count');
    ipcMain.removeHandler('mark-notifications-read');
    ipcMain.removeHandler('get-balance');
    ipcMain.removeHandler('get-friends');
    ipcMain.removeHandler('get-dashboard-stats');

    ipcMain.handle('get-notifications', getNotifications);
    ipcMain.handle('get-unread-count', getUnreadCount);
    ipcMain.handle('mark-notifications-read', markNotificationsRead);
    ipcMain.handle('get-balance', getBalance);
    ipcMain.handle('get-friends', getFriends);
    ipcMain.handle('get-dashboard-stats', getDashboardStats);
}

module.exports = { setupNotificationHandlers };
