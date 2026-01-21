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
            <h2 style="margin-bottom: 24px;">Nuevo Movimiento</h2>
            
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
            const submitBtn = form.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;

            submitBtn.disabled = true;
            submitBtn.textContent = 'Guardando...';

            const formData = new FormData(form);

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
            if (file && file.size > 0) {
                newTx.fileBlob = file;
                newTx.fileName = file.name;
            }

            try {
                await dbActions.add('transactions', newTx);
                await dbActions.queueSyncAction({ table: 'transactions', type: 'INSERT', payload: newTx });

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
