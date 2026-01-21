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

            // Check Auth
            const { data: { session } } = await supabase.auth.getSession();
            if (!session && location.hash !== '#/login') {
                window.location.hash = '/login';
            }
        }

        // Show App
        loader.classList.add('hidden');
        mainApp.classList.remove('hidden');
        mainApp.classList.add('fade-in');

    } catch (error) {
        console.error('Initialization failed:', error);
        loader.innerHTML = '<p style="color:white; text-align:center;">Error al iniciar la aplicación.<br>Recarga la página.</p>';
    }
};

document.addEventListener('DOMContentLoaded', app);
