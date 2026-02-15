import { bankAPI } from '../bank-api.js';
import { dbActions } from '../db.js';

export default async function () {
    const template = `
        <div class="bank-callback-view fade-in" style="
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 60vh;
            padding: 20px;
            text-align: center;
        ">
            <div class="spinner" style="margin-bottom: 20px;"></div>
            <h2>Completando conexión...</h2>
            <p style="color: var(--text-muted);">
                Estamos verificando tu autorización bancaria.
            </p>
        </div>
    `;

    return {
        template,
        init: async () => {
            console.log('Bank Callback view initialized');

            // Get requisition ID from URL
            const params = new URLSearchParams(window.location.hash.split('?')[1]);
            const requisitionId = params.get('ref') || params.get('requisition_id');

            if (!requisitionId) {
                console.error('No requisition ID found in callback');
                showError('Falta información de conexión');
                return;
            }

            try {
                // Complete the bank connection
                const accounts = await bankAPI.completeBankConnection(requisitionId);

                // Show success
                showSuccess(accounts);

                // Redirect to dashboard after 2 seconds
                setTimeout(() => {
                    window.location.hash = '/';
                }, 2000);
            } catch (error) {
                console.error('Error completing bank connection:', error);
                showError(error.message || 'Error al completar la conexión');
            }

            function showSuccess(accounts) {
                const view = document.querySelector('.bank-callback-view');
                view.innerHTML = `
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
                        ${accounts.length} cuenta${accounts.length > 1 ? 's' : ''} conectada${accounts.length > 1 ? 's' : ''} correctamente
                    </p>
                    <div style="
                        display: flex;
                        flex-direction: column;
                        gap: 12px;
                        max-width: 400px;
                        width: 100%;
                    ">
                        ${accounts.map(acc => `
                            <div class="card" style="
                                padding: 16px;
                                display: flex;
                                align-items: center;
                                gap: 12px;
                            ">
                                <span class="material-symbols-rounded" style="color: var(--primary);">
                                    account_balance
                                </span>
                                <div style="flex: 1; text-align: left;">
                                    <strong>${acc.bank_name}</strong>
                                    <div style="font-size: 0.9rem; color: var(--text-muted);">
                                        **** ${acc.account_number}
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    <p style="color: var(--text-muted); margin-top: 20px; font-size: 0.9rem;">
                        Redirigiendo al inicio...
                    </p>
                `;
            }

            function showError(message) {
                const view = document.querySelector('.bank-callback-view');
                view.innerHTML = `
                    <div style="
                        background: rgba(244, 67, 54, 0.1);
                        border: 2px solid var(--danger);
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
                            color: var(--danger);
                        ">error</span>
                    </div>
                    <h2>Error en la conexión</h2>
                    <p style="color: var(--text-muted); margin-bottom: 20px;">
                        ${message}
                    </p>
                    <button onclick="window.location.hash='/bank-connect'" class="btn-primary">
                        Intentar de nuevo
                    </button>
                    <button onclick="window.location.hash='/'" class="btn-secondary" style="margin-top: 12px;">
                        Volver al inicio
                    </button>
                `;
            }
        }
    };
}
