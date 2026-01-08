
import { v4 as uuidv4 } from 'uuid';

const STORE_KEY = 'telemetry_user_id';
const API_BASE = 'http://telemetry.craftcorps.net/api';

class TelemetryService {
    constructor() {
        this.userId = null;
        this.sessionId = null;
        this.appVersion = null;
        this.eventBuffer = [];
        this.flushInterval = null;
    }

    async init(store) {
        if (!store) return;

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

        // Check for pending offline events
        try {
            const pending = localStorage.getItem('pending_telemetry_events');
            if (pending) {
                const events = JSON.parse(pending);
                if (Array.isArray(events) && events.length > 0) {
                    console.log('[Telemetry] Found pending offline events:', events.length);
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

        // Send immediate heartbeat (Starts Session)
        this.sendHeartbeat();

        // Track App Close
        window.addEventListener('beforeunload', () => {
            this.track('APP_QUIT');
            this.flushEvents(); // Try to send immediately
        });
    }

    async sendHeartbeat() {
        if (!this.userId) return;
        try {
            const res = await fetch(`${API_BASE}/heartbeat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: this.userId,
                    sessionId: this.sessionId,
                    appVersion: this.appVersion
                }),
            });
            const data = await res.json();
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
            const info = await window.electronAPI.getSystemInfo(); // We need to implement this IPC
            await fetch(`${API_BASE}/hardware`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: this.userId,
                    ...info
                }),
            });
        } catch (e) {
            console.error('[Telemetry] Hardware info failed', e);
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
        this.eventBuffer = []; // Clear buffer immediately

        try {
            await fetch(`${API_BASE}/telemetry`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: this.userId, events }),
            });
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
