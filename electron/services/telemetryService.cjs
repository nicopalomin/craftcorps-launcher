const { v4: uuidv4 } = require('uuid');
const os = require('os');
const { app } = require('electron');

const STORE_KEY = 'telemetry_user_id';
const API_BASE = 'https://telemetry.craftcorps.net/api';

class TelemetryService {
    constructor() {
        this.userId = null;
        this.sessionId = null;
        this.appVersion = app.getVersion();
        this.eventBuffer = [];
        this.flushInterval = null;
        this.store = null;
    }

    _log(message, data) {
        console.log(`[Telemetry] ${message}`, data || '');
    }

    async init(store) {
        this._log('Initializing telemetry service (Main Process)...');
        if (!store) {
            this._log('Store not provided to init');
            return;
        }
        this.store = store;

        // Get or Create Anonymous ID
        let id = store.get(STORE_KEY);
        if (!id || typeof id !== 'string') {
            id = uuidv4();
            store.set(STORE_KEY, id);
        }
        this.userId = id;

        // Check for pending offline events (from store, if we saved them there)
        // Note: effectively we might want to store pending events in store too
        const pending = store.get('pending_telemetry_events_main');
        if (pending && Array.isArray(pending) && pending.length > 0) {
            this._log('Found pending offline events:', pending.length);
            this.eventBuffer.push(...pending);
            store.delete('pending_telemetry_events_main');
            this.flushEvents();
        }

        // Start flush timer (every 30s)
        this.flushInterval = setInterval(() => this.flushEvents(), 30000);

        // Send immediate heartbeat (Starts Session)
        // this.sendHeartbeat(); // Disabled to avoid duplicate sessions

        // Send Hardware Info on startup
        // this.sendHardwareInfo(); // Disabled (Frontend sends detailed info)
    }

    async sendHeartbeat() {
        if (!this.userId) return;
        // this._log('Sending heartbeat...'); // Reduce noise
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
            console.error('[Telemetry] Heartbeat failed', e.message);
        }
    }

    async sendHardwareInfo() {
        if (!this.userId) return;
        try {
            // Simple hardware info from os module
            const ram = Math.round(os.totalmem() / (1024 * 1024 * 1024)) + ' GB';
            const cpu = os.cpus()[0]?.model || 'Unknown CPU';
            const osInfo = `${os.type()} ${os.release()} ${os.arch()}`;

            await fetch(`${API_BASE}/hardware`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: this.userId,
                    os: process.platform, // 'win32', 'linux', 'darwin'
                    osVersion: osInfo,
                    ram: ram,
                    cpu: cpu,
                    gpu: 'Unknown (Main Process)' // GPU info is harder in pure Node without systeminformation/electron getGPUInfo
                }),
            });
        } catch (e) {
            console.error('[Telemetry] Hardware info failed', e.message);
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

    // Specific helper for crashes
    async trackCrash(error) {
        console.error('[Telemetry] Tracking Crash:', error);
        await this.track('CRASH', {
            message: error.message,
            stack: error.stack,
            name: error.name
        }, true); // force immediate flush
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
            this._log(`Flushed ${events.length} events successfully.`);
        } catch (e) {
            console.error('[Telemetry] Failed to flush events', e.message);

            // Save back to store for next run
            this.savePendingEvents(events);
        }
    }

    // New Wrapper for Manual Log Upload (Legacy Endpoint)
    // This allows it to show up in the "Crash Reports" tab of the admin panel
    async sendManualCrashReport(logContent, sysInfoString) {
        if (!this.userId) throw new Error('Telemetry not initialized');

        const finalContent = sysInfoString + '\n' + logContent;

        // Node 18+ has Blob/FormData global
        const blob = new Blob([finalContent], { type: 'text/plain' });
        const formData = new FormData();
        formData.append('upload_file_minidump', blob, 'manual_log.txt');

        // Additional Fields expected by Backend/Electron crashReporter
        formData.append('guid', uuidv4());
        formData.append('ver', this.appVersion);
        formData.append('platform', process.platform);
        formData.append('process_type', 'browser'); // Main process is 'browser' in Electron terms usually
        formData.append('_productName', 'CraftCorps');
        formData.append('_version', this.appVersion);
        formData.append('userId', this.userId); // Custom field we added to backend

        const uploadUrl = 'https://telemetry.craftcorps.net/api/crash-report';

        const response = await fetch(uploadUrl, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }
    }

    savePendingEvents(failedEvents) {
        try {
            if (!this.store) return;
            const existing = this.store.get('pending_telemetry_events_main') || [];
            let allEvents = [...existing, ...failedEvents];

            // Cap to 500
            if (allEvents.length > 500) {
                allEvents = allEvents.slice(allEvents.length - 500);
            }
            this.store.set('pending_telemetry_events_main', allEvents);
        } catch (storageErr) {
            console.error('[Telemetry] Failed to save offline events', storageErr);
        }
    }
}

module.exports = new TelemetryService();
