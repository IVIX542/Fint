export const themeManager = {
    // Default Settings
    defaults: {
        global: { hue: 250, fontSize: 1 },
        dashboard: { hue: null, fontSize: null },
        transactions: { hue: null, fontSize: null },
        stats: { hue: null, fontSize: null },
        profile: { hue: null, fontSize: null }
    },

    // Apply settings to DOM
    apply: (settings) => {
        const s = { ...themeManager.defaults, ...settings };

        // 1. Apply Mode (Light/Dark)
        // If mode is set in settings, use it. Otherwise default to current or 'dark'
        const mode = s.mode || 'dark'; // data-theme default is dark in CSS
        document.documentElement.setAttribute('data-theme', mode);

        // Build CSS String
        let css = `
            :root {
                --primary-hue: ${s.global.hue || 250};
            }
            body {
                font-size: ${s.global.fontSize || 1}rem;
            }
        `;

        // Per Section Overrides
        const sections = ['dashboard', 'transactions', 'stats', 'profile'];
        sections.forEach(sec => {
            if (s[sec]) {
                const hue = s[sec].hue;
                // Only override if value is present (not null)
                if (hue) {
                    css += `
                        .view-${sec} {
                            --primary-hue: ${hue} !important;
                            --primary: hsl(${hue}, 70%, 60%) !important;
                        }
                        /* Recalculate derivative colors for the scoped view */
                        .view-${sec} .btn-primary {
                            background-color: hsl(${hue}, 70%, 60%) !important; 
                        }
                    `;
                }
            }
        });

        // Inject Style Tag
        let styleTag = document.getElementById('fint-theme-styles');
        if (!styleTag) {
            styleTag = document.createElement('style');
            styleTag.id = 'fint-theme-styles';
            document.head.appendChild(styleTag);
        }
        styleTag.innerHTML = css;

        // Force repaint of theme color meta tag if available
        // (Optional polish for mobile status bars)
    }
};
