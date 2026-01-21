import { dbActions } from '../db.js';

export default async function () {
    const transactions = await dbActions.getAll('transactions');
    const expenses = transactions.filter(t => t.type === 'expense');

    // Aggregate by category
    const totals = {};
    let totalExpense = 0;
    expenses.forEach(tx => {
        const cat = tx.category || 'general';
        const amt = parseFloat(tx.amount);
        if (!totals[cat]) totals[cat] = 0;
        totals[cat] += amt;
        totalExpense += amt;
    });

    // Generate SVG Pie Chart
    // Simple math: slice angle = (value / total) * 360
    // We need to calculate paths (d attribute)

    // Colors for slices
    const colors = ['#f44336', '#9c27b0', '#3f51b5', '#03a9f4', '#009688', '#ffeb3b', '#ff9800'];
    let startAngle = 0;

    const slices = Object.keys(totals).map((cat, i) => {
        const value = totals[cat];
        const percent = value / totalExpense;
        const angle = percent * Math.PI * 2; // Radians

        // Coordinates
        // cx=100, cy=100, r=80
        const x1 = 100 + 80 * Math.cos(startAngle);
        const y1 = 100 + 80 * Math.sin(startAngle);
        const x2 = 100 + 80 * Math.cos(startAngle + angle);
        const y2 = 100 + 80 * Math.sin(startAngle + angle);

        // Large arc flag
        const largeArc = angle > Math.PI ? 1 : 0;

        // Path command
        // M 100 100 L x1 y1 A 80 80 0 largeArc 1 x2 y2 Z
        const d = `M 100 100 L ${x1} ${y1} A 80 80 0 ${largeArc} 1 ${x2} ${y2} Z`;

        startAngle += angle;

        return { cat, value, d, color: colors[i % colors.length] };
    });

    // If only one category, the arc command is tricky (it's a full circle). 
    // Simplified handling: if expenses exist but calculate issues, render circle.
    // If empty expenses, show message.

    const chartSvg = expenses.length > 0 ? `
        <svg viewBox="0 0 200 200" style="width: 100%; max-width: 300px; margin: 0 auto; display: block; transform: rotate(-90deg);">
            ${slices.length === 1
            ? `<circle cx="100" cy="100" r="80" fill="${colors[0]}" />`
            : slices.map(s => `<path d="${s.d}" fill="${s.color}" stroke="var(--bg-card)" stroke-width="2"></path>`).join('')}
        </svg>
    ` : '<p style="text-align: center;">No hay datos para mostrar.</p>';

    const legend = Object.keys(totals).map((cat, i) => `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="width: 12px; height: 12px; border-radius: 50%; background: ${colors[i % colors.length]};"></span>
                <span style="text-transform: capitalize;">${cat}</span>
            </div>
            <span>${totals[cat].toFixed(2)} €</span>
        </div>
    `).join('');

    const template = `
        <div class="stats-view fade-in">
            <h2>Gastos por Categoría</h2>
            <div class="card" style="margin-top: 20px;">
                ${chartSvg}
                <div style="margin-top: 20px;">
                    ${legend}
                </div>
            </div>
        </div>
    `;

    return { template, init: async () => { } };
}
