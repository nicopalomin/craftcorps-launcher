const { ipcMain, app } = require('electron');
const { v4: uuidv4 } = require('uuid');
const log = require('electron-log');

const STORE_KEY_DEVICE_ID = 'device_id';
const STORE_KEY_INSTALL_ID = 'install_id'; // New UUID for anonymous account
const STORE_KEY_AUTH_TOKEN = 'auth_token';
const STORE_KEY_REFRESH_TOKEN = 'refresh_token';
const STORE_KEY_USER_ID = 'user_id';
const AUTH_BASE = 'https://auth.craftcorps.net';

class AuthService {
    constructor() {
        this.store = null;
        this.deviceId = null;
        this.installId = null;
        this.userId = null;
        this.token = null;
        this.refreshToken = null;
        this.tokenExpiry = null;
    }

    init(store) {
        log.info('[AuthService] Initializing...');
        this.store = store;

        // 1. Load or Generate Install ID (Random UUID for Account)
        this.installId = this.store.get(STORE_KEY_INSTALL_ID);
        if (!this.installId) {
            this.installId = uuidv4();
            this.store.set(STORE_KEY_INSTALL_ID, this.installId);
        }
        log.info(`[AuthService] Install ID: ${this.installId}`);

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

    // Lazy load Device ID (Hardware Fingerprint) only when needed (Linking)
    _ensureDeviceId() {
        if (this.deviceId) return this.deviceId;

        log.info('[AuthService] Checking for Device ID...');
        this.deviceId = this.store.get(STORE_KEY_DEVICE_ID);
        if (!this.deviceId) {
            log.info('[AuthService] Generating New Device ID...');
            try {
                const { machineIdSync } = require('node-machine-id');
                this.deviceId = machineIdSync({ original: true });
            } catch (e) {
                log.warn('[AuthService] Failed to get machine-id, falling back to UUID', e);
                this.deviceId = uuidv4();
            }
            this.store.set(STORE_KEY_DEVICE_ID, this.deviceId);
            log.info(`[AuthService] Device ID Generated: ${this.deviceId}`);
        } else {
            log.info(`[AuthService] Loaded Existing Device ID: ${this.deviceId}`);
        }
        return this.deviceId;
    }

    async authenticate() {
        try {
            log.info(`[AuthService] Syncing Anonymous Session for InstallID ${this.installId}...`);
            // Use installId for anonymous account creation
            const res = await fetch(`${AUTH_BASE}/auth/anonymous`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    installId: this.installId, // Changed from deviceId
                    appVersion: app.getVersion()
                })
            });

            if (!res.ok) throw new Error(`Auth failed: ${res.status}`);

            const data = await res.json();
            this._handleAuthResponse(data);

            log.info(`[AuthService] Session Synced. User: ${this.userId}`);
            return true;
        } catch (e) {
            log.error('[AuthService] Authentication error:', e);
            return false;
        }
    }

    async linkProfile(profile) {
        // profile: { uuid, name, authType }
        try {
            const deviceId = this._ensureDeviceId();
            log.info(`[AuthService] Linking Profile ${profile.name} to User ${this.userId} with DeviceID ${deviceId}...`);

            const res = await this.fetchAuthenticated(`${AUTH_BASE}/auth/link/profile`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    deviceId: deviceId,
                    profile: profile
                })
            });

            if (!res.ok) throw new Error(`Link failed: ${res.status}`);
            log.info('[AuthService] Profile Linked Successfully.');
            return true;
        } catch (e) {
            log.error('[AuthService] Failed to link profile:', e);
            return false;
        }
    }

    async recordConsent(agreement) {
        // agreement: { type: 'EULA'|'TOS', version: '1.0' }
        try {
            log.info(`[AuthService] Sending user consent: ${agreement.type} v${agreement.version}...`);

            const res = await this.fetchAuthenticated(`${AUTH_BASE}/auth/consent`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agreementType: agreement.type,
                    agreementVersion: agreement.version
                })
            });

            if (!res.ok) throw new Error(`Consent record failed: ${res.status}`);

            log.info('[AuthService] Consent Accepted by Backend.');
            return true;
        } catch (e) {
            log.error('[AuthService] Failed to record consent:', e);
            throw e; // Propagate error to block login if consent fails
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
    async fetchAuthenticated(url, options = {}, retried = false) {
        const token = await this.getToken();
        const headers = {
            ...options.headers,
            'Authorization': `Bearer ${token}`
        };

        const response = await fetch(url, { ...options, headers });

        if (response.status === 401 && !retried) {
            log.warn(`[AuthService] 401 at ${url}. Invalidating session and retrying.`);
            this.invalidateSession();
            return this.fetchAuthenticated(url, options, true);
        }

        return response;
    }

    invalidateSession() {
        log.info('[AuthService] Invalidating session...');
        this.token = null;
        this.refreshToken = null;
        this.userId = null;
        if (this.store) {
            this.store.delete(STORE_KEY_AUTH_TOKEN);
            this.store.delete(STORE_KEY_REFRESH_TOKEN);
            this.store.delete(STORE_KEY_USER_ID);
        }
    }
}

module.exports = new AuthService();
