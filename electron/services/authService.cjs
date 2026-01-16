const { ipcMain, app } = require('electron');
const { v4: uuidv4 } = require('uuid');
const log = require('electron-log');

const STORE_KEY_DEVICE_ID = 'device_id';
const STORE_KEY_AUTH_TOKEN = 'auth_token';
const STORE_KEY_USER_ID = 'user_id';
const AUTH_BASE = 'https://auth.craftcorps.net';

class AuthService {
    constructor() {
        this.store = null;
        this.deviceId = null;
        this.userId = null;
        this.token = null;
        this.tokenExpiry = null;
    }

    init(store) {
        log.info('[AuthService] Initializing...');
        this.store = store;

        // 1. Load or Generate Device ID
        this.deviceId = this.store.get(STORE_KEY_DEVICE_ID);
        if (!this.deviceId) {
            // Try to get machine-id for stable identification
            try {
                const { machineIdSync } = require('node-machine-id');
                this.deviceId = machineIdSync({ original: true });
            } catch (e) {
                log.warn('[AuthService] Failed to get machine-id, falling back to UUID', e);
                this.deviceId = uuidv4();
            }
            this.store.set(STORE_KEY_DEVICE_ID, this.deviceId);
        }
        log.info(`[AuthService] Device ID: ${this.deviceId}`);

        // 2. Load Persisted Token (if valid)
        const savedToken = this.store.get(STORE_KEY_AUTH_TOKEN);
        // basic expiry check logic if you stored expiry, otherwise perform valid check
        if (savedToken) {
            this.token = savedToken;
            this.userId = this.store.get(STORE_KEY_USER_ID);
            // Optionally validate token here
        }

        // 3. Auto-Login (Bootstrap)
        this.authenticate().catch(err => log.error('[AuthService] Auto-login failed:', err));
    }

    async authenticate() {
        try {
            log.info('[AuthService] Authenticating...');
            const res = await fetch(`${AUTH_BASE}/auth/anonymous`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    deviceId: this.deviceId,
                    appVersion: app.getVersion()
                })
            });

            if (!res.ok) throw new Error(`Auth failed: ${res.status}`);

            const data = await res.json();
            this.token = data.accessToken;

            // Extract User ID from response
            if (data.user && data.user.id) {
                this.userId = data.user.id;
            } else {
                // Fallback decode if not in body
                this.userId = this._decodeUserId(this.token);
            }

            // Persist
            this.store.set(STORE_KEY_AUTH_TOKEN, this.token);
            this.store.set(STORE_KEY_USER_ID, this.userId);

            log.info(`[AuthService] Authenticated as User: ${this.userId}`);
            return true;
        } catch (e) {
            log.error('[AuthService] Authentication error:', e);
            return false;
        }
    }

    async getToken() {
        // Simple token refresh logic could go here
        if (!this.token) {
            await this.authenticate();
        }
        return this.token;
    }

    getUserId() {
        return this.userId;
    }

    getDeviceId() {
        return this.deviceId;
    }

    _decodeUserId(token) {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            const payload = JSON.parse(jsonPayload);
            return payload.userId || payload.sub;
        } catch (e) {
            return null;
        }
    }
}

module.exports = new AuthService();
