const { ipcMain, app } = require('electron');
const { v4: uuidv4 } = require('uuid');
const log = require('electron-log');

const STORE_KEY_DEVICE_ID = 'device_id';
const STORE_KEY_AUTH_TOKEN = 'auth_token';
const STORE_KEY_REFRESH_TOKEN = 'refresh_token';
const STORE_KEY_USER_ID = 'user_id';
const AUTH_BASE = 'https://auth.craftcorps.net';

class AuthService {
    constructor() {
        this.store = null;
        this.deviceId = null;
        this.userId = null;
        this.token = null;
        this.refreshToken = null;
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

        // 2. Load Persisted Tokens
        const savedToken = this.store.get(STORE_KEY_AUTH_TOKEN);
        const savedRefresh = this.store.get(STORE_KEY_REFRESH_TOKEN);

        if (savedToken) {
            this.token = savedToken;
            this.refreshToken = savedRefresh || null;
            this.userId = this.store.get(STORE_KEY_USER_ID);
        }

        // 3. Auto-Login / Refresh (Bootstrap)
        // We don't block validation here, just kick it off
        this.getToken().catch(err => log.error('[AuthService] Bootstrap auth failed:', err));
    }

    async authenticate() {
        try {
            log.info('[AuthService] Authenticating (Login)...');
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
            this._handleAuthResponse(data);

            log.info(`[AuthService] Authenticated as User: ${this.userId}`);
            return true;
        } catch (e) {
            log.error('[AuthService] Authentication error:', e);
            return false;
        }
    }

    async refreshSession() {
        if (!this.refreshToken) return false;
        try {
            log.info('[AuthService] Refreshing Session...');
            const res = await fetch(`${AUTH_BASE}/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken: this.refreshToken })
            });

            if (!res.ok) {
                // If refresh fails (401/403), we must re-login
                if (res.status === 401 || res.status === 403) {
                    this.refreshToken = null;
                    this.store.delete(STORE_KEY_REFRESH_TOKEN);
                }
                throw new Error(`Refresh failed: ${res.status}`);
            }

            const data = await res.json();
            // Refresh endpoint usually returns just accessToken, or both.
            // Adjust based on your backend.
            if (data.accessToken) {
                this.token = data.accessToken;
                this.store.set(STORE_KEY_AUTH_TOKEN, this.token);
                // If backend rotates refresh token, handle it:
                if (data.refreshToken) {
                    this.refreshToken = data.refreshToken;
                    this.store.set(STORE_KEY_REFRESH_TOKEN, this.refreshToken);
                }
                return true;
            }
            return false;
        } catch (e) {
            log.warn('[AuthService] Token refresh failed:', e.message);
            return false;
        }
    }

    async getToken() {
        // 1. Check if we have a token
        if (!this.token) {
            await this.authenticate();
            return this.token;
        }

        // 2. Check Expiry
        if (this._isTokenExpired(this.token)) {
            log.info('[AuthService] Token expired, attempting refresh...');
            const refreshed = await this.refreshSession();
            if (!refreshed) {
                log.info('[AuthService] Refresh failed, performing full login...');
                await this.authenticate();
            }
        }

        return this.token;
    }

    _handleAuthResponse(data) {
        this.token = data.accessToken;
        this.refreshToken = data.refreshToken || null;

        // Extract User ID
        if (data.user && data.user.id) {
            this.userId = data.user.id;
        } else {
            this.userId = this._decodeUserId(this.token);
        }

        // Persist
        this.store.set(STORE_KEY_AUTH_TOKEN, this.token);
        this.store.set(STORE_KEY_USER_ID, this.userId);
        if (this.refreshToken) {
            this.store.set(STORE_KEY_REFRESH_TOKEN, this.refreshToken);
        }
    }

    getUserId() {
        return this.userId;
    }

    getDeviceId() {
        return this.deviceId;
    }

    _isTokenExpired(token) {
        try {
            const payload = this._decodeToken(token);
            if (!payload || !payload.exp) return true; // Assume expired if invalid
            // exp is in seconds, Date.now() is ms
            const expiresAt = payload.exp * 1000;
            const now = Date.now();
            // Buffer of 60s
            return now > (expiresAt - 60000);
        } catch (e) {
            return true;
        }
    }

    _decodeUserId(token) {
        const payload = this._decodeToken(token);
        return payload ? (payload.userId || payload.sub) : null;
    }

    _decodeToken(token) {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            return JSON.parse(jsonPayload);
        } catch (e) {
            return null;
        }
    }
}

module.exports = new AuthService();
