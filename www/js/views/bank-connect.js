import { bankAPI } from '../bank-api.js';
import { dbActions } from '../db.js';
import { supabase } from '../supabase.js';

export default async function () {
    const renderBankList = (banks, loading = false) => {
        if (loading) {
            return `
                <div style="display: flex; justify-content: center; padding: 40px;">
                    <div class="spinner"></div>
                </div>
            `;
        }

        return `
            <div class="bank-list" style="display: grid; gap: 12px; width: 100%; box-sizing: border-box;">
                ${banks.map(bank => `
                    <div class="bank-item card" data-bank-id="${bank.id}" style="
                        padding: 12px;
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        cursor: pointer;
                        transition: all 0.2s ease;
                        box-sizing: border-box;
                    ">
                        <div style="
                            width: 48px;
                            height: 48px;
                            border-radius: 12px;
                            background: ${bank.color || '#7c4dff'};
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            font-size: 24px;
                            flex-shrink: 0;
                        ">
                            ${bank.logo}
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <h4 style="margin: 0; font-weight: 600;">${bank.name}</h4>
                            <small style="color: var(--text-muted);">${bank.bic || 'Banco'}</small>
                        </div>
                        <span class="material-symbols-rounded" style="color: var(--primary); flex-shrink: 0;">
                            chevron_right
                        </span>
                    </div>
                `).join('')}
            </div>
        `;
    };

    const template = `
        <div class="bank-connect-view fade-in" style="padding: 16px; max-width: 100%; margin: 0 auto; overflow-x: hidden; box-sizing: border-box;">
            <header style="margin-bottom: 24px;">
                <a href="#/" style="
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    color: var(--text-main);
                    text-decoration: none;
                    margin-bottom: 16px;
                ">
                    <span class="material-symbols-rounded">arrow_back</span>
                    <span>Volver</span>
                </a>
                <h1 style="margin: 0 0 8px 0;">Conectar Cuenta Bancaria</h1>
                <p style="color: var(--text-muted); margin: 0;">
                    Selecciona tu banco para conectar tu cuenta de forma segura
                </p>
            </header>

            <div class="info-banner" style="
                background: rgba(124, 77, 255, 0.1);
                border: 1px solid var(--primary);
                border-radius: var(--radius-sm);
                padding: 16px;
                margin-bottom: 24px;
                display: flex;
                gap: 12px;
            ">
                <span class="material-symbols-rounded" style="color: var(--primary);">
                    info
                </span>
                <div style="flex: 1; font-size: 0.9rem;">
                    <strong>Conexión Segura</strong>
                    <p style="margin: 4px 0 0 0; color: var(--text-muted);">
                        Tu autenticación se realiza directamente con tu banco.
                        No almacenamos tus credenciales bancarias.
                    </p>
                </div>
            </div>

            <div class="search-box" style="margin-bottom: 20px;">
                <input 
                    type="text" 
                    id="bank-search" 
                    placeholder="Buscar banco..."
                    style="
                        width: 100%;
                        padding: 12px 16px;
                        background: var(--bg-secondary);
                        border: 1px solid var(--border-color);
                        border-radius: var(--radius-sm);
                        color: var(--text-main);
                        font-size: 1rem;
                    "
                >
            </div>

            <div id="banks-container">
                ${renderBankList([], true)}
            </div>

            <!-- Connection Modal -->
            <div id="connection-modal" class="modal" style="display: none;">
                <div class="modal-content card" style="max-width: 400px; text-align: center;">
                    <div class="spinner" style="margin: 20px auto;"></div>
                    <h3>Conectando con tu banco...</h3>
                    <p style="color: var(--text-muted);">
                        Serás redirigido a la página de tu banco para autorizar la conexión.
                    </p>
                </div>
            </div>
        </div>
    `;

    return {
        template,
        init: async () => {
            console.log('Bank Connect view initialized');

            let allBanks = [];
            let filteredBanks = [];

            // Load banks
            try {
                await bankAPI.init();
                allBanks = await bankAPI.getAvailableBanks('ES');
                filteredBanks = allBanks;

                const container = document.getElementById('banks-container');
                container.innerHTML = renderBankList(filteredBanks);

                // Attach click handlers
                attachBankClickHandlers();
            } catch (error) {
                console.error('Error loading banks:', error);
                const container = document.getElementById('banks-container');
                container.innerHTML = `
                    <div class="card" style="padding: 20px; text-align: center;">
                        <span class="material-symbols-rounded" style="font-size: 3rem; color: var(--danger);">
                            error
                        </span>
                        <h3>Error al cargar bancos</h3>
                        <p style="color: var(--text-muted);">
                            ${error.message || 'Intenta de nuevo más tarde'}
                        </p>
                        <button onclick="window.location.reload()" class="btn-primary" style="margin-top: 16px;">
                            Reintentar
                        </button>
                    </div>
                `;
            }

            // Search functionality
            const searchInput = document.getElementById('bank-search');
            searchInput?.addEventListener('input', (e) => {
                const query = e.target.value.toLowerCase();
                filteredBanks = allBanks.filter(bank =>
                    bank.name.toLowerCase().includes(query) ||
                    (bank.bic && bank.bic.toLowerCase().includes(query))
                );

                const container = document.getElementById('banks-container');
                container.innerHTML = renderBankList(filteredBanks);
                attachBankClickHandlers();
            });

            function attachBankClickHandlers() {
                const bankItems = document.querySelectorAll('.bank-item');
                bankItems.forEach(item => {
                    item.addEventListener('click', async () => {
                        const bankId = item.dataset.bankId;
                        await handleBankSelection(bankId);
                    });

                    // Hover effect - only background change, no transform
                    item.addEventListener('mouseenter', () => {
                        item.style.background = 'var(--bg-tertiary)';
                    });
                    item.addEventListener('mouseleave', () => {
                        item.style.background = 'var(--bg-secondary)';
                    });
                });
            }

            async function handleBankSelection(bankId) {
                const modal = document.getElementById('connection-modal');
                modal.style.display = 'flex';

                try {
                    // In mock mode, create account directly
                    if (bankAPI.mockMode) {
                        // Wait a bit for visual feedback
                        await new Promise(resolve => setTimeout(resolve, 1500));

                        // Get selected bank info
                        const selectedBank = filteredBanks.find(b => b.id === bankId);

                        // Create mock account directly
                        const { data: { user } } = await supabase.auth.getUser();
                        const mockAccount = {
                            id: `acc_mock_${Date.now()}`,
                            user_id: user?.id || 'guest',
                            bank_name: selectedBank?.name || 'Banco Demo',
                            bank_logo: selectedBank?.logo || '🏦',
                            bank_color: selectedBank?.color || '#7c4dff',
                            account_number: Math.floor(1000 + Math.random() * 9000).toString(),
                            account_type: 'checking',
                            currency: 'EUR',
                            connection_id: `req_mock_${Date.now()}`,
                            access_token: `token_mock_${Date.now()}`,
                            last_sync: new Date().toISOString(),
                            is_active: true,
                            created_at: new Date().toISOString()
                        };

                        await dbActions.add('bank_accounts', mockAccount);

                        // Create initial balance
                        const balanceRecord = {
                            id: `bal_${mockAccount.id}_${Date.now()}`,
                            account_id: mockAccount.id,
                            balance: parseFloat((Math.random() * 5000 + 1000).toFixed(2)),
                            available_balance: parseFloat((Math.random() * 5000 + 1000).toFixed(2)),
                            currency: 'EUR',
                            synced_at: new Date().toISOString()
                        };
                        await dbActions.add('bank_balances', balanceRecord);

                        // Hide modal
                        modal.style.display = 'none';

                        // Show success message
                        const container = document.querySelector('.bank-connect-view');
                        container.innerHTML = `
                            <div style="
                                display: flex;
                                flex-direction: column;
                                align-items: center;
                                justify-content: center;
                                min-height: 60vh;
                                text-align: center;
                            ">
                                <div style="
                                    background: rgba(76, 175, 80, 0.1);
                                    border: 2px solid #4caf50;
                                    border-radius: 50%;
                                    width: 80px;
                                    height: 80px;
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    margin-bottom: 20px;
                                ">
                                    <span class="material-symbols-rounded" style="
                                        font-size: 3rem;
                                        color: #4caf50;
                                    ">check_circle</span>
                                </div>
                                <h2>¡Conexión exitosa!</h2>
                                <p style="color: var(--text-muted); margin-bottom: 20px;">
                                    Cuenta bancaria conectada correctamente
                                </p>
                                <div class="card" style="
                                    padding: 16px;
                                    display: flex;
                                    align-items: center;
                                    gap: 12px;
                                    max-width: 300px;
                                ">
                                    <div style="
                                        width: 48px;
                                        height: 48px;
                                        border-radius: 12px;
                                        background: ${mockAccount.bank_color};
                                        display: flex;
                                        align-items: center;
                                        justify-content: center;
                                        font-size: 24px;
                                    ">
                                        ${mockAccount.bank_logo}
                                    </div>
                                    <div style="flex: 1; text-align: left;">
                                        <strong>${mockAccount.bank_name}</strong>
                                        <div style="font-size: 0.9rem; color: var(--text-muted);">
                                            **** ${mockAccount.account_number}
                                        </div>
                                    </div>
                                </div>
                                <p style="color: var(--text-muted); margin-top: 20px; font-size: 0.9rem;">
                                    Redirigiendo al inicio...
                                </p>
                            </div>
                        `;

                        // Redirect to dashboard
                        setTimeout(() => {
                            window.location.hash = '/';
                            // Trigger refresh event
                            window.dispatchEvent(new CustomEvent('fint-bank-updated'));
                        }, 2000);
                    } else {
                        // Real mode - use normal flow
                        const requisition = await bankAPI.createBankConnection(bankId);

                        // Redirect to bank authorization
                        if (requisition.link.startsWith('http')) {
                            window.location.href = requisition.link;
                        } else {
                            window.location.hash = requisition.link;
                        }
                    }
                } catch (error) {
                    console.error('Error creating bank connection:', error);
                    modal.style.display = 'none';

                    alert('Error al conectar con el banco. Por favor, intenta de nuevo.');
                }
            }
        }
    };
}
