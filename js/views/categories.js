import { dbActions } from '../db.js';

export default async function () {
    const categories = await dbActions.getAll('categories');

    const renderList = (type) => {
        return categories
            .filter(c => c.type === type)
            .map(c => `
                <div class="card" style="padding: 12px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span style="font-size: 1.5rem;">${c.icon}</span>
                        <span>${c.name}</span>
                    </div>
                    <button class="btn-delete" data-id="${c.id}" style="padding: 4px 8px; background: none; color: var(--text-muted); border: 1px solid var(--border); border-radius: 4px;">
                        🗑️
                    </button>
                </div>
            `).join('');
    };

    const template = `
        <div class="categories-view fade-in">
            <header style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2>Categorías</h2>
                <button class="btn btn-primary" id="toggle-add-form">+ Nueva</button>
            </header>

            <div id="add-cat-form-container" class="card hidden" style="margin-bottom: 20px;">
                <form id="add-cat-form" style="display: flex; flex-direction: column; gap: 12px;">
                    <div>
                        <label style="color: var(--text-muted);">Nombre</label>
                        <input type="text" name="name" required placeholder="Ej: Gimnasio">
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <div style="flex: 1;">
                            <label style="color: var(--text-muted);">Icono (Emoji)</label>
                            <input type="text" name="icon" required placeholder="💪" maxlength="2" style="text-align: center;">
                        </div>
                        <div style="flex: 2;">
                            <label style="color: var(--text-muted);">Tipo</label>
                            <select name="type">
                                <option value="expense">Gasto</option>
                                <option value="income">Ingreso</option>
                            </select>
                        </div>
                    </div>
                    <button type="submit" class="btn btn-primary">Guardar</button>
                </form>
            </div>

            <h3 style="margin: 20px 0 10px; font-size: 0.9rem; text-transform: uppercase; color: var(--text-muted);">Gastos</h3>
            <div id="expense-list">
                ${renderList('expense')}
            </div>

            <h3 style="margin: 20px 0 10px; font-size: 0.9rem; text-transform: uppercase; color: var(--text-muted);">Ingresos</h3>
            <div id="income-list">
                ${renderList('income')}
            </div>
        </div>
    `;

    const init = async () => {
        const toggleBtn = document.getElementById('toggle-add-form');
        const formContainer = document.getElementById('add-cat-form-container');
        const form = document.getElementById('add-cat-form');

        toggleBtn.addEventListener('click', () => {
            formContainer.classList.toggle('hidden');
            if (!formContainer.classList.contains('hidden')) {
                form.name.focus();
            }
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(form);

            const newCat = {
                id: crypto.randomUUID(),
                name: formData.get('name'),
                icon: formData.get('icon'),
                type: formData.get('type')
            };

            await dbActions.add('categories', newCat);

            // Queue Sync Action
            await dbActions.queueSyncAction({
                table: 'categories', type: 'INSERT', payload: newCat
            });

            window.location.reload(); // Simple reload to refresh list
        });

        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (confirm('¿Eliminar categoría?')) {
                    const id = e.target.closest('button').dataset.id;
                    await dbActions.delete('categories', id);

                    await dbActions.queueSyncAction({
                        table: 'categories', type: 'DELETE', payload: { id }
                    });

                    window.location.reload();
                }
            });
        });
    };

    return { template, init };
}
