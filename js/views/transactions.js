import { dbActions } from '../db.js';

export default async function () {
    // Basic implementation: Load all for now, filter in memory
    let allTransactions = await dbActions.getAll('transactions');

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
        const typeSelect = document.getElementById('type-filter');
        const sortSelect = document.getElementById('sort-filter');
        const searchInput = document.getElementById('search-input');
        const container = document.getElementById('tx-container');
        const toggleFiltersBtn = document.getElementById('toggle-filters');
        const filterPanel = document.getElementById('filter-panel');

        toggleFiltersBtn.addEventListener('click', () => {
            const isHidden = filterPanel.style.display === 'none';
            filterPanel.style.display = isHidden ? 'block' : 'none';
            toggleFiltersBtn.classList.toggle('active', isHidden);
            toggleFiltersBtn.style.borderColor = isHidden ? 'var(--primary)' : 'var(--border)';
        });

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

        const applyFilters = () => {
            const dateVal = filterSelect.value;
            const typeVal = typeSelect.value;
            const sortVal = sortSelect.value;
            const searchVal = searchInput.value.toLowerCase().trim();
            const now = new Date();

            let filtered = allTransactions.filter(tx => {
                // 1. Date Filter
                let dateMatch = true;
                if (dateVal === 'current') {
                    const d = new Date(tx.date);
                    dateMatch = d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                }

                // 2. Type Filter
                let typeMatch = true;
                if (typeVal !== 'all') {
                    typeMatch = tx.type === typeVal;
                }

                // 3. Search Filter (Description OR Category)
                let searchMatch = true;
                if (searchVal) {
                    const desc = (tx.description || '').toLowerCase();
                    const cat = (tx.category || '').toLowerCase();
                    searchMatch = desc.includes(searchVal) || cat.includes(searchVal);
                }

                return dateMatch && typeMatch && searchMatch;
            });

            // 4. Sorting
            filtered.sort((a, b) => {
                const dateA = new Date(a.date);
                const dateB = new Date(b.date);
                const amountA = parseFloat(a.amount);
                const amountB = parseFloat(b.amount);

                switch (sortVal) {
                    case 'date-desc': return dateB - dateA;
                    case 'date-asc': return dateA - dateB;
                    case 'amount-desc': return amountB - amountA;
                    case 'amount-asc': return amountA - amountB;
                    default: return dateB - dateA;
                }
            });

            container.innerHTML = renderList(filtered);
        };

        filterSelect.addEventListener('change', applyFilters);
        typeSelect.addEventListener('change', applyFilters);
        sortSelect.addEventListener('change', applyFilters);
        searchInput.addEventListener('input', applyFilters);

        // REACTIVITY: Re-fetch and re-render on sync with DEBOUNCE
        let debounceTimer;
        const handleDataChange = async () => {
            // ZOMBIE CHECK
            if (!document.body.contains(container)) {
                window.removeEventListener('fint-data-changed', handleDataChange);
                return;
            }

            // Debounce
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(async () => {
                console.log('View updating data (Debounced)...');
                const freshTxs = await dbActions.getAll('transactions');
                freshTxs.sort((a, b) => new Date(b.date) - new Date(a.date));
                allTransactions = freshTxs;
                applyFilters();
            }, 300); // 300ms delay
        };

        window.addEventListener('fint-data-changed', handleDataChange);
    };

    const renderList = (txs) => {
        if (txs.length === 0) return '<div class="card"><p style="text-align:center; color: var(--text-muted);">No hay movimientos encontrados.</p></div>';

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
                            ${tx.receipt_url ? `
                                <a href="${tx.receipt_url}" target="_blank" style="text-decoration:none; font-size: 1.1rem;" title="Ver Adjunto">
                                    📎
                                </a>
                            ` : ''}
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
        <div class="transactions-view fade-in view-transactions">
            <header style="margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h2 style="margin:0;">Movimientos</h2>
                    <button id="toggle-filters" style="background: var(--bg-surface); border: 1px solid var(--border); color: var(--text-main); padding: 8px 12px; border-radius: var(--radius-sm); cursor: pointer; display: flex; align-items: center; gap: 6px;">
                        <span style="font-size: 1.1rem;">🌪️</span> Filtros
                    </button>
                </div>

                <div id="filter-panel" style="display: none; background: var(--bg-surface); padding: 15px; border-radius: var(--radius-sm); border: 1px solid var(--border); margin-bottom: 15px;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;">
                        <div style="display:flex; flex-direction:column; gap:5px;">
                            <label style="font-size:0.8rem; color:var(--text-muted);">Periodo</label>
                            <select id="month-filter" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--bg-body); color: var(--text-main);">
                                <option value="all">Todo</option>
                                <option value="current">Este mes</option>
                            </select>
                        </div>
                        <div style="display:flex; flex-direction:column; gap:5px;">
                             <label style="font-size:0.8rem; color:var(--text-muted);">Tipo</label>
                             <select id="type-filter" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--bg-body); color: var(--text-main);">
                                <option value="all">Todos</option>
                                <option value="income">Ingresos</option>
                                <option value="expense">Gastos</option>
                            </select>
                        </div>
                    </div>

                    <div style="display:flex; flex-direction:column; gap:5px;">
                        <label style="font-size:0.8rem; color:var(--text-muted);">Ordenar por</label>
                        <select id="sort-filter" style="width: 100%; padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--bg-body); color: var(--text-main);">
                            <option value="date-desc">Fecha (Reciente)</option>
                            <option value="date-asc">Fecha (Antigua)</option>
                            <option value="amount-desc">Mayor Precio</option>
                            <option value="amount-asc">Menor Precio</option>
                        </select>
                    </div>
                </div>

                <input type="search" id="search-input" placeholder="Buscar por nombre o categoría..." 
                    style="width: 100%; padding: 10px 15px; border-radius: 20px; border: 1px solid var(--border); background: var(--bg-surface); color: var(--text-main);">
            </header>

            <div id="tx-container">
                ${renderList(allTransactions)}
            </div>
        </div>
    `;

    return { template, init };
}
