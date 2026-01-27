import { dbActions } from '../db.js';

export default async function () {
    const renderContent = (txs) => {
        // Calculate Balance
        const balance = txs.reduce((acc, tx) => {
            return tx.type === 'income' ? acc + parseFloat(tx.amount) : acc - parseFloat(tx.amount);
        }, 0);

        const recentTx = txs
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 5);

        const formatCurrency = (num) => {
            return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(num);
        };

        return `
            <div class="dashboard fade-in view-dashboard">
                ${(function () {
                // Calculate MONTHLY flow
                const now = new Date();
                const currentMonthTxs = txs.filter(t => {
                    const d = new Date(t.date);
                    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                });
                const mIncome = currentMonthTxs.filter(t => t.type === 'income').reduce((a, t) => a + parseFloat(t.amount), 0);
                const mExpense = currentMonthTxs.filter(t => t.type === 'expense').reduce((a, t) => a + parseFloat(t.amount), 0);

                if (mExpense > mIncome) {
                    return `
                        <div style="background: rgba(244, 67, 54, 0.1); border: 1px solid var(--danger); color: var(--danger); padding: 12px; border-radius: var(--radius-sm); margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">
                            <span style="font-size: 1.2rem;">⚠️</span>
                            <div>
                                <strong>¡Cuidado!</strong>
                                <div style="font-size: 0.9rem;">Tus gastos superan tus ingresos este mes.</div>
                            </div>
                        </div>`;
                }
                return '';
            })()}

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
    };

    const initialTxs = await dbActions.getAll('transactions');
    const template = `<div id="dashboard-host">${renderContent(initialTxs)}</div>`;

    return {
        template,
        init: async () => {
            console.log('Dashboard initialized');
            const host = document.getElementById('dashboard-host');

            const handleDataChange = async () => {
                // Zombie check
                if (!document.body.contains(host)) {
                    window.removeEventListener('fint-data-changed', handleDataChange);
                    return;
                }

                console.log('Refreshing dashboard data...');
                const freshTxs = await dbActions.getAll('transactions');
                host.innerHTML = renderContent(freshTxs);
            };

            window.addEventListener('fint-data-changed', handleDataChange);
        }
    };
}
