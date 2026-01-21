import { dbActions } from '../db.js';

export default async function () {
    // Basic implementation: Load all for now, filter in memory
    const allTransactions = await dbActions.getAll('transactions');

    // Sort desc date
    allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Grouping helper
    const groupByDate = (txs) => {
        const groups = {};
        txs.forEach(tx => {
            const dateStr = new Date(tx.date).toLocaleDateString();
            if (!groups[dateStr]) groups[dateStr] = [];
            groups[dateStr].push(tx);
        });
        return groups;
    };

    const init = async () => {
        const filterSelect = document.getElementById('month-filter');
        const container = document.getElementById('tx-container');

        // Delete Handler
        window.deleteTransaction = async (id) => {
            if (!confirm('¿Estás seguro de eliminar este movimiento?')) return;

            try {
                // 1. Delete Local
                await dbActions.delete('transactions', id);
                // 2. Queue Sync
                await dbActions.queueSyncAction({ table: 'transactions', type: 'DELETE', payload: { id } });

                // 3. Trigger Auto-Sync (importing dynamically to avoid circular deps if any, or just standard ES import at top)
                const { syncManager } = await import('../sync.js?v=13'); // Ensure fresh
                if (navigator.onLine) {
                    syncManager.syncPending();
                }

                // Refresh UI
                alert('Movimiento eliminado');
                window.location.reload();
            } catch (err) {
                console.error(err);
                alert('Error al eliminar');
            }
        };

        filterSelect.addEventListener('change', (e) => {
            const val = e.target.value;
            let filtered = allTransactions;

            if (val === 'current') {
                const now = new Date();
                filtered = allTransactions.filter(tx => {
                    const d = new Date(tx.date);
                    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                });
            }

            container.innerHTML = renderList(filtered);
        });
    };

    const renderList = (txs) => {
        if (txs.length === 0) return '<div class="card"><p style="text-align:center; color: var(--text-muted);">No hay movimientos.</p></div>';

        const groups = groupByDate(txs);
        return Object.keys(groups).map(date => `
            <div style="margin-bottom: 20px;">
                <h3 style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 10px; padding-left: 8px; border-left: 3px solid var(--primary);">${date}</h3>
                ${groups[date].map(tx => `
                    <div class="card" style="padding: 16px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <div style="width: 36px; height: 36px; background: var(--bg-body); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                                ${tx.type === 'income' ? '💰' : '🛒'}
                            </div>
                            <div>
                                <p style="margin: 0; font-weight: 500;">${tx.description}</p>
                                <small style="color: var(--text-muted); font-size: 0.8rem;">${tx.category}</small>
                            </div>
                        </div>
                        <div style="display:flex; align-items:center; gap: 10px;">
                            <span style="font-weight: 600; color: ${tx.type === 'income' ? 'var(--secondary)' : 'var(--text-main)'};">
                                ${tx.type === 'income' ? '+' : '-'} ${parseFloat(tx.amount).toFixed(2)} €
                            </span>
                            <button onclick="deleteTransaction('${tx.id}')" style="background:none; border:none; cursor:pointer; color: var(--danger); font-size: 1.1rem; padding: 4px;">
                                🗑️
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `).join('');
    };

    const template = `
        <div class="transactions-view fade-in">
            <header style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
                <h2>Movimientos</h2>
                <select id="month-filter" style="width: auto; padding: 8px;">
                    <option value="all">Todo</option>
                    <option value="current">Este mes</option>
                </select>
            </header>

            <div id="tx-container">
                ${renderList(allTransactions)}
            </div>
        </div>
    `;

    return { template, init };
}
