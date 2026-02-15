import { dbActions } from '../db.js';
import { bankAPI } from '../bank-api.js';

export default async function () {
    const renderBankAccounts = async () => {
        try {
            const accounts = await dbActions.getAll('bank_accounts');
            const activeAccounts = accounts.filter(acc => acc.is_active);

            if (activeAccounts.length === 0) {
                // Feature Flag Check - Hide banner if feature disabled
                if (!window.FINT_FEATURES?.BANK_INTEGRATION) {
                    return '';
                }

                return `
                    <div class="card" style="
                        padding: 20px;
                        margin-bottom: 24px;
                        background: linear-gradient(135deg, rgba(124, 77, 255, 0.1) 0%, rgba(124, 77, 255, 0.05) 100%);
                        border: 1px solid var(--primary);
                        text-align: center;
                    ">
                        <span class="material-symbols-rounded" style="font-size: 3rem; color: var(--primary); margin-bottom: 12px;">
                            account_balance
                        </span>
                        <h3 style="margin: 0 0 8px 0;">Conecta tu banco</h3>
                        <p style="color: var(--text-muted); margin: 0 0 16px 0; font-size: 0.9rem;">
                            Consulta tu saldo en tiempo real y sincroniza tus transacciones automáticamente
                        </p>
                        <a href="#/bank-connect" class="btn-primary" style="
                            display: inline-block;
                            padding: 12px 24px;
                            background: var(--primary);
                            color: white;
                            text-decoration: none;
                            border-radius: var(--radius-sm);
                            font-weight: 600;
                        ">
                            Conectar cuenta bancaria
                        </a>
                    </div>
                `;
            }

            // Get latest balances
            const balances = await dbActions.getAll('bank_balances');
            const latestBalances = {};
            balances.forEach(bal => {
                if (!latestBalances[bal.account_id] || new Date(bal.synced_at) > new Date(latestBalances[bal.account_id].synced_at)) {
                    latestBalances[bal.account_id] = bal;
                }
            });

            const formatCurrency = (num) => {
                return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(num);
            };

            const formatTimeAgo = (dateStr) => {
                const now = new Date();
                const date = new Date(dateStr);
                const diffMs = now - date;
                const diffMins = Math.floor(diffMs / 60000);

                if (diffMins < 1) return 'Ahora mismo';
                if (diffMins < 60) return `Hace ${diffMins} min`;
                const diffHours = Math.floor(diffMins / 60);
                if (diffHours < 24) return `Hace ${diffHours}h`;
                const diffDays = Math.floor(diffHours / 24);
                return `Hace ${diffDays}d`;
            };

            return `
                <div style="margin-bottom: 24px; display: ${window.FINT_FEATURES?.BANK_INTEGRATION ? 'block' : 'none'};">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <h3 style="margin: 0;">Cuentas Bancarias</h3>
                        <a href="#/bank-connect" style="
                            color: var(--primary);
                            text-decoration: none;
                            font-size: 0.9rem;
                            display: flex;
                            align-items: center;
                            gap: 4px;
                        ">
                            <span class="material-symbols-rounded" style="font-size: 1.2rem;">add</span>
                            Añadir
                        </a>
                    </div>
                    
                    <div style="display: grid; gap: 12px;">
                        ${activeAccounts.map(acc => {
                const balance = latestBalances[acc.id];
                return `
                                <div class="bank-card card" data-account-id="${acc.id}" style="
                                    padding: 16px;
                                    background: linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%);
                                    position: relative;
                                    overflow: hidden;
                                ">
                                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                                        <div style="display: flex; align-items: center; gap: 12px;">
                                            ${acc.bank_logo && !acc.bank_logo.startsWith('data:') && !acc.bank_logo.startsWith('http') ? `
                                                <div style="
                                                    width: 48px;
                                                    height: 48px;
                                                    border-radius: 12px;
                                                    background: ${acc.bank_color || '#7c4dff'};
                                                    display: flex;
                                                    align-items: center;
                                                    justify-content: center;
                                                    font-size: 24px;
                                                ">
                                                    ${acc.bank_logo}
                                                </div>
                                            ` : acc.bank_logo ? `
                                                <img src="${acc.bank_logo}" alt="${acc.bank_name}" style="
                                                    width: 48px;
                                                    height: 48px;
                                                    object-fit: contain;
                                                    border-radius: 8px;
                                                    background: white;
                                                    padding: 4px;
                                                ">
                                            ` : `
                                                <span class="material-symbols-rounded" style="
                                                    font-size: 2.5rem;
                                                    color: var(--primary);
                                                ">account_balance</span>
                                            `}
                                            <div>
                                                <h4 style="margin: 0; font-weight: 600;">${acc.bank_name}</h4>
                                                <small style="color: var(--text-muted);">**** ${acc.account_number}</small>
                                            </div>
                                        </div>
                                        <div style="display: flex; gap: 8px;">
                                            <button class="refresh-balance-btn" data-account-id="${acc.id}" style="
                                                background: rgba(124, 77, 255, 0.1);
                                                border: none;
                                                border-radius: 50%;
                                                width: 36px;
                                                height: 36px;
                                                display: flex;
                                                align-items: center;
                                                justify-content: center;
                                                cursor: pointer;
                                                transition: all 0.2s;
                                            " title="Actualizar saldo">
                                                <span class="material-symbols-rounded" style="font-size: 1.2rem; color: var(--primary);">
                                                    refresh
                                                </span>
                                            </button>
                                            <button class="delete-account-btn" data-account-id="${acc.id}" style="
                                                background: rgba(244, 67, 54, 0.1);
                                                border: none;
                                                border-radius: 50%;
                                                width: 36px;
                                                height: 36px;
                                                display: flex;
                                                align-items: center;
                                                justify-content: center;
                                                cursor: pointer;
                                                transition: all 0.2s;
                                            " title="Eliminar cuenta">
                                                <span class="material-symbols-rounded" style="font-size: 1.2rem; color: var(--danger);">
                                                    delete
                                                </span>
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <div style="margin-top: 8px;">
                                        ${balance ? `
                                            <div style="font-size: 1.8rem; font-weight: 700; color: var(--secondary); margin-bottom: 4px;">
                                                ${formatCurrency(balance.balance)}
                                            </div>
                                            <small style="color: var(--text-muted); font-size: 0.85rem;">
                                                Actualizado ${formatTimeAgo(balance.synced_at)}
                                            </small>
                                        ` : `
                                            <div style="color: var(--text-muted);">
                                                <small>Cargando saldo...</small>
                                            </div>
                                        `}
                                    </div>
                                </div>
                            `;
            }).join('')}
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Error rendering bank accounts:', error);
            return '';
        }
    };

    const renderContent = async (txs) => {
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

        const bankAccountsHTML = await renderBankAccounts();

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

                ${bankAccountsHTML}

                <header style="margin-bottom: 24px;">
                    <h2 style="color: var(--text-muted); font-size: 0.9rem; text-transform: uppercase; letter-spacing: 1px;">Saldo Total (Manual)</h2>
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
    const template = `<div id="dashboard-host">${await renderContent(initialTxs)}</div>`;

    return {
        template,
        init: async () => {
            console.log('Dashboard initialized');
            const host = document.getElementById('dashboard-host');

            // Attach refresh button handlers
            const attachRefreshHandlers = () => {
                const refreshButtons = document.querySelectorAll('.refresh-balance-btn');
                refreshButtons.forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        e.preventDefault();
                        const accountId = btn.dataset.accountId;
                        const icon = btn.querySelector('.material-symbols-rounded');

                        // Animate button
                        icon.style.animation = 'spin 1s linear infinite';
                        btn.disabled = true;

                        try {
                            await bankAPI.updateAccountBalance(accountId);
                            // Refresh will happen via event listener
                        } catch (error) {
                            console.error('Error refreshing balance:', error);
                            alert('Error al actualizar el saldo. Intenta de nuevo.');
                        } finally {
                            icon.style.animation = '';
                            btn.disabled = false;
                        }
                    });

                    // Hover effect
                    btn.addEventListener('mouseenter', () => {
                        btn.style.background = 'rgba(124, 77, 255, 0.2)';
                        btn.style.transform = 'scale(1.1)';
                    });
                    btn.addEventListener('mouseleave', () => {
                        btn.style.background = 'rgba(124, 77, 255, 0.1)';
                        btn.style.transform = 'scale(1)';
                    });
                });

                // Attach delete button handlers
                const deleteButtons = document.querySelectorAll('.delete-account-btn');
                deleteButtons.forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        e.preventDefault();
                        const accountId = btn.dataset.accountId;

                        // Get account info for confirmation
                        const account = await dbActions.get('bank_accounts', accountId);
                        if (!account) return;

                        // Confirm deletion
                        if (!confirm(`¿Estás seguro de que deseas eliminar la cuenta ${account.bank_name} **** ${account.account_number}?`)) {
                            return;
                        }

                        try {
                            await bankAPI.disconnectAccount(accountId);
                            // Refresh will happen via event listener
                        } catch (error) {
                            console.error('Error deleting account:', error);
                            alert('Error al eliminar la cuenta. Intenta de nuevo.');
                        }
                    });

                    // Hover effect
                    btn.addEventListener('mouseenter', () => {
                        btn.style.background = 'rgba(244, 67, 54, 0.2)';
                        btn.style.transform = 'scale(1.1)';
                    });
                    btn.addEventListener('mouseleave', () => {
                        btn.style.background = 'rgba(244, 67, 54, 0.1)';
                        btn.style.transform = 'scale(1)';
                    });
                });
            };

            const handleDataChange = async () => {
                // Zombie check
                if (!document.body.contains(host)) {
                    window.removeEventListener('fint-data-changed', handleDataChange);
                    window.removeEventListener('fint-bank-updated', handleBankUpdate);
                    return;
                }

                console.log('Refreshing dashboard data...');
                const freshTxs = await dbActions.getAll('transactions');
                host.innerHTML = await renderContent(freshTxs);
                attachRefreshHandlers();
            };

            const handleBankUpdate = async () => {
                // Zombie check
                if (!document.body.contains(host)) {
                    window.removeEventListener('fint-data-changed', handleDataChange);
                    window.removeEventListener('fint-bank-updated', handleBankUpdate);
                    return;
                }

                console.log('Refreshing bank accounts...');
                const freshTxs = await dbActions.getAll('transactions');
                host.innerHTML = await renderContent(freshTxs);
                attachRefreshHandlers();
            };

            window.addEventListener('fint-data-changed', handleDataChange);
            window.addEventListener('fint-bank-updated', handleBankUpdate);

            // Initial attach
            attachRefreshHandlers();
        }
    };
}
