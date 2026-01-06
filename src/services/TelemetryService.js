
import { v4 as uuidv4 } from 'uuid';

const STORE_KEY = 'telemetry_user_id';
const API_BASE = 'http://localhost:3000/api'; // TODO: Change to prod URL

class TelemetryService {
    constructor() {
        this.userId = null;
        this.sessionId = null;
        this.appVersion = null; // [NEW]
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
                    appVersion: this.appVersion // [NEW]
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

    track(type, metadata = {}) {
        if (!this.userId) return;

        this.eventBuffer.push({
            type,
            metadata,
            timestamp: new Date().toISOString(),
        });

        if (this.eventBuffer.length >= 10) {
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
            // Optional: push back to buffer if needed, but be careful of loops
        }
    }
}

export const telemetry = new TelemetryService();
