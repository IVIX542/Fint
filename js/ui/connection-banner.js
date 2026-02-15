/**
 * Connection Banner
 * Displays temporary connection status notifications
 */
class ConnectionBanner {
    constructor() {
        this.banner = null;
        this.hideTimeout = null;
        this.AUTO_HIDE_MS = 3000; // 3 seconds
    }

    init() {
        // Create banner element
        this.banner = document.createElement('div');
        this.banner.className = 'connection-banner';
        this.banner.setAttribute('role', 'status');
        this.banner.setAttribute('aria-live', 'polite');
        document.body.appendChild(this.banner);
    }

    show(message, type = 'offline') {
        if (!this.banner) {
            console.warn('ConnectionBanner: Banner not initialized');
            return;
        }

        // Clear any existing hide timeout
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
        }

        // Set content and style
        this.banner.textContent = message;
        this.banner.className = `connection-banner ${type} show`;

        // Auto-hide after 3 seconds
        this.hideTimeout = setTimeout(() => {
            this.hide();
        }, this.AUTO_HIDE_MS);
    }

    hide() {
        if (!this.banner) return;

        this.banner.classList.remove('show');

        // Clear timeout reference
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
            this.hideTimeout = null;
        }
    }

    showOffline() {
        this.show('📡 Sin conexión - Trabajando en modo offline', 'offline');
    }

    showOnline() {
        this.show('✅ Conexión restaurada - Sincronizando...', 'online');
    }
}

// Export singleton instance
export const connectionBanner = new ConnectionBanner();
