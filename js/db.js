export const DB_CONFIG = {
    name: 'fint_db',
    version: 2,
    stores: {
        transactions: 'id',
        categories: 'id',
        pending_sync: 'id' // For storing actions that need to be synced to cloud
    }
};

let db = null;

export const initDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_CONFIG.name, DB_CONFIG.version);

        request.onerror = (event) => {
            console.error('IndexedDB error:', event.target.error);
            reject(event.target.error);
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            console.log('IndexedDB opened successfully');
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            // Transactions Store
            if (!db.objectStoreNames.contains('transactions')) {
                const store = db.createObjectStore('transactions', { keyPath: 'id' });
                store.createIndex('date', 'date', { unique: false });
                store.createIndex('is_synced', 'is_synced', { unique: false });
            }

            // Categories Store
            if (!db.objectStoreNames.contains('categories')) {
                const store = db.createObjectStore('categories', { keyPath: 'id' });
                // Default Categories
                const defaults = [
                    { id: 'cat_food', name: 'Comida', icon: '🍔', type: 'expense' },
                    { id: 'cat_transport', name: 'Transporte', icon: '🚌', type: 'expense' },
                    { id: 'cat_house', name: 'Vivienda', icon: '🏠', type: 'expense' },
                    { id: 'cat_entertainment', name: 'Entretenimiento', icon: '🎬', type: 'expense' },
                    { id: 'cat_health', name: 'Salud', icon: '💊', type: 'expense' },
                    { id: 'cat_salary', name: 'Salario', icon: '💰', type: 'income' },
                    { id: 'cat_freelance', name: 'Freelance', icon: '💻', type: 'income' }
                ];
                defaults.forEach(cat => store.add(cat));
            }

            // Pending Sync Store (Queue for offline actions)
            if (!db.objectStoreNames.contains('pending_sync')) {
                db.createObjectStore('pending_sync', { keyPath: 'id', autoIncrement: true });
            }
        };
    });
};

export const dbActions = {
    async getAll(storeName) {
        return new Promise((resolve, reject) => {
            if (!db) return reject('DB not initialized');
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async get(storeName, id) {
        return new Promise((resolve, reject) => {
            if (!db) return reject('DB not initialized');
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async add(storeName, item) {
        return new Promise((resolve, reject) => {
            if (!db) return reject('DB not initialized');
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.put(item); // put handles both add and update (upsert)
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async delete(storeName, id) {
        return new Promise((resolve, reject) => {
            if (!db) return reject('DB not initialized');
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.delete(id);
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    },

    // Specific method to queue offline actions
    async queueSyncAction(action) {
        // action: { table: 'transactions', type: 'INSERT/UPDATE/DELETE', payload: ... }
        return this.add('pending_sync', {
            ...action,
            timestamp: Date.now()
        });
    },

    async ensureDefaults() {
        try {
            const cats = await this.getAll('categories');
            if (cats.length === 0) {
                const defaults = [
                    { id: 'cat_food', name: 'Comida', icon: '🍔', type: 'expense' },
                    { id: 'cat_transport', name: 'Transporte', icon: '🚌', type: 'expense' },
                    { id: 'cat_house', name: 'Vivienda', icon: '🏠', type: 'expense' },
                    { id: 'cat_entertainment', name: 'Entretenimiento', icon: '🎬', type: 'expense' },
                    { id: 'cat_health', name: 'Salud', icon: '💊', type: 'expense' },
                    { id: 'cat_salary', name: 'Salario', icon: '💰', type: 'income' },
                    { id: 'cat_freelance', name: 'Freelance', icon: '💻', type: 'income' }
                ];
                for (const cat of defaults) {
                    await this.add('categories', cat);
                }
                console.log('Defaults seeded');
            }
        } catch (err) {
            console.error('Error seeding defaults:', err);
        }
    },
    async clearUserData() {
        if (!db) return;
        const stores = ['transactions', 'pending_sync', 'categories']; // Keep categories or not? Maybe yes if user specific.
        // Actually, categories are also synced, so we should clear them to avoid mixing user categories.
        // Defaults will interpret "empty" as "need defaults", so we should be careful.
        // If we clear categories, ensuresDefaults will run again on next login/app start?
        // App defaults logic: if (cats.length === 0) -> seed defaults.
        // If a new user logs in, they might have their own categories or none. If none, they get defaults. Correct.

        const tx = db.transaction(stores, 'readwrite');
        const promises = stores.map(storeName => {
            return new Promise((resolve, reject) => {
                const store = tx.objectStore(storeName);
                const req = store.clear();
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
        });

        await Promise.all(promises);
        console.log('User data cleared from local DB');
    }
};
