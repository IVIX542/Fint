import { dbActions } from '../db.js';

export default async function () {
    const categories = await dbActions.getAll('categories');
    console.log('ADD VIEW: Loaded categories:', categories);

    const renderCategoryOptions = (type) => {
        console.log('ADD VIEW: Rendering for type:', type);
        const filtered = categories.filter(c => c.type === type);
        console.log('ADD VIEW: Filtered count:', filtered.length);

        return filtered
            .map(c => `<option value="${c.name}">${c.icon} ${c.name}</option>`)
            .join('');
    };

    const template = `
        <div class="add-tx fade-in">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                <h2 style="margin: 0;">Nuevo Movimiento</h2>
                <button id="cancel-btn" style="background: none; border: none; color: var(--text-muted); font-size: 1.5rem; cursor: pointer; padding: 0 8px;">×</button>
            </div>
            
            <form id="add-form" style="display: flex; flex-direction: column; gap: 20px;">
                
                <!-- Type Toggle -->
                <div style="background: var(--bg-surface); padding: 4px; border-radius: var(--radius-sm); border: 1px solid var(--border); display: flex;">
                    <label style="flex: 1; text-align: center; cursor: pointer;">
                        <input type="radio" name="type" value="expense" checked style="display: none;">
                        <span class="type-btn" id="btn-expense" style="display: block; padding: 10px; border-radius: 6px; background: var(--danger); color: white; transition: all 0.2s;">Gasto</span>
                    </label>
                    <label style="flex: 1; text-align: center; cursor: pointer;">
                        <input type="radio" name="type" value="income" style="display: none;">
                        <span class="type-btn" id="btn-income" style="display: block; padding: 10px; border-radius: 6px; color: var(--text-muted); transition: all 0.2s;">Ingreso</span>
                    </label>
                </div>

                <div>
                    <label style="display: block; margin-bottom: 8px; color: var(--text-muted);">Cantidad (€)</label>
                    <input type="number" name="amount" step="0.01" required placeholder="0.00" style="font-size: 1.5rem; font-weight: 600;">
                </div>

                <div>
                    <label style="display: block; margin-bottom: 8px; color: var(--text-muted);">Descripción</label>
                    <input type="text" name="description" required placeholder="Ej: Supermercado" autocomplete="off">
                </div>

                <div>
                    <label style="display: block; margin-bottom: 8px; color: var(--text-muted);">Categoría</label>
                    <select name="category" id="cat-select" required>
                        <!-- Dynamic Options -->
                    </select>
                </div>

                <div>
                    <label style="display: block; margin-bottom: 8px; color: var(--text-muted);">Adjuntar Archivo</label>
                    <input type="file" name="file" accept="image/*,.pdf">
                </div>

                <div style="margin-top: 10px;">
                    <button type="submit" class="btn btn-primary" style="width: 100%; padding: 16px;">Guardar</button>
                </div>
            </form>
        </div>
    `;

    const init = async () => {
        const form = document.getElementById('add-form');
        const btnExpense = document.getElementById('btn-expense');
        const btnIncome = document.getElementById('btn-income');
        const catSelect = document.getElementById('cat-select');
        const inputs = form.querySelectorAll('input[name="type"]');

        document.getElementById('cancel-btn').addEventListener('click', () => {
            // Go back to previous screen or default to home/transactions
            if (window.history.length > 1) {
                window.history.back();
            } else {
                window.location.hash = '/';
            }
        });

        const updateToggle = (val) => {
            if (val === 'expense') {
                btnExpense.style.background = 'var(--danger)';
                btnExpense.style.color = 'white';
                btnIncome.style.background = 'transparent';
                btnIncome.style.color = 'var(--text-muted)';
            } else {
                btnIncome.style.background = 'var(--secondary)';
                btnIncome.style.color = 'white';
                btnExpense.style.background = 'transparent';
                btnExpense.style.color = 'var(--text-muted)';
            }
            // Update Categories dropdown based on type
            catSelect.innerHTML = renderCategoryOptions(val);
        };

        // Initialize dropdown
        updateToggle('expense');

        inputs.forEach(input => {
            input.addEventListener('change', (e) => updateToggle(e.target.value));
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            // 1. IMPROVED PERMISSION REQUEST (Immediate User Gesture)
            if ('Notification' in window && Notification.permission === 'default') {
                try {
                    await Notification.requestPermission();
                } catch (err) {
                    console.warn('Notification permission error', err);
                }
            }

            const submitBtn = form.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;

            submitBtn.disabled = true;
            submitBtn.textContent = 'Guardando...';

            const formData = new FormData(form);

            // ... (Rest of Form Data processing remains same until DB insert) ...

            // Look up icon
            const catName = formData.get('category');
            const selectedCat = categories.find(c => c.name === catName);

            const newTx = {
                id: crypto.randomUUID(),
                type: formData.get('type'),
                amount: parseFloat(formData.get('amount')),
                description: formData.get('description'),
                category: catName,
                categoryIcon: selectedCat ? selectedCat.icon : '❓',
                date: new Date().toISOString(),
                is_synced: 0 // Local only initially
            };

            const file = formData.get('file');

            // Handle File Upload (Immediate & Secure)
            if (file && file.size > 0) {
                if (!navigator.onLine) {
                    alert('Para adjuntar archivos necesitas conexión a internet.');
                    submitBtn.disabled = false;
                    submitBtn.textContent = originalText;
                    return;
                }

                try {
                    const { supabase } = await import('../supabase.js');
                    const { data: { session } } = await supabase.auth.getSession();
                    if (!session) throw new Error('Debes iniciar sesión para subir archivos.');

                    const userId = session.user.id;
                    const timestamp = Date.now();
                    const fileExt = file.name.split('.').pop();
                    const fileName = `${userId}/${timestamp}_${crypto.randomUUID().substring(0, 8)}.${fileExt}`;

                    const { error: uploadError } = await supabase.storage
                        .from('receipts')
                        .upload(fileName, file, { cacheControl: '3600', upsert: false });

                    if (uploadError) throw uploadError;

                    const { data: { publicUrl } } = supabase.storage
                        .from('receipts')
                        .getPublicUrl(fileName);

                    newTx.receipt_url = publicUrl;

                } catch (err) {
                    console.error('Upload failed:', err);
                    alert('Error al subir el archivo: ' + err.message);
                    submitBtn.disabled = false;
                    submitBtn.textContent = originalText;
                    return;
                }
            }

            try {
                await dbActions.add('transactions', newTx);
                await dbActions.queueSyncAction({ table: 'transactions', type: 'INSERT', payload: newTx });

                // --- LOGIC UPDATED: Funds Available vs Current Balance ---
                try {
                    const allTxs = await dbActions.getAll('transactions');

                    // Definition: "Money you had" = All Income (Lifetime or Month?) considering user request context "start of month".
                    // But if user starts fresh, StartOfMonthBalance is 0.
                    // Interpretation: Total Funds Available This Month = (Balance @ 1st) + (Income This Month)

                    const now = new Date();
                    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

                    // 1. Balance BEFORE this month
                    const prevBalance = allTxs
                        .filter(t => new Date(t.date) < startOfMonth)
                        .reduce((acc, t) => t.type === 'income' ? acc + parseFloat(t.amount) : acc - parseFloat(t.amount), 0);

                    // 2. Income THIS month
                    const monthIncome = allTxs
                        .filter(t => {
                            const d = new Date(t.date);
                            return d >= startOfMonth && t.type === 'income';
                        })
                        .reduce((acc, t) => acc + parseFloat(t.amount), 0);

                    // Total Funds "Available" for this month
                    const totalFunds = prevBalance + monthIncome;

                    // 3. Current Actual Balance
                    const currentBalance = allTxs
                        .reduce((acc, t) => t.type === 'income' ? acc + parseFloat(t.amount) : acc - parseFloat(t.amount), 0);

                    // Alert Threshold: < 25% of Total Funds
                    // Only alert if we actually have some funds to begin with (>0)
                    if (totalFunds > 0 && currentBalance < (totalFunds * 0.25)) {

                        const percentLeft = ((currentBalance / totalFunds) * 100).toFixed(0);

                        if ('Notification' in window && Notification.permission === 'granted') {
                            // Service Worker or Direct
                            if (navigator.serviceWorker && navigator.serviceWorker.ready) {
                                const swReg = await navigator.serviceWorker.ready;
                                swReg.showNotification('Fint - Alerta de Saldo', {
                                    body: `¡Cuidado! Te queda solo el ${percentLeft}% de tus fondos disponibles.`,
                                    icon: 'assets/icons/icon-192x192.png'
                                });
                            } else {
                                new Notification('Fint - Alerta de Saldo', {
                                    body: `¡Cuidado! Te queda solo del ${percentLeft}% de tus fondos disponibles.`,
                                    icon: 'assets/icons/icon-192x192.png'
                                });
                            }
                        }
                    }

                } catch (notifErr) { console.error(notifErr); }
                // ---------------------------------

                // Trigger Auto-Sync
                const { syncManager } = await import('../sync.js?v=13');
                if (navigator.onLine) {
                    syncManager.syncPending();
                }

                // Navigate back
                window.location.hash = '/';
            } catch (err) {
                console.error('Error adding tx:', err);
                alert('Error al guardar: ' + err.message);
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        });
    };

    return { template, init };
}
