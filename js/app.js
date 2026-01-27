import { initDB, dbActions } from './db.js';
import { initRouter } from './router.js?v=11';
import { supabase } from './supabase.js';
import { syncManager } from './sync.js';

const app = async () => {
    // NUCLEAR CACHE CLEAR (One time execution)
    if (!localStorage.getItem('fint_v10_cleared')) {
        console.log('Nuclar Cache Clear Triggered');
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (const registration of registrations) {
                await registration.unregister();
            }
        }
        if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map(key => caches.delete(key)));
        }
        localStorage.setItem('fint_v10_cleared', 'true');
        window.location.reload();
        return;
    }

    console.log('Fint App intializing...');

    // Remove initial loader after a slight delay for smooth UX
    const loader = document.getElementById('app-loading');
    const mainApp = document.getElementById('app');

    try {
        await initDB();
        await dbActions.ensureDefaults();
        await initRouter();

        if (supabase) {
            await syncManager.init();
            // Initial Pull
            if (typeof syncManager.pullFromCloud === 'function') {
                syncManager.pullFromCloud();
            } else {
                console.warn('SyncManager: pullFromCloud not available yet (cached version?)');
            }

            // Start Realtime
            if (typeof syncManager.initRealtimeSubscription === 'function') {
                syncManager.initRealtimeSubscription();
            }

            // Listen for Auth Changes (Redirects, SignOuts)
            supabase.auth.onAuthStateChange((event, session) => {
                console.log('Auth Event:', event);

                if (event === 'SIGNED_IN') {
                    // Redirect to dashboard if on login page
                    if (location.hash === '#/login' || location.hash === '') {
                        window.location.hash = '/';
                    }
                    // Trigger Pull on new session
                    if (typeof syncManager.pullFromCloud === 'function') {
                        syncManager.pullFromCloud();
                    }
                } else if (event === 'SIGNED_OUT') {
                    // Only redirect to login if NOT in guest mode
                    const isGuest = localStorage.getItem('fint_guest_mode') === 'true';
                    if (!isGuest) {
                        window.location.hash = '/login';
                    }
                }
            });

            // Check Auth (Initial)
            const { data: { session } } = await supabase.auth.getSession();
            const isGuest = localStorage.getItem('fint_guest_mode') === 'true';

            if (!session && !isGuest && location.hash !== '#/login') {
                window.location.hash = '/login';
            } else if ((session || isGuest) && location.hash === '#/login') {
                // If we have session or guest mode but are on login, go home
                window.location.hash = '/';
            }
        }

        // Apply Theme (if logged in)
        if (supabase) {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                // Fetch basic theme data specifically if not already loaded
                const { data: profile } = await supabase.from('profiles').select('theme_hue, theme_settings').eq('id', session.user.id).single();

                if (profile) {
                    const { themeManager } = await import('./theme.js');

                    let settings = profile.theme_settings || {};
                    // Migration / Backwards Compat:
                    if (!settings.global) settings.global = {};
                    if (profile.theme_hue && !settings.global.hue) {
                        settings.global.hue = profile.theme_hue;
                    }

                    themeManager.apply(settings);
                }
            }
        }

        // Apply Local Theme Preference immediately (prevents flash of wrong theme)
        const localMode = localStorage.getItem('fint_theme_mode');
        if (localMode) {
            document.documentElement.setAttribute('data-theme', localMode);
        }


        // Show App
        loader.classList.add('hidden');
        mainApp.classList.remove('hidden');
        mainApp.classList.add('fade-in');

        // Check for Auth Errors in URL (e.g. Google Login failures)
        const params = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.substring(1)); // Handle hash params too

        const error = params.get('error') || hashParams.get('error');
        const errorDesc = params.get('error_description') || hashParams.get('error_description');

        if (error) {
            console.error('Auth Callback Error:', error, errorDesc);
            // Wait a bit for UI to settle
            setTimeout(() => {
                alert(`Error de autenticación: ${error}\n\n${errorDesc || 'Revisa la configuración de Supabase'}`);
                // Clean URL
                window.history.replaceState(null, '', window.location.pathname);
                window.location.hash = '/login';
            }, 500);
        }

    } catch (error) {
        console.error('Initialization failed:', error);
        loader.innerHTML = '<p style="color:white; text-align:center;">Error al iniciar la aplicación.<br>Recarga la página.</p>';
    }
};

document.addEventListener('DOMContentLoaded', app);
