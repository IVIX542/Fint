import { supabase } from './supabase.js';
import { dbActions } from './db.js';

export const syncManager = {
    isSyncing: false,

    async init() {
        console.log('SyncManager Initialized');

        // Listen for network status changes
        window.addEventListener('online', () => {
            console.log('App is Online - Triggering Sync');
            this.syncPending();
        });

        // Trigger initial sync if online
        if (navigator.onLine) {
            this.syncPending();
        }
    },

    async syncPending() {
        if (this.isSyncing) return;
        this.isSyncing = true;

        try {
            // Check auth
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                console.log('Skipping sync - User not logged in');
                this.isSyncing = false;
                return;
            }

            const pendingItems = await dbActions.getAll('pending_sync');
            if (pendingItems.length === 0) {
                this.isSyncing = false;
                return;
            }

            console.log(`Syncing ${pendingItems.length} items...`);

            for (const item of pendingItems) {
                // Determine Table
                const table = item.table; // 'transactions'
                let error = null;

                // Process Action
                if (item.type === 'INSERT') {
                    // Remove local fields that don't satisfy schema if needed
                    // Assuming payload matches schema for now, but need to ensure user_id is set
                    const payload = { ...item.payload, user_id: session.user.id };
                    delete payload.is_synced; // Local logic only
                    delete payload.categoryIcon; // Local UI only
                    // If fileBlob exists, handle upload separately (skipped for this basic step)
                    delete payload.fileBlob;
                    delete payload.fileName;

                    const res = await supabase.from(table).insert(payload);
                    error = res.error;
                } else if (item.type === 'UPDATE') {
                    const payload = { ...item.payload };
                    delete payload.is_synced; // Cleanup
                    // For profiles, ID is the lookup, usually handled by upsert or explicit ID check
                    // But Supabase 'update' needs a match.

                    const res = await supabase.from(table).update(payload).eq('id', payload.id);
                    error = res.error;
                } else if (item.type === 'DELETE') {
                    const res = await supabase.from(table).delete().eq('id', item.payload.id);
                    error = res.error;
                }

                // If success, remove from pending
                if (!error) {
                    await dbActions.delete('pending_sync', item.id);
                } else {
                    console.error('Failed to sync item:', item, error);
                }
            }

        } catch (err) {
            console.error('Critical sync error:', err);
        } finally {
            this.isSyncing = false;
        }
    },

    async pullFromCloud() {
        if (!navigator.onLine) return;
        console.log('SyncManager: Pulling from Cloud...');

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            // 1. Fetch Transactions
            const { data: transactions, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('user_id', session.user.id);

            if (transactions && !error) {
                console.log(`Pulled ${transactions.length} transactions from cloud.`);
                for (const tx of transactions) {
                    // Mark as synced locally so we don't try to push it back
                    const localTx = { ...tx, is_synced: 1 };
                    await dbActions.add('transactions', localTx);
                }
            }

            // 2. Fetch Categories
            const { data: categories, error: catError } = await supabase
                .from('categories')
                .select('*')
                .eq('user_id', session.user.id);

            if (categories && !catError) {
                console.log(`Pulled ${categories.length} categories.`);
                for (const cat of categories) {
                    await dbActions.add('categories', cat);
                }
            }

            // 3. Fetch Profile
            const { data: profile, error: profError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .single();

            if (profile && !profError) {
                // Update local storage or session cache if needed.
                // For this app, Profile view fetches live, but we can store in a future 'profiles' store if we wanted offline read.
                // Currently Profile View handles its own fetch, but let's ensure consistency if we add offline profile support later.
                console.log('Profile synced.');
            }

        } catch (err) {
            console.error('Pull error:', err);
        }
    },

    async initRealtimeSubscription() {
        if (!supabase) return;

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        console.log('SyncManager: Subscribing to Realtime changes...');

        supabase.channel('public:db_changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'transactions' },
                async (payload) => {
                    console.log('Realtime Change (Transactions):', payload);
                    if (payload.new && payload.new.user_id === session.user.id) {
                        const item = { ...payload.new, is_synced: 1 };
                        await dbActions.add('transactions', item);
                        // Notify UI (Simple approach: trigger event)
                        window.dispatchEvent(new Event('fint-data-changed'));
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'categories' },
                async (payload) => {
                    console.log('Realtime Change (Categories):', payload);
                    if (payload.new && payload.new.user_id === session.user.id) {
                        await dbActions.add('categories', payload.new);
                        window.dispatchEvent(new Event('fint-data-changed'));
                    }
                }
            )
            .subscribe();
    }
    , async reconcileLocalToCloud() {
        if (!navigator.onLine) return;
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        console.log('Starting Smart Reconciliation...');

        // 1. Get all Local Data
        const localTxs = await dbActions.getAll('transactions');

        // 2. Get all Cloud Data
        const { data: cloudTxs, error } = await supabase
            .from('transactions')
            .select('*')
            .eq('user_id', session.user.id);

        if (error) {
            console.error('Error fetching cloud data:', error);
            return;
        }

        const cloudMap = new Map(cloudTxs.map(tx => [tx.id, tx]));

        let pushed = 0;
        let updated = 0;
        let localDeleted = 0;

        for (const localItem of localTxs) {
            const payload = { ...localItem, user_id: session.user.id };
            // Prepare payload for upload
            const uploadPayload = { ...payload };
            delete uploadPayload.is_synced;
            delete uploadPayload.categoryIcon;
            delete uploadPayload.fileBlob;
            delete uploadPayload.fileName;

            if (!cloudMap.has(localItem.id)) {
                // CASE 1: Local Exists, Cloud Missing

                if (localItem.is_synced === 1) {
                    // It was synced before, so if it's gone from cloud, it implies deletion on another device.
                    // Action: Propagate Delete to Local
                    console.log('Item deleted on remote, removing locally:', localItem.description);
                    await dbActions.delete('transactions', localItem.id);
                    localDeleted++;
                } else {
                    // It has never been synced (New Local Item).
                    // Action: Push to Cloud
                    console.log('New local item, pushing to cloud:', localItem.description);
                    await supabase.from('transactions').insert(uploadPayload);
                    // Mark as synced locally
                    await dbActions.add('transactions', { ...localItem, is_synced: 1 });
                    pushed++;
                }
            } else {
                // CASE 2: Exists in both -> Check for differences (Local modification wins logic)
                const cloudItem = cloudMap.get(localItem.id);

                const needsUpdate =
                    cloudItem.amount !== payload.amount ||
                    cloudItem.description !== payload.description ||
                    cloudItem.date !== payload.date ||
                    cloudItem.category_id !== payload.category_id ||
                    cloudItem.type !== payload.type;

                if (needsUpdate) {
                    console.log('Local update detected, pushing to cloud:', localItem.description);
                    await supabase.from('transactions').update(uploadPayload).eq('id', localItem.id);
                    // Mark as synced locally
                    await dbActions.add('transactions', { ...localItem, is_synced: 1 });
                    updated++;
                }
            }
        }

        // Note: We do NOT delete from cloud just because it's missing locally.
        // That is handled by pullFromCloud (which adds them) or explicit delete actions.

        console.log(`Reconciliation Result: Pushed ${pushed}, Updated ${updated}, LocalPruned ${localDeleted}`);
    }
};
