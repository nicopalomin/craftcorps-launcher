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
        this.startupTime = Date.now() - (process.uptime() * 1000); // Approximate process start time
        this.token = null;
        this.tokenExpiry = null;
    }

    _log(message, data) {
        // Non-blocking log
        setImmediate(() => console.log(`[Telemetry] ${message}`, data || ''));
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

        // [AUTH] Bootstrap Telemetry Token - Deferred to first flush or heartbeat
        // await this.bootstrapToken();

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

        // Send immediate heartbeat (Starts Session) - Delayed for startup speed
        setTimeout(() => {
            this.sendHeartbeat();
        }, 15000);
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
            const token = await this.ensureToken(); // Optional: protect this too if needed, usually mostly stats
            if (!token) return;

            const ram = Math.round(os.totalmem() / (1024 * 1024 * 1024)) + ' GB';
            const cpu = os.cpus()[0]?.model || 'Unknown CPU';
            const osInfo = `${os.type()} ${os.release()} ${os.arch()}`;

            await fetch(`${API_BASE}/hardware`, {
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
        if (!this.userId) return;

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
        if (this.eventBuffer.length === 0 || !this.userId) return;

        const events = [...this.eventBuffer];
        this.eventBuffer = [];

        try {
            const token = await this.ensureToken();
            if (!token) throw new Error('No auth token available');

            await fetch(`${API_BASE}/telemetry`, {
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

    // New Wrapper for Manual Log Upload (Legacy Endpoint)
    async sendManualCrashReport(logContent, sysInfoString) {
        if (!this.userId) throw new Error('Telemetry not initialized');

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

        const uploadUrl = 'https://telemetry.craftcorps.net/api/crash-report';

        const token = await this.ensureToken();
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
