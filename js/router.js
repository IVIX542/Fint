const routes = {
    '/': { title: 'Inicio', render: () => import('./views/dashboard.js?v=11').then(m => m.default()) },
    '/login': { title: 'Acceso', render: () => import('./views/login.js?v=11').then(m => m.default()) },
    '/transactions': { title: 'Movimientos', render: () => import('./views/transactions.js?v=11').then(m => m.default()) },
    '/categories': { title: 'Categorías', render: () => import('./views/categories.js?v=11').then(m => m.default()) },
    '/add': { title: 'Añadir', render: () => import('./views/add.js?v=11').then(m => m.default()) },
    '/stats': { title: 'Reportes', render: () => import('./views/stats.js?v=11').then(m => m.default()) },
    '/profile': { title: 'Perfil', render: () => import('./views/profile.js?v=11').then(m => m.default()) }
};

export const initRouter = async () => {
    const mainHost = document.querySelector('#main-content');

    const handleNavigation = async () => {
        let path = location.hash.slice(1) || '/';
        // Handle routes that imply parameters? Simple exact match for now

        let route = routes[path];
        if (!route) {
            // Fallback or 404
            route = routes['/'];
        }

        // Update Title
        document.title = `Fint - ${route.title}`;

        // Update Active Nav Link
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
