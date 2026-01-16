const { app } = require('electron');
const authService = require('./authService.cjs'); // [NEW]

const API_BASE = 'https://telemetry.craftcorps.net';

class TelemetryService {
    constructor() {
        this.sessionId = null;
        this.appVersion = app.getVersion();
        this.eventBuffer = [];
        this.flushInterval = null;
        this.store = null;
        this.startupTime = Date.now() - (process.uptime() * 1000);
    }

    _log(message, data) {
        setImmediate(() => console.log(`[Telemetry] ${message}`, data || ''));
    }

    async init(store) {
        this._log('Initializing telemetry service (Main Process)...');
        this.store = store;

        // Note: Auth Service should already be initialized by main.js

        // Check for pending offline events
        const pending = store.get('pending_telemetry_events_main');
        if (pending && Array.isArray(pending) && pending.length > 0) {
            this._log('Found pending offline events:', pending.length);
            this.eventBuffer.push(...pending);
            store.delete('pending_telemetry_events_main');
            this.flushEvents();
        }

        // Start flush timer
        this.flushInterval = setInterval(() => this.flushEvents(), 60000);

        // Track Startup Time (once)
        if (!store.get('has_sent_startup_perf')) {
            const startupDuration = Date.now() - this.startupTime;
            this.track('APP_STARTUP_TIME', { durationMs: startupDuration });
        }

        // Send immediate heartbeat (Starts Session) - Delayed
        setTimeout(() => {
            this.sendHeartbeat();
        }, 15000);
    }

    // Auth is delegated to authService

    get userId() {
        return authService.getUserId();
    }

    async sendHeartbeat() {
        if (!this.userId) return; // Wait for Auth
        try {
            const token = await authService.getToken();
            if (!token) return;

            const res = await fetch(`${API_BASE}/telemetry/heartbeat`, {
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
            const token = await authService.getToken();
            if (!token) return;

            const os = require('os');
            const ram = Math.round(os.totalmem() / (1024 * 1024 * 1024)) + ' GB';
            const cpu = os.cpus()[0]?.model || 'Unknown CPU';
            const osInfo = `${os.type()} ${os.release()} ${os.arch()}`;

            await fetch(`${API_BASE}/telemetry/hardware`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    userId: this.userId,
                    os: process.platform,
                    osVersion: osInfo,
                    ram: ram,
                    cpu: cpu,
                    gpu: 'Unknown (Main Process)'
                }),
            });
        } catch (e) {
            console.error('[Telemetry] Hardware info failed', e.message);
        }
    }

    track(type, metadata = {}, immediate = false) {
        // Can track before auth, but flush will wait for auth
        // Constraint: Max buffer size
        if (this.eventBuffer.length > 100) {
            this.eventBuffer.shift();
        }

        this.eventBuffer.push({
            type,
            metadata: JSON.stringify(metadata),
            timestamp: new Date().toISOString(),
        });

        if (immediate || this.eventBuffer.length >= 20) {
            if (this._flushTimer) clearTimeout(this._flushTimer);
            this._flushTimer = setTimeout(() => this.flushEvents(), 2000);
        }
    }

    trackError(source, message) {
        this.track('ERROR', { source, message });
    }

    async trackCrash(error) {
        console.error('[Telemetry] Tracking Crash:', error);
        await this.track('CRASH', {
            message: error.message,
            stack: error.stack,
            name: error.name
        }, true);
    }

    async flushEvents() {
        if (this.eventBuffer.length === 0) return;
        if (!this.userId) return; // Wait for auth

        const events = [...this.eventBuffer];
        this.eventBuffer = [];

        try {
            const token = await authService.getToken();
            if (!token) throw new Error('No auth token available');

            await fetch(`${API_BASE}/telemetry/events`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ events }),
            });
            this._log(`Flushed ${events.length} events successfully.`);
        } catch (e) {
            console.error('[Telemetry] Failed to flush events', e.message);
            this.savePendingEvents(events);
        }
    }

    getBackendUserId() {
        return authService.getUserId();
    }

    async sendManualCrashReport(logContent, sysInfoString) {
        if (!this.userId) throw new Error('Auth not initialized');

        const { v4: uuidv4 } = require('uuid');
        const finalContent = sysInfoString + '\n' + logContent;
        const blob = new Blob([finalContent], { type: 'text/plain' });
        const formData = new FormData();
        formData.append('upload_file_minidump', blob, 'manual_log.txt');
        formData.append('guid', uuidv4());
        formData.append('ver', this.appVersion);
        formData.append('platform', process.platform);
        formData.append('process_type', 'browser');
        formData.append('_productName', 'CraftCorps');
        formData.append('_version', this.appVersion);
        formData.append('userId', this.userId);

        const uploadUrl = 'https://api.craftcorps.net/crashes/report';

        const token = await authService.getToken();
        if (!token) throw new Error('No auth token available for crash report');

        const response = await fetch(uploadUrl, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
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
