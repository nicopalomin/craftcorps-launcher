
import { v4 as uuidv4 } from 'uuid';

const STORE_KEY = 'telemetry_user_id';
const API_BASE = 'https://telemetry.craftcorps.net/api';

class TelemetryService {
    constructor() {
        this.userId = null;
        this.sessionId = null;
        this.appVersion = null;
        this.eventBuffer = [];
        this.flushInterval = null;
        this.pageViewDebounce = null;
        this.token = null;
        this.tokenExpiry = null;
    }

    trackPage(pageName) {
        if (!this.userId) return;
        // Simple debounce to avoid rapid switching spam
        if (this.pageViewDebounce) clearTimeout(this.pageViewDebounce);
        this.pageViewDebounce = setTimeout(() => {
            this.track('VIEW_PAGE', { page: pageName });
        }, 1000);
    }

    trackThemeChange(newTheme) {
        this.track('THEME_CHANGE', { theme: newTheme });
    }

    _log(message, data) {
        console.log(message, data || '');
        if (window.electronAPI && window.electronAPI.log) {
            try {
                const dataStr = data ? JSON.stringify(data) : '';
                window.electronAPI.log('info', `[Telemetry] ${message} ${dataStr}`);
            } catch (e) {
                // Ignore serialization errors
            }
        }
    }

    async init(store) {
        this._log('Initializing telemetry service...');
        if (!store) {
            this._log('Store not provided to init');
            return;
        }
        this.store = store;

        // Get or Create Anonymous ID
        let id = await store.get(STORE_KEY);
        if (!id || typeof id !== 'string') {
            id = uuidv4();
            await store.set(STORE_KEY, id);
        }
        this.userId = id;

        // Get App Version
        if (window.electronAPI && window.electronAPI.getAppVersion) {
            this.appVersion = await window.electronAPI.getAppVersion();
        }

        // [AUTH] Restore token from store if valid
        try {
            const savedToken = await store.get('telemetry_token');
            const savedExpiry = await store.get('telemetry_token_expiry');
            if (savedToken && savedExpiry && Date.now() < savedExpiry) {
                this.token = savedToken;
                this.tokenExpiry = savedExpiry;
                this._log('Restored valid telemetry token from store');
            }
        } catch (e) { /* ignore */ }

        // [AUTH] Bootstrap Telemetry Token - Deferred
        // await this.bootstrapToken();

        // Check for pending offline events
        try {
            const pending = localStorage.getItem('pending_telemetry_events');
            if (pending) {
                const events = JSON.parse(pending);
                if (Array.isArray(events) && events.length > 0) {
                    this._log('Found pending offline events:', events.length);
                    this.eventBuffer.push(...events);
                    // Clear storage now, if flush fails they will be re-saved
                    localStorage.removeItem('pending_telemetry_events');
                    this.flushEvents();
                }
            }
        } catch (e) {
            console.error('[Telemetry] Failed to load pending events', e);
        }

        // Start flush timer (every 30s)
        this.flushInterval = setInterval(() => this.flushEvents(), 30000);

        // Send immediate heartbeat (Starts Session) - Delayed
        setTimeout(() => {
            this.sendHeartbeat();
        }, 15000);

        // Check for First Launch (Client Trigger)
        if (!localStorage.getItem('has_sent_first_launch')) {
            this.track('FIRST_LAUNCH', {}, true);
            localStorage.setItem('has_sent_first_launch', 'true');
        }

        // Track App Close
        window.addEventListener('beforeunload', () => {
            this.track('APP_QUIT');
            this.flushEvents(); // Try to send immediately
        });
    }

    async bootstrapToken() {
        try {
            this._log('Bootstrapping telemetry token...');
            const res = await fetch(`${API_BASE}/telemetry/bootstrap`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientId: this.userId })
            });

            if (!res.ok) throw new Error(`Bootstrap failed: ${res.status}`);

            const data = await res.json();
            this.token = data.token;
            // calculated expiry (subtract 5 mins buffer)
            this.tokenExpiry = Date.now() + (data.expiresIn * 1000) - 300000;

            if (this.store) {
                await this.store.set('telemetry_token', this.token);
                await this.store.set('telemetry_token_expiry', this.tokenExpiry);
            }

            this._log('Telemetry token acquired.');
        } catch (e) {
            console.error('[Telemetry] Bootstrap error:', e.message);
        }
    }

    async ensureToken() {
        if (!this.token || (this.tokenExpiry && Date.now() > this.tokenExpiry)) {
            await this.bootstrapToken();
        }
        return this.token;
    }

    async sendHeartbeat() {
        if (!this.userId) return;
        this._log('Sending heartbeat...', { userId: this.userId });
        try {
            const token = await this.ensureToken();
            if (!token) return;

            const res = await fetch(`${API_BASE}/heartbeat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    sessionId: this.sessionId,
                    appVersion: this.appVersion
                }),
            });
            const data = await res.json();
            this._log('Heartbeat response:', data);
            if (data.sessionId) {
                this.sessionId = data.sessionId;
            }
        } catch (e) {
            console.error('[Telemetry] Heartbeat failed', e);
        }
    }

    async sendHardwareInfo() {
        if (!this.userId) return;
        try {
            const token = await this.ensureToken();
            if (!token) return;

            const info = await window.electronAPI.getSystemInfo(); // We need to implement this IPC
            await fetch(`${API_BASE}/hardware`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    userId: this.userId,
                    ...info
                }),
            });
        } catch (e) {
            console.error('[Telemetry] Hardware info failed', e);
        }
    }

    async getCachedDiscoverServers() {
        if (!this.store) {
            // Store not ready yet (before init)
            return [];
        }
        return (await this.store.get('cached_discover_servers')) || [];
    }

    async fetchDiscoverServers(offset = 0, limit = 9) {
        try {
            this._log(`[Discover] Fetching offset=${offset}, limit=${limit}`);
            const token = await this.ensureToken();
            if (!token) {
                this._log('[Discover] No token available');
                return { servers: [], hasMore: false };
            }

            const url = `${API_BASE}/servers/discover?offset=${offset}&limit=${limit}`;
            this._log(`[Discover] Requesting: ${url}`);

            const res = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            this._log(`[Discover] Response status: ${res.status}`);

            if (!res.ok) throw new Error(`Failed to fetch servers: ${res.statusText}`);
            const data = await res.json();



            // Handle Legacy Backend (returns Array)
            if (Array.isArray(data)) {
                this._log('[Discover] Detected Legacy Array Format');
                // Cache the first page if successful (Legacy)
                if (offset === 0 && this.store) {
                    await this.store.set('cached_discover_servers', data);
                }
                return { success: true, servers: data, hasMore: false };
            }

            // Handle New Backend (returns Object)
            // Cache the first page if successful
            if (data.success && offset === 0 && this.store) {
                await this.store.set('cached_discover_servers', data.servers);
            }

            return data;
        } catch (e) {
            this._log('[Discover] Error fetching servers', e);
            return { servers: [], hasMore: false };
        }
    }

    track(type, metadata = {}, immediate = false) {
        if (!this.userId) return;

        this.eventBuffer.push({
            type,
            metadata,
            timestamp: new Date().toISOString(),
        });

        if (immediate || this.eventBuffer.length >= 10) {
            this.flushEvents();
        }
    }

    async flushEvents() {
        if (this.eventBuffer.length === 0 || !this.userId) return;

        const events = [...this.eventBuffer];
        this._log(`Flushing ${events.length} events:`, events);
        this.eventBuffer = []; // Clear buffer immediately

        try {
            const token = await this.ensureToken();
            if (!token) throw new Error('No auth token available');

            await fetch(`${API_BASE}/telemetry`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ userId: this.userId, events }),
            });
            this._log('Automatically flushed events successfully.');
        } catch (e) {
            console.error('[Telemetry] Failed to flush events', e);

            // Save back to localStorage for next run
            try {
                // Merge with existing if any (edge case where we failed twice in a row, rare but possible)
                const existing = localStorage.getItem('pending_telemetry_events');
                let allEvents = events;
                if (existing) {
                    const parsed = JSON.parse(existing);
                    if (Array.isArray(parsed)) {
                        allEvents = [...parsed, ...events];
                    }
                }

                // Cap the size to avoid quota errors (e.g. 500 events)
                if (allEvents.length > 500) {
                    allEvents = allEvents.slice(allEvents.length - 500);
                }

                localStorage.setItem('pending_telemetry_events', JSON.stringify(allEvents));
            } catch (storageErr) {
                console.error('[Telemetry] Failed to save offline events', storageErr);
            }
        }
    }
}

export const telemetry = new TelemetryService();
