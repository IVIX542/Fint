import { supabase } from './supabase.js';
import { dbActions } from './db.js';

/**
 * Bank API Service - Nordigen Integration
 * 
 * This service handles all interactions with the Nordigen (GoCardless) API
 * for Open Banking functionality. It uses Supabase Edge Functions to keep
 * API credentials secure on the backend.
 */

class BankAPIService {
    constructor() {
        this.baseURL = 'https://ob.nordigen.com/api/v2';
        this.initialized = false;
    }

    /**
     * Initialize the bank API service
     * This will be called through Supabase Edge Function to get access token
     */
    async init() {
        if (this.initialized) return;

        try {
            // Call Supabase Edge Function to get Nordigen access token
            // The Edge Function securely stores the Secret ID and Secret Key
            const { data, error } = await supabase.functions.invoke('nordigen-auth', {
                body: { action: 'get_token' }
            });

            if (error) {
                console.error('Failed to initialize Nordigen API:', error);
                throw error;
            }

            this.accessToken = data.access_token;
            this.tokenExpiresAt = Date.now() + (data.access_expires * 1000);
            this.initialized = true;
            console.log('Nordigen API initialized successfully');
        } catch (error) {
            console.error('Bank API initialization error:', error);
            // Fallback to mock mode for development
            this.mockMode = true;
            this.initialized = true;
            console.warn('Running in MOCK mode - no real bank connections');
        }
    }

    /**
     * Ensure we have a valid access token
     */
    async ensureToken() {
        if (!this.initialized) {
            await this.init();
        }

        // Check if token is expired or about to expire (5 min buffer)
        if (this.accessToken && this.tokenExpiresAt > Date.now() + 300000) {
            return;
        }

        // Refresh token
        await this.init();
    }

    /**
     * Get list of available banks for a country
     * @param {string} country - ISO 3166 country code (e.g., 'ES' for Spain)
     */
    async getAvailableBanks(country = 'ES') {
        if (this.mockMode) {
            return this.getMockBanks();
        }

        await this.ensureToken();

        try {
            const { data, error } = await supabase.functions.invoke('nordigen-banks', {
                body: { action: 'list', country }
            });

            if (error) throw error;
            return data.banks;
        } catch (error) {
            console.error('Error fetching banks:', error);
            throw error;
        }
    }

    /**
     * Create a new bank connection (requisition)
     * @param {string} bankId - The institution ID from Nordigen
     * @param {string} redirectUrl - URL to redirect after bank authorization
     */
    async createBankConnection(bankId, redirectUrl = window.location.origin + '/#/bank-callback') {
        if (this.mockMode) {
            return this.createMockConnection(bankId);
        }

        await this.ensureToken();

        try {
            const { data: { user } } = await supabase.auth.getUser();

            const { data, error } = await supabase.functions.invoke('nordigen-connect', {
                body: {
                    action: 'create_requisition',
                    institution_id: bankId,
                    redirect: redirectUrl,
                    user_id: user.id
                }
            });

            if (error) throw error;

            // Store requisition info locally
            const requisition = {
                id: data.id,
                link: data.link,
                status: 'created',
                created_at: new Date().toISOString()
            };

            localStorage.setItem('fint_pending_requisition', JSON.stringify(requisition));

            return requisition;
        } catch (error) {
            console.error('Error creating bank connection:', error);
            throw error;
        }
    }

    /**
     * Complete bank connection after OAuth redirect
     * @param {string} requisitionId - The requisition ID from the callback
     */
    async completeBankConnection(requisitionId) {
        if (this.mockMode) {
            return this.completeMockConnection(requisitionId);
        }

        await this.ensureToken();

        try {
            const { data: { user } } = await supabase.auth.getUser();

            // Get requisition details and accounts
            const { data, error } = await supabase.functions.invoke('nordigen-accounts', {
                body: {
                    action: 'get_accounts',
                    requisition_id: requisitionId
                }
            });

            if (error) throw error;

            // Store accounts in IndexedDB
            const accounts = data.accounts.map(acc => ({
                id: acc.id,
                user_id: user.id,
                bank_name: data.institution_name,
                bank_logo: data.institution_logo,
                account_number: acc.iban ? acc.iban.slice(-4) : '****',
                account_type: acc.account_type || 'checking',
                currency: acc.currency || 'EUR',
                connection_id: requisitionId,
                access_token: acc.id, // Account ID is used for API calls
                last_sync: new Date().toISOString(),
                is_active: true,
                created_at: new Date().toISOString()
            }));

            // Save to local DB
            for (const account of accounts) {
                await dbActions.add('bank_accounts', account);
            }

            // Sync to Supabase
            if (supabase) {
                const { error: syncError } = await supabase
                    .from('bank_accounts')
                    .upsert(accounts);

                if (syncError) {
                    console.error('Error syncing bank accounts to cloud:', syncError);
                }
            }

            // Clear pending requisition
            localStorage.removeItem('fint_pending_requisition');

            // Fetch initial balances
            for (const account of accounts) {
                await this.updateAccountBalance(account.id);
            }

            return accounts;
        } catch (error) {
            console.error('Error completing bank connection:', error);
            throw error;
        }
    }

    /**
     * Get all connected bank accounts
     */
    async getConnectedAccounts() {
        try {
            const accounts = await dbActions.getAll('bank_accounts');
            return accounts.filter(acc => acc.is_active);
        } catch (error) {
            console.error('Error fetching connected accounts:', error);
            return [];
        }
    }

    /**
     * Get account balance
     * @param {string} accountId - The account ID
     */
    async getAccountBalance(accountId) {
        if (this.mockMode) {
            return this.getMockBalance(accountId);
        }

        await this.ensureToken();

        try {
            const { data, error } = await supabase.functions.invoke('nordigen-balance', {
                body: {
                    action: 'get_balance',
                    account_id: accountId
                }
            });

            if (error) throw error;
            return data.balance;
        } catch (error) {
            console.error('Error fetching balance:', error);
            throw error;
        }
    }

    /**
     * Update account balance and store in DB
     * @param {string} accountId - The account ID
     */
    async updateAccountBalance(accountId) {
        try {
            const balance = await this.getAccountBalance(accountId);

            const balanceRecord = {
                id: `bal_${accountId}_${Date.now()}`,
                account_id: accountId,
                balance: parseFloat(balance.amount),
                available_balance: parseFloat(balance.amount),
                currency: balance.currency || 'EUR',
                synced_at: new Date().toISOString()
            };

            // Save to local DB
            await dbActions.add('bank_balances', balanceRecord);

            // Update account last_sync
            const account = await dbActions.get('bank_accounts', accountId);
            if (account) {
                account.last_sync = new Date().toISOString();
                await dbActions.add('bank_accounts', account);
            }

            // Sync to Supabase
            if (supabase) {
                await supabase.from('bank_balances').insert(balanceRecord);
            }

            // Emit event for UI update
            window.dispatchEvent(new CustomEvent('fint-bank-updated', {
                detail: { accountId, balance: balanceRecord }
            }));

            return balanceRecord;
        } catch (error) {
            console.error('Error updating account balance:', error);
            throw error;
        }
    }

    /**
     * Get account transactions
     * @param {string} accountId - The account ID
     * @param {string} dateFrom - Start date (YYYY-MM-DD)
     * @param {string} dateTo - End date (YYYY-MM-DD)
     */
    async getAccountTransactions(accountId, dateFrom, dateTo) {
        if (this.mockMode) {
            return this.getMockTransactions(accountId);
        }

        await this.ensureToken();

        try {
            const { data, error } = await supabase.functions.invoke('nordigen-transactions', {
                body: {
                    action: 'get_transactions',
                    account_id: accountId,
                    date_from: dateFrom,
                    date_to: dateTo
                }
            });

            if (error) throw error;
            return data.transactions;
        } catch (error) {
            console.error('Error fetching transactions:', error);
            throw error;
        }
    }

    /**
     * Disconnect a bank account
     * @param {string} accountId - The account ID to disconnect
     */
    async disconnectAccount(accountId) {
        try {
            const account = await dbActions.get('bank_accounts', accountId);
            if (!account) return;

            // Mark as inactive
            account.is_active = false;
            await dbActions.add('bank_accounts', account);

            // Sync to Supabase
            if (supabase) {
                await supabase
                    .from('bank_accounts')
                    .update({ is_active: false })
                    .eq('id', accountId);
            }

            // Emit event
            window.dispatchEvent(new CustomEvent('fint-bank-updated'));

            return true;
        } catch (error) {
            console.error('Error disconnecting account:', error);
            throw error;
        }
    }

    // ===== MOCK MODE METHODS (for development/testing) =====

    getMockBanks() {
        return [
            {
                id: 'BBVA_BBVAESMM',
                name: 'BBVA',
                bic: 'BBVAESMM',
                logo: '🏦',
                color: '#004481',
                countries: ['ES']
            },
            {
                id: 'SANTANDER_BSCHESMM',
                name: 'Banco Santander',
                bic: 'BSCHESMM',
                logo: '🏛️',
                color: '#EC0000',
                countries: ['ES']
            },
            {
                id: 'CAIXABANK_CAIXESBB',
                name: 'CaixaBank',
                bic: 'CAIXESBB',
                logo: '💳',
                color: '#003B7A',
                countries: ['ES']
            },
            {
                id: 'ING_INGDESMMXXX',
                name: 'ING',
                bic: 'INGDESMM',
                logo: '🦁',
                color: '#FF6200',
                countries: ['ES']
            }
        ];
    }

    createMockConnection(bankId) {
        const mockRequisition = {
            id: `req_mock_${Date.now()}`,
            link: `/bank-callback?ref=req_mock_${Date.now()}`,
            status: 'created',
            created_at: new Date().toISOString()
        };

        localStorage.setItem('fint_pending_requisition', JSON.stringify(mockRequisition));

        // Auto-complete in mock mode - use setTimeout to allow UI to update
        setTimeout(() => {
            window.location.hash = mockRequisition.link;
        }, 1500);

        return mockRequisition;
    }

    async completeMockConnection(requisitionId) {
        const { data: { user } } = await supabase.auth.getUser();

        // Get bank info from localStorage if available
        const pendingReq = localStorage.getItem('fint_pending_requisition');
        let bankName = 'Banco Demo';
        let bankLogo = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%237c4dff" width="100" height="100"/><text x="50" y="65" font-family="Arial" font-size="30" font-weight="bold" fill="white" text-anchor="middle">DEMO</text></svg>';

        const mockAccount = {
            id: `acc_mock_${Date.now()}`,
            user_id: user?.id || 'guest',
            bank_name: bankName,
            bank_logo: bankLogo,
            account_number: '1234',
            account_type: 'checking',
            currency: 'EUR',
            connection_id: requisitionId,
            access_token: `token_mock_${Date.now()}`,
            last_sync: new Date().toISOString(),
            is_active: true,
            created_at: new Date().toISOString()
        };

        await dbActions.add('bank_accounts', mockAccount);
        localStorage.removeItem('fint_pending_requisition');

        // Create mock balance
        await this.updateAccountBalance(mockAccount.id);

        return [mockAccount];
    }

    getMockBalance(accountId) {
        return {
            amount: (Math.random() * 5000 + 1000).toFixed(2),
            currency: 'EUR'
        };
    }

    getMockTransactions(accountId) {
        const transactions = [];
        const categories = ['Supermercado', 'Restaurante', 'Gasolina', 'Farmacia', 'Salario'];

        for (let i = 0; i < 10; i++) {
            const isIncome = Math.random() > 0.7;
            transactions.push({
                id: `tx_mock_${Date.now()}_${i}`,
                date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
                amount: isIncome ? Math.random() * 2000 + 500 : -(Math.random() * 100 + 10),
                currency: 'EUR',
                description: categories[Math.floor(Math.random() * categories.length)],
                type: isIncome ? 'income' : 'expense'
            });
        }

        return transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    }
}

// Export singleton instance
export const bankAPI = new BankAPIService();
