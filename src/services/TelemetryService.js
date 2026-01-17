
import { v4 as uuidv4 } from 'uuid';

const STORE_KEY = 'telemetry_user_id';
const AUTH_API = 'https://auth.craftcorps.net';
const TELEMETRY_API = 'https://telemetry.craftcorps.net';
const API_BASE = 'https://api.craftcorps.net';

class TelemetryService {
    constructor() {
        this.sessionId = null;
        this.authUserId = null; // Used for UI display
        this.appVersion = null;
        // Legacy props kept for structure stability, but unused
        this.eventBuffer = [];
        this.flushInterval = null;
        this.pageViewDebounce = null;
    }

    trackPage(pageName) {
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
        this._log('Initializing telemetry client (Renderer)...');
        this.store = store;

        // Sync Auth ID from Main Process
        try {
            if (window.electronAPI) {
                this.authUserId = await window.electronAPI.getAuthUserId();
                this._log('Synced Auth User ID:', this.authUserId);
            }
        } catch (e) {
            console.error('[Telemetry] Failed to sync auth id', e);
        }

        // Check for First Launch (Client Trigger)
        if (!localStorage.getItem('has_sent_first_launch')) {
            this.track('FIRST_LAUNCH', {}, true);
            localStorage.setItem('has_sent_first_launch', 'true');
        }

        // Track App Close
        window.addEventListener('beforeunload', () => {
            this.track('APP_QUIT');
        });
    }

    // No-op for tokens as Main handles it
    async bootstrapToken() { }
    async ensureToken() { }
    async sendHeartbeat() {
        // Main process handles its own heartbeat.
        // If we need a renderer "session" heartbeat, we can send an event.
    }
    async sendHardwareInfo() { } // Main process has better access to hardware info

    // Legacy support for Discover (keep local fetch or move to Main?)
    // For now, keep Discover fetching here as it interacts with UI Store, BUT it should use the token from Main?
    // Actually, Discover fetcher handles its own "ensureToken" which flushes to auth service.
    // It's cleaner to leave Discover here for now but use the token if possible?
    // Let's deprecate the internal specific auth logic here and try to grab token if possible, or just let Discover fail over to public?
    // Actually, the previous code fetched its own token.
    // Ideally, get cached discover servers stays. Fetching should probably happen in Main or use a public endpoint.
    // Let's keep existing cached/fetch logic but remove the heavy auth/telemetry lifting.

    // Discovery methods moved to DiscoveryService.js

    track(type, metadata = {}, immediate = false) {
        if (window.electronAPI && window.electronAPI.trackTelemetryEvent) {
            window.electronAPI.trackTelemetryEvent(type, metadata);
        } else {
            console.warn('[Telemetry] Electron API not available, event dropped:', type);
        }
    }

    async flushEvents() {
        // No-op, handled by Main process
    }
}

export const telemetry = new TelemetryService();
