const routes = {
    '/': { title: 'Inicio', render: () => import('./views/dashboard.js?v=41').then(m => m.default()) },
    '/login': { title: 'Acceso', render: () => import('./views/login.js?v=41').then(m => m.default()) },
    '/transactions': { title: 'Movimientos', render: () => import('./views/transactions.js?v=41').then(m => m.default()) },
    '/categories': { title: 'Categorías', render: () => import('./views/categories.js?v=41').then(m => m.default()) },
    '/add': { title: 'Añadir', render: () => import('./views/add.js?v=41').then(m => m.default()) },
    '/stats': { title: 'Reportes', render: () => import('./views/stats.js?v=41').then(m => m.default()) },
    '/profile': { title: 'Perfil', render: () => import('./views/profile.js?v=41').then(m => m.default()) },
    '/bank-connect': { title: 'Conectar Banco', render: () => import('./views/bank-connect.js?v=41').then(m => m.default()) },
    '/bank-callback': { title: 'Conectando...', render: () => import('./views/bank-callback.js?v=41').then(m => m.default()) },
    '/reset-password': { title: 'Nueva Contraseña', render: () => import('./views/reset-password.js?v=41').then(m => m.default()) }
};

export const initRouter = async () => {
    const mainHost = document.querySelector('#main-content');

    const handleNavigation = async () => {
        // Handle Supabase's messy hash (e.g. #/route#access_token=...)
        // We only care about the first part of the hash
        let rawHash = location.hash.slice(1) || '/';

        // Remove query params (?) and secondary hashes (#) often added by Auth providers
        let path = rawHash.split(/[?#]/)[0];

        // Ensure path starts with /
        if (!path.startsWith('/')) path = '/' + path;

        // CRITICAL: Intercept Supabase Recovery Flow directly in Router
        // This ensures we render the Reset View immediately, even before Supabase processes the session
        if (location.hash.includes('type=recovery') || location.hash.includes('type=magiclink')) {
            console.log('Router: Detected Recovery Flow, forcing /reset-password');
            path = '/reset-password';
        }


        // Feature Flag Guard
        if ((path === '/bank-connect' || path === '/bank-callback') && !window.FINT_FEATURES?.BANK_INTEGRATION) {
            window.location.hash = '/';
            return;
        }

        // Handle routes that imply parameters? Simple exact match for now

        let route = routes[path];
        if (!route) {
            // Fallback or 404
            route = routes['/'];
        }

        // Update Title
        document.title = `Fint - ${route.title}`;

        // Update Active Nav Link
        const nav = document.querySelector('.bottom-nav');
        if (path === '/login' || path === '/bank-connect' || path === '/bank-callback' || path === '/reset-password') {
            if (nav) nav.style.display = 'none';
        } else {
            if (nav) nav.style.display = 'flex';
        }

        document.querySelectorAll('.nav-item').forEach(el => {
            el.classList.remove('active');
            if (el.getAttribute('href') === `#${path}`) {
                el.classList.add('active');
            }
        });

        // Render View
        mainHost.innerHTML = '<div class="spinner" style="margin: 50px auto;"></div>'; // Loading state
        try {
            const viewModule = await route.render();

            // Support both simple string return and object with lifecycle
            let template = '';
            let init = null;

            if (typeof viewModule === 'string') {
                template = viewModule;
            } else if (typeof viewModule === 'object') {
                template = viewModule.template;
                init = viewModule.init;
            }

            mainHost.innerHTML = template;

            if (init && typeof init === 'function') {
                await init();
            }
        } catch (err) {
            console.error('Render error', err);
            mainHost.innerHTML = '<h3>Error cargando la vista</h3>';
        }
    };

    window.addEventListener('hashchange', handleNavigation);

    // Initial Load
    await handleNavigation();
};
