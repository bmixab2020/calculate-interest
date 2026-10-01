let hasCalculated = false;
let recalcTimer = null;

const form = document.getElementById('mortgageForm');
const inputIds = ['loanAmount', 'apr', 'term', 'propertyTax', 'homeInsurance', 'pmi'];

form.addEventListener('submit', function (e) {
    e.preventDefault();
    hasCalculated = true;
    calculate();
});

document.getElementById('printBtn').addEventListener('click', function () {
    if (!hasCalculated) {
        calculate();
    }

    const originalTitle = document.title;
    document.title = buildFileName();
    window.print();
    document.title = originalTitle;
});

function buildFileName() {
    const loanAmount = parseFloat(document.getElementById('loanAmount').value) || 0;
    const apr = parseFloat(document.getElementById('apr').value) || 0;
    const termYears = parseInt(document.getElementById('term').value) || 0;
    const now = new Date();

    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const yyyy = now.getFullYear();
    let hh = String(now.getHours()).padStart(2, '0');
    const mi = String(now.getMinutes()).padStart(2, '0');
    const ampm = hh >= 12 ? 'PM' : 'AM';
    hh = String(hh % 12 || 12).padStart(2, '0');

    return `CalulateLoan-${loanAmount}-${apr}-${termYears * 12}-${mm}${dd}${yyyy}-${hh}${mi}${ampm}`;
}

// Recalculate immediately after the first Calculate click
inputIds.forEach(function (id) {
    const el = document.getElementById(id);
    el.addEventListener('input', function () {
        if (!hasCalculated) return;
        clearTimeout(recalcTimer);
        recalcTimer = setTimeout(calculate, 150);
    });
    el.addEventListener('change', function () {
        if (!hasCalculated) return;
        clearTimeout(recalcTimer);
        recalcTimer = setTimeout(calculate, 150);
    });
});

function calculate() {
    const loanAmount = parseFloat(document.getElementById('loanAmount').value) || 0;
    const apr = parseFloat(document.getElementById('apr').value) || 0;
    const termYears = parseInt(document.getElementById('term').value) || 0;
    const propertyTaxMonthly = parseFloat(document.getElementById('propertyTax').value) || 0;
    const homeInsuranceMonthly = parseFloat(document.getElementById('homeInsurance').value) || 0;
    const pmiMonthly = parseFloat(document.getElementById('pmi').value) || 0;

    if (loanAmount <= 0 || termYears <= 0) return;

    const monthlyRate = (apr / 100) / 12;
    const numPayments = termYears * 12;

    // Calculate principal & interest monthly payment (P&I)
    let principalAndInterestMonthly = 0;
    if (monthlyRate === 0) {
        // No interest
        principalAndInterestMonthly = numPayments === 0 ? 0 : loanAmount / numPayments;
    } else {
        principalAndInterestMonthly = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1);
    }

    // Property tax is entered directly as a monthly amount
    const totalMonthlyPayment = principalAndInterestMonthly + propertyTaxMonthly + homeInsuranceMonthly + pmiMonthly;

    // Generate amortization schedule
    let balance = loanAmount;
    let schedule = [];
    for (let month = 1; month <= numPayments; month++) {
        const interestAmount = balance * monthlyRate;
        let principalAmount = principalAndInterestMonthly - interestAmount;
        if (principalAmount > balance) {
            principalAmount = balance;
        }

        balance = balance - principalAmount;

        // Handle final payment rounding
        if (month === numPayments && balance < 0) {
            balance = 0;
        }

        schedule.push({
            month: month,
            balance: balance < 0 ? 0 : balance,
            interestAmount: interestAmount,
            principalAmount: principalAmount,
            propertyTax: propertyTaxMonthly,
            homeInsurance: homeInsuranceMonthly,
            pmi: pmiMonthly,
            totalPayment: principalAndInterestMonthly + propertyTaxMonthly + homeInsuranceMonthly + pmiMonthly
        });
    }

    // Sum of all interest payments across the full term
    const totalInterest = schedule.reduce((sum, row) => sum + row.interestAmount, 0);

    // Display summary
    const summaryDiv = document.getElementById('summary');
    summaryDiv.innerHTML = `
        <h2>Summary</h2>
        <p>Loan Amount: <span class="amount">$${formatCurrency(loanAmount)}</span></p>
        <p>APR: <span class="amount">${apr}%</span></p>
        <p>Term: <span class="amount">${termYears} Years (${numPayments} Payments)</span></p>
        <p>Principal & Interest (P&I): <span class="amount">$${formatCurrency(principalAndInterestMonthly)}</span></p>
        <p>Total Interest Amount: <span class="amount">$${formatCurrency(totalInterest)}</span></p>
        <p>Property Tax: <span class="amount">$${formatCurrency(propertyTaxMonthly)}/month</span></p>
        <p>Home Insurance: <span class="amount">$${formatCurrency(homeInsuranceMonthly)}/month</span></p>
        <p>PMI: <span class="amount">$${formatCurrency(pmiMonthly)}/month</span></p>
        <p><strong>Total Monthly Payment: <span class="amount">$${formatCurrency(totalMonthlyPayment)}</span></strong></p>
    `;
    summaryDiv.classList.remove('hidden');

    // Display schedule
    const scheduleDiv = document.getElementById('schedule');
    let tableHtml = `
        <h2>Amortization Schedule</h2>
        <table>
            <thead>
                <tr>
                    <th>Month</th>
                    <th>Balance</th>
                    <th>Interest</th>
                    <th>Principal</th>
                    <th>Property Tax</th>
                    <th>Home Insurance</th>
                    <th>PMI</th>
                    <th>Total Monthly Payment</th>
                </tr>
            </thead>
            <tbody>
    `;

    schedule.forEach(row => {
        tableHtml += `
            <tr>
                <td>${row.month}</td>
                <td>$${formatCurrency(row.balance)}</td>
                <td>$${formatCurrency(row.interestAmount)}</td>
                <td>$${formatCurrency(row.principalAmount)}</td>
                <td>$${formatCurrency(row.propertyTax)}</td>
                <td>$${formatCurrency(row.homeInsurance)}</td>
                <td>$${formatCurrency(row.pmi)}</td>
                <td>$${formatCurrency(row.totalPayment)}</td>
            </tr>
        `;
    });

    tableHtml += `</tbody></table>`;
    scheduleDiv.innerHTML = tableHtml;
    scheduleDiv.classList.remove('hidden');
}

function formatCurrency(amount) {
    if (isNaN(amount) || amount === null) return '0.00';
    return amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}