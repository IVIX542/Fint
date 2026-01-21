import { dbActions } from '../db.js';

export default async function () {
    const transactions = await dbActions.getAll('transactions');

    // Calculate Balance
    const balance = transactions.reduce((acc, tx) => {
        return tx.type === 'income' ? acc + parseFloat(tx.amount) : acc - parseFloat(tx.amount);
    }, 0);

    const recentTx = transactions
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5);

    const formatCurrency = (num) => {
        return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(num);
    };

    const template = `
        <div class="dashboard fade-in">
            <header style="margin-bottom: 24px;">
                <h2 style="color: var(--text-muted); font-size: 0.9rem; text-transform: uppercase; letter-spacing: 1px;">Saldo Total</h2>
                <h1 style="font-size: 2.5rem; color: ${balance >= 0 ? 'var(--secondary)' : 'var(--danger)'};">
                    ${formatCurrency(balance)}
                </h1>
            </header>

            <section>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <h3>Recientes</h3>
                    <a href="#/transactions" style="color: var(--primary); text-decoration: none; font-size: 0.9rem;">Ver todos</a>
                </div>
                
                <div class="tx-list">
                    ${recentTx.length === 0 ? '<p style="color: var(--text-muted); text-align: center; padding: 20px;">No hay movimientos aún.</p>' : ''}
                    ${recentTx.map(tx => `
                        <div class="card" style="padding: 16px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
                            <div style="display: flex; align-items: center; gap: 12px;">
                                <div style="width: 40px; height: 40px; background: ${tx.type === 'income' ? 'rgba(var(--secondary-hue), 0.1)' : 'rgba(255, 99, 132, 0.1)'}; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">
                                    ${tx.categoryIcon || (tx.type === 'income' ? '💰' : '💸')}
                                </div>
                                <div>
                                    <h4 style="margin: 0; font-weight: 500;">${tx.description}</h4>
                                    <small style="color: var(--text-muted);">${new Date(tx.date).toLocaleDateString()}</small>
                                </div>
                            </div>
                            <span style="font-weight: 600; color: ${tx.type === 'income' ? 'var(--secondary)' : 'var(--text-main)'};">
                                ${tx.type === 'income' ? '+' : '-'} ${formatCurrency(tx.amount)}
                            </span>
                        </div>
                    `).join('')}
                </div>
            </section>
        </div>
    `;

    return {
        template,
        init: async () => {
            console.log('Dashboard initialized');

            // Auto-refresh on Realtime update
            window.addEventListener('fint-data-changed', () => {
                console.log('Data changed, refreshing dashboard...');
                if (location.hash === '' || location.hash === '#/') {
                    window.location.reload();
                }
            }, { once: true }); // Prevent multiple listeners stacking if not careful, though simple reload cleans it up.
        }
    };
}
