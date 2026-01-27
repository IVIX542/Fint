import { dbActions } from '../db.js';

export default async function () {

    const template = `
        <div class="stats-view fade-in view-stats">
            <header style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
                <h2>Reportes</h2>
                <select id="period-filter" style="padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--bg-surface); color: var(--text-main);">
                    <option value="current">Este Mes</option>
                    <option value="last">Mes Pasado</option>
                    <option value="last3">Últimos 3 Meses</option>
                    <option value="year">Año Actual</option>
                    <option value="all">Todo</option>
                </select>
            </header>

            <!-- Summary Cards -->
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 24px;">
                <div class="card" style="padding: 12px; text-align: center;">
                    <small style="color: var(--text-muted); display: block; margin-bottom: 4px;">Ingresos</small>
                    <span id="stat-income" style="color: var(--secondary); font-weight: 600;">0€</span>
                </div>
                <div class="card" style="padding: 12px; text-align: center;">
                    <small style="color: var(--text-muted); display: block; margin-bottom: 4px;">Gastos</small>
                    <span id="stat-expense" style="color: var(--danger); font-weight: 600;">0€</span>
                </div>
                <div class="card" style="padding: 12px; text-align: center;">
                    <small style="color: var(--text-muted); display: block; margin-bottom: 4px;">Balance</small>
                    <span id="stat-balance" style="font-weight: 600;">0€</span>
                </div>
            </div>

            <!-- Charts -->
            <div class="card" style="margin-bottom: 24px; padding: 20px;">
                <h3 style="margin-bottom: 15px; font-size: 1rem; color: var(--text-muted);">Gastos por Categoría</h3>
                <div style="position: relative; height: 250px;">
                    <canvas id="categoryChart"></canvas>
                </div>
            </div>

            <div class="card" style="margin-bottom: 24px; padding: 20px;">
                <h3 style="margin-bottom: 15px; font-size: 1rem; color: var(--text-muted);">Balance Mensual</h3>
                <div style="position: relative; height: 200px;">
                    <canvas id="balanceChart"></canvas>
                </div>
            </div>
        </div>
    `;

    const init = async () => {
        const allTxs = await dbActions.getAll('transactions');
        let chartInstance = null;
        let barChartInstance = null;

        const filterSelect = document.getElementById('period-filter');

        const updateStats = () => {
            const period = filterSelect.value;
            const now = new Date();

            // Filter Logic
            const filtered = allTxs.filter(tx => {
                const d = new Date(tx.date);
                if (period === 'all') return true;

                if (period === 'current') {
                    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                }
                if (period === 'last') {
                    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                    return d.getMonth() === lastMonth.getMonth() && d.getFullYear() === lastMonth.getFullYear();
                }
                if (period === 'last3') {
                    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
                    return d >= threeMonthsAgo;
                }
                if (period === 'year') {
                    return d.getFullYear() === now.getFullYear();
                }
                return true;
            });

            // Calculate Totals
            let income = 0;
            let expense = 0;
            const catTotals = {};

            filtered.forEach(tx => {
                const amt = parseFloat(tx.amount);
                if (tx.type === 'income') {
                    income += amt;
                } else {
                    expense += amt;
                    const cat = tx.category || 'Otros';
                    catTotals[cat] = (catTotals[cat] || 0) + amt;
                }
            });

            // Update Cards
            document.getElementById('stat-income').textContent = income.toFixed(2) + ' €';
            document.getElementById('stat-expense').textContent = expense.toFixed(2) + ' €';
            const balance = income - expense;
            const balEl = document.getElementById('stat-balance');
            balEl.textContent = (balance > 0 ? '+' : '') + balance.toFixed(2) + ' €';
            balEl.style.color = balance >= 0 ? 'var(--secondary)' : 'var(--danger)';

            // Update Pie Chart (Categories)
            const ctxPie = document.getElementById('categoryChart');
            if (chartInstance) chartInstance.destroy();

            if (Object.keys(catTotals).length > 0) {
                chartInstance = new Chart(ctxPie, {
                    type: 'doughnut',
                    data: {
                        labels: Object.keys(catTotals),
                        datasets: [{
                            data: Object.values(catTotals),
                            backgroundColor: [
                                '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#E7E9ED'
                            ],
                            borderWidth: 0
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'right', labels: { boxWidth: 12, color: '#aaa' } }
                        }
                    }
                });
            } else {
                // Clean canvas or show empty state? Chart.js clears on destroy. 
                // Consider drawing text? For simplicity, leave empty.
            }

            // Update Bar Chart (Comparison - Simplified to Income vs Expense for this period)
            // Or if 'year', show monthly breakdown? Let's keep specific MVP: Income vs Expense bars
            const ctxBar = document.getElementById('balanceChart');
            if (barChartInstance) barChartInstance.destroy();

            barChartInstance = new Chart(ctxBar, {
                type: 'bar',
                data: {
                    labels: ['Ingresos', 'Gastos'],
                    datasets: [{
                        label: 'Total',
                        data: [income, expense],
                        backgroundColor: ['#4bc0c0', '#ff6384'],
                        borderRadius: 4
                    }]
                },
                options: {
                    indexAxis: 'y', // Horizontal bars
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } }, // Hide legend since labels explain it
                    scales: {
                        x: { grid: { color: '#333' }, ticks: { color: '#aaa' } },
                        y: { grid: { display: false }, ticks: { color: '#fff' } }
                    }
                }
            });
        };

        filterSelect.addEventListener('change', updateStats);
        updateStats(); // Initial
    };

    return { template, init };
}
