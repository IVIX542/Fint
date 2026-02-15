import { supabase } from './supabase.js';

/**
 * Connection Monitor
 * Monitors internet connectivity and dispatches custom events
 */
class ConnectionMonitor {
    constructor() {
        this.isOnline = navigator.onLine;
        this.checkInterval = null;
        this.CHECK_INTERVAL_MS = 10000; // 10 seconds - more responsive for web
    }

    init() {
        console.log('ConnectionMonitor: Initializing...');

        // Check if running on native platform
        const isNative = window.Capacitor?.isNativePlatform();

        if (isNative && window.Capacitor?.Plugins?.Network) {
            // Native: Use Capacitor Network plugin for reliable detection
            this.initNativeListeners();
        } else {
            // Web: Use browser online/offline events
            this.initBrowserListeners();
        }

        // Start periodic real connectivity checks (as backup)
        this.startPeriodicCheck();
    }

    initNativeListeners() {
        const { Network } = window.Capacitor.Plugins;

        console.log('ConnectionMonitor: Using native Network plugin');

        // Listen to native network status changes
        Network.addListener('networkStatusChange', (status) => {
            console.log('Network status changed:', status);

            if (status.connected) {
                this.handleOnline();
            } else {
                this.handleOffline();
            }
        });

        // Get initial status
        Network.getStatus().then(status => {
            this.isOnline = status.connected;
            console.log('Initial network status:', status.connected ? 'online' : 'offline');
        });
    }

    initBrowserListeners() {
        console.log('ConnectionMonitor: Using browser events');

        // Get initial state
        this.isOnline = navigator.onLine;
        console.log('ConnectionMonitor: Initial state =', this.isOnline ? 'online' : 'offline');

        // Listen to browser online/offline events
        window.addEventListener('online', () => {
            console.log('ConnectionMonitor: Browser "online" event fired');
            this.handleOnline();
        });

        window.addEventListener('offline', () => {
            console.log('ConnectionMonitor: Browser "offline" event fired');
            this.handleOffline();
        });
    }

    startPeriodicCheck() {
        // Immediate first check
        this.performConnectivityCheck();

        // Then check every 30 seconds
        this.checkInterval = setInterval(() => {
            this.performConnectivityCheck();
        }, this.CHECK_INTERVAL_MS);
    }

    async performConnectivityCheck() {
        const wasOnline = this.isOnline;
        const isCurrentlyOnline = await this.checkRealConnectivity();

        // State changed?
        if (wasOnline !== isCurrentlyOnline) {
            // IMPORTANT: Call handlers BEFORE updating state
            // so they can detect the change correctly
            if (isCurrentlyOnline) {
                this.handleOnline();
            } else {
                this.handleOffline();
            }

            // Update state after dispatching events
            this.isOnline = isCurrentlyOnline;
        }
    }

    async checkRealConnectivity() {
        // First check navigator.onLine (fast)
        if (!navigator.onLine) {
            return false;
        }

        // Verify real connectivity with a reliable endpoint
        try {
            // Use a lightweight, reliable endpoint (Google DNS over HTTP)
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

            const response = await fetch('https://dns.google/resolve?name=google.com&type=A', {
                method: 'GET',
                signal: controller.signal,
                cache: 'no-cache'
            });

            clearTimeout(timeoutId);
            return response.ok;
        } catch (error) {
            console.log('ConnectionMonitor: Real connectivity check failed', error.message);
            // Network error = offline
            return false;
        }
    }

    handleOnline() {
        console.log('ConnectionMonitor: Browser reports online');

        // Immediately assume online and notify user
        const wasOffline = !this.isOnline;
        this.isOnline = true;

        // Only dispatch event if state actually changed
        if (wasOffline) {
            // Dispatch immediately for fast feedback
            window.dispatchEvent(new CustomEvent('connection-restored'));

            // Then verify real connectivity in background
            this.verifyConnectionInBackground();
        }
    }

    handleOffline() {
        console.log('ConnectionMonitor: Browser reports offline');

        // Immediately assume offline and notify user
        const wasOnline = this.isOnline;
        this.isOnline = false;

        // Only dispatch event if state actually changed
        if (wasOnline) {
            // Dispatch immediately for fast feedback
            window.dispatchEvent(new CustomEvent('connection-lost'));
        }
    }

    // Verify connection in background without blocking UI
    async verifyConnectionInBackground() {
        const isReallyOnline = await this.checkRealConnectivity();

        // If we thought we were online but we're actually offline
        if (this.isOnline && !isReallyOnline) {
            console.log('ConnectionMonitor: False positive - actually offline');
            this.isOnline = false;
            window.dispatchEvent(new CustomEvent('connection-lost'));
        }
    }

    stop() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }
}

// Export singleton instance
export const connectionMonitor = new ConnectionMonitor();
