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
    }

    init(store) {
        log.info('[AuthService] Initializing...');
        this.store = store;

        // 1. Load or Generate Install ID
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

        // 3. Attempt Refresh or Anon Login on Init
        this.getToken().catch(err => log.error('[AuthService] Bootstrap auth failed:', err));
    }

    _ensureDeviceId() {
        if (this.deviceId) return this.deviceId;
        this.deviceId = this.store.get(STORE_KEY_DEVICE_ID);
        if (!this.deviceId) {
            try {
                const { machineIdSync } = require('node-machine-id');
                this.deviceId = machineIdSync({ original: true });
            } catch (e) {
                this.deviceId = uuidv4();
            }
            this.store.set(STORE_KEY_DEVICE_ID, this.deviceId);
        }
        return this.deviceId;
    }

    // --- Public Auth Endpoints ---

    async register(email, password, username) {
        log.info(`[AuthService] Registering ${email}...`);
        const res = await fetch(`${AUTH_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, username })
        });

        if (!res.ok) throw new Error(`Registration failed: ${res.status}`);
        return true;
    }

    async login(email, password) {
        log.info(`[AuthService] Logging in ${email}...`);
        const res = await fetch(`${AUTH_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email,
                password,
                installId: this.installId,
                clientType: 'launcher'
            })
        });

        if (!res.ok) throw new Error(`Login failed: ${res.status}`);
        const data = await res.json();
        this._handleAuthResponse(data);
        return data;
    }

    async loginMicrosoft(accessToken) {
        log.info('[AuthService] Logging in with Microsoft...');
        const res = await fetch(`${AUTH_BASE}/auth/login/microsoft`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accessToken })
        });

        if (!res.ok) throw new Error(`Microsoft Login failed: ${res.status}`);
        const data = await res.json();
        this._handleAuthResponse(data);
        return data;
    }

    async loginAnonymous() {
        log.info(`[AuthService] Login Anonymous InstallID ${this.installId}...`);
        try {
            const res = await fetch(`${AUTH_BASE}/auth/anonymous`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ installId: this.installId })
            });

            if (!res.ok) throw new Error(`Anonymous Auth failed: ${res.status}`);
            const data = await res.json();
            this._handleAuthResponse(data);
            return true;
        } catch (e) {
            log.warn(`[AuthService] Anonymous login failed (offline?): ${e.message}`);
            return false;
        }
    }

    // Alias for backward compatibility if needed, or replace usages
    async authenticate() {
        return this.loginAnonymous();
    }

    async refreshSession() {
        if (!this.refreshToken) return false;
        try {
            const res = await fetch(`${AUTH_BASE}/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken: this.refreshToken })
            });

            if (!res.ok) {
                if (res.status === 401 || res.status === 403) {
                    this.invalidateSession();
                }
                throw new Error(`Refresh failed: ${res.status}`);
            }

            const data = await res.json();
            if (data.accessToken) {
                this.token = data.accessToken;
                this.store.set(STORE_KEY_AUTH_TOKEN, this.token);
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

    // --- Authenticated User Endpoints ---

    async logout() {
        try {
            await this.fetchAuthenticated(`${AUTH_BASE}/auth/logout`, { method: 'POST' });
        } catch (e) {
            log.warn('[AuthService] Logout failed on server, clearing local anyway', e);
        }
        this.invalidateSession();
    }

    async linkCredentials(email, password) {
        log.info(`[AuthService] Linking credentials for ${email}...`);
        const res = await this.fetchAuthenticated(`${AUTH_BASE}/auth/link/credentials`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        if (!res.ok) throw new Error(`Link Credentials failed: ${res.status}`);
        return true;
    }

    async linkProfile(profile) {
        const deviceId = this._ensureDeviceId();
        // profile: { uuid, name, authType }
        const res = await this.fetchAuthenticated(`${AUTH_BASE}/auth/link/profile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                deviceId,
                profile
            })
        });
        if (!res.ok) throw new Error(`Link Profile failed: ${res.status}`);
        return true;
    }

    async linkMicrosoft(accessToken) {
        log.info('[AuthService] Linking Microsoft Account...');
        const res = await this.fetchAuthenticated(`${AUTH_BASE}/auth/link/microsoft`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accessToken })
        });
        if (!res.ok) throw new Error(`Link Microsoft failed: ${res.status}`);
        return true;
    }

    async recordConsent(agreement) {
        const res = await this.fetchAuthenticated(`${AUTH_BASE}/auth/consent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agreementType: agreement.type,
                agreementVersion: agreement.version
            })
        });
        if (!res.ok) throw new Error(`Consent failed: ${res.status}`);
        return true;
    }

    // --- Helpers ---

    async getToken() {
        if (!this.token) {
            await this.loginAnonymous();
            return this.token;
        }
        if (this._isTokenExpired(this.token)) {
            const refreshed = await this.refreshSession();

            // Fix: If refresh failed (e.g. network error) but we still have a refresh token (session not invalidated),
            // do NOT fall back to anonymous. This preserves the user's identity while offline.
            if (!refreshed && this.refreshToken) {
                return this.token;
            }

            if (!refreshed) {
                await this.loginAnonymous();
            }
        }
        return this.token;
    }

    _handleAuthResponse(data) {
        this.token = data.accessToken;
        this.refreshToken = data.refreshToken || null;

        // Decoding logic ...
        if (data.user && data.user.id) {
            this.userId = data.user.id;
        } else {
            this.userId = this._decodeUserId(this.token);
        }

        this.store.set(STORE_KEY_AUTH_TOKEN, this.token);
        this.store.set(STORE_KEY_USER_ID, this.userId);
        if (this.refreshToken) {
            this.store.set(STORE_KEY_REFRESH_TOKEN, this.refreshToken);
        }
    }

    async getUserId() { return this.userId; } // Existing

    async getUserProfile() {
        log.info('[AuthService] Fetching user profile...');
        const res = await this.fetchAuthenticated(`${AUTH_BASE}/auth/me`);
        if (!res.ok) throw new Error('Failed to fetch profile');
        return await res.json();
    }
    getDeviceId() { return this.deviceId; }

    _isTokenExpired(token) {
        try {
            const payload = this._decodeToken(token);
            if (!payload || !payload.exp) return true;
            return Date.now() > (payload.exp * 1000 - 60000);
        } catch (e) { return true; }
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
        const headers = { ...options.headers, 'Authorization': `Bearer ${token}` };
        const response = await fetch(url, { ...options, headers });

        if (response.status === 401 && !retried) {
            this.invalidateSession();
            return this.fetchAuthenticated(url, options, true);
        }
        return response;
    }

    invalidateSession() {
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
