function parseCurrency(val) {
    if (val === undefined || val === null) return 0;
    const cleaned = String(val).replace(/[^0-9.-]/g, '');
    if (cleaned === '' || cleaned === '-' || cleaned === '.') return 0;
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
}

function formatInputCurrency(val) {
    const num = parseFloat(val);
    if (isNaN(num)) return '';
    return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatInputPercent(val) {
    const num = parseFloat(val);
    if (isNaN(num)) return '';
    // Don't force decimals for integer-like values unless they had decimals
    if (Math.abs(num - Math.round(num)) < 0.0001) {
        return num.toFixed(0) + '%';
    }
    // Trim trailing zeros
    let s = num.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
    return s + '%';
}

function setupCurrencyInput(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('focus', function () {
        const num = parseCurrency(el.value);
        if (num === 0 && el.value.trim() === '') {
            el.value = '';
            return;
        }
        el.value = num === 0 && !el.value.trim().match(/-?[0-9]/) ? '' : String(num);
    });
    el.addEventListener('blur', function () {
        const num = parseCurrency(el.value);
        if (num === 0 && el.value.trim() === '') {
            el.value = '';
            return;
        }
        el.value = formatInputCurrency(num);
    });
}

function setupPercentInput(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('focus', function () {
        const num = parseCurrency(el.value);
        if (isNaN(num) && el.value.trim() === '') {
            el.value = '';
            return;
        }
        el.value = String(num === 0 && !el.value.trim().match(/[0-9]/) ? '' : num);
    });
    el.addEventListener('blur', function () {
        const num = parseCurrency(el.value);
        if (el.value.trim() === '' || isNaN(num)) {
            el.value = '';
            return;
        }
        el.value = formatInputPercent(num);
    });
}

// A browser can serve a cached index.html alongside a freshly fetched
// script.js (or vice versa). If #formError is missing from the markup, create
// it, so a mixed cache can never make Calculate fail silently.
const errorEl = document.getElementById('formError') || (function () {
    const el = document.createElement('div');
    el.id = 'formError';
    el.className = 'form-error';
    el.setAttribute('role', 'alert');
    el.setAttribute('aria-live', 'assertive');
    el.hidden = true;
    form.insertAdjacentElement('afterend', el);
    return el;
})();

function showError(message, reveal) {
    errorEl.textContent = message;
    errorEl.hidden = false;
    if (reveal) revealIntoView(errorEl);
}

function clearError() {
    errorEl.textContent = '';
    errorEl.hidden = true;
}

// On a phone the form is tall enough that results land below the fold, so a
// tap on Calculate can look like it did nothing. Only scroll when the target
// is actually off-screen, and only on an explicit tap.
function revealIntoView(el) {
    const rect = el.getBoundingClientRect();
    const fullyVisible = rect.top >= 0 && rect.bottom <= window.innerHeight;
    if (!fullyVisible) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

let hasCalculated = false;
let recalcTimer = null;

const form = document.getElementById('mortgageForm');
const inputIds = ['loanAmount', 'apr', 'term', 'propertyTax', 'homeInsurance', 'pmi', 'extraPayment'];

['loanAmount', 'propertyTax', 'homeInsurance', 'pmi', 'extraPayment'].forEach(function(id){ setupCurrencyInput(id); });
setupPercentInput('apr');

form.addEventListener('submit', function (e) {
    e.preventDefault();
    hasCalculated = true;

    const loanField = document.getElementById('loanAmount');
    const aprField = document.getElementById('apr');

    if (loanField.value.trim() === '') {
        showError('Enter a loan amount.', true);
        loanField.focus();
        return;
    }

    if (aprField.value.trim() === '') {
        showError('Enter an interest rate (APR).', true);
        aprField.focus();
        return;
    }

    calculate(true);
});

// Required-field feedback is handled here rather than by the native bubble,
// which is easy to miss on a phone and can silently swallow the click.
['loanAmount', 'apr'].forEach(function (id) {
    document.getElementById(id).addEventListener('input', clearError);
});

document.getElementById('term').addEventListener('change', clearError);

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

function calculate(reveal) {
    const loanAmount = parseCurrency(document.getElementById('loanAmount').value) || 0;
    const apr = parseCurrency(document.getElementById('apr').value) || 0;
    const termYears = parseInt(document.getElementById('term').value) || 0;
    const propertyTaxMonthly = parseCurrency(document.getElementById('propertyTax').value) || 0;
    const homeInsuranceMonthly = parseCurrency(document.getElementById('homeInsurance').value) || 0;
    const pmiMonthly = parseCurrency(document.getElementById('pmi').value) || 0;
    const extraPaymentMonthly = Math.max(0, parseCurrency(document.getElementById('extraPayment').value) || 0);

    if (loanAmount <= 0 || termYears <= 0) {
        showError(loanAmount <= 0
            ? 'Enter a loan amount greater than 0.'
            : 'Choose a loan term.', reveal);
        return;
    }

    clearError();

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
    const totalMonthlyPayment = principalAndInterestMonthly + extraPaymentMonthly + propertyTaxMonthly + homeInsuranceMonthly + pmiMonthly;

    // Generate amortization schedule, applying any extra payment to principal
    let balance = loanAmount;
    let schedule = [];
    let month = 0;
    while (balance > 0.005 && month < numPayments) {
        month++;
        const interestAmount = balance * monthlyRate;
        let scheduledPrincipal = principalAndInterestMonthly - interestAmount;
        if (scheduledPrincipal > balance) scheduledPrincipal = balance;
        if (scheduledPrincipal < 0) scheduledPrincipal = 0;
        let principalAmount = scheduledPrincipal + extraPaymentMonthly;
        if (principalAmount > balance) {
            principalAmount = balance;
        }
        if (principalAmount < 0) {
            principalAmount = 0;
        }

        const extraApplied = Math.max(0, Math.min(extraPaymentMonthly, principalAmount - scheduledPrincipal));

        balance = balance - principalAmount;
        if (balance < 0.005) {
            balance = 0;
        }

        schedule.push({
            month: month,
            balance: balance,
            interestAmount: interestAmount,
            principalAmount: principalAmount,
            scheduledPrincipal: scheduledPrincipal,
            extraPayment: extraApplied,
            propertyTax: propertyTaxMonthly,
            homeInsurance: homeInsuranceMonthly,
            pmi: pmiMonthly,
            totalPayment: interestAmount + principalAmount + propertyTaxMonthly + homeInsuranceMonthly + pmiMonthly
        });
    }

    const payoffMonths = schedule.length;

    // Total interest actually paid, versus what it would have been without extras
    const totalInterest = schedule.reduce((sum, row) => sum + row.interestAmount, 0);
    const baseTotalInterest = principalAndInterestMonthly * numPayments - loanAmount;
    const interestSaved = Math.max(0, baseTotalInterest - totalInterest);

    // Display summary
    const summaryDiv = document.getElementById('summary');
    summaryDiv.innerHTML = `
        <h2>Summary</h2>
        <p>Loan Amount: <span class="amount">$${formatCurrency(loanAmount)}</span></p>
        <p>APR: <span class="amount">${apr}%</span></p>
        <p>Term: <span class="amount">${termYears} Years (${numPayments} Payments)</span></p>
        <p>Principal & Interest (P&I): <span class="amount">$${formatCurrency(principalAndInterestMonthly)}</span></p>
        <p>Extra Payment: <span class="amount">$${formatCurrency(extraPaymentMonthly)}/month</span></p>
        <p>Total Interest Amount: <span class="amount">$${formatCurrency(totalInterest)}</span></p>
        <p>Interest Saved: <span class="amount">$${formatCurrency(interestSaved)}</span></p>
        <p>Payoff Time: <span class="amount">${formatPayoffTime(payoffMonths)}</span></p>
        <p>Property Tax: <span class="amount">$${formatCurrency(propertyTaxMonthly)}/month</span></p>
        <p>Home Insurance: <span class="amount">$${formatCurrency(homeInsuranceMonthly)}/month</span></p>
        <p>PMI: <span class="amount">$${formatCurrency(pmiMonthly)}/month</span></p>
        <p><strong>Total Monthly Payment: <span class="amount">$${formatCurrency(totalMonthlyPayment)}</span></strong></p>
    `;
    summaryDiv.classList.remove('hidden');
    if (reveal) revealIntoView(summaryDiv);

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
                    <th>Extra Principal</th>
                    <th>Total Principal</th>
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
                <td>$${formatCurrency(row.scheduledPrincipal)}</td>
                <td>$${formatCurrency(row.extraPayment)}</td>
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

function formatPayoffTime(months) {
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    if (years === 0) return `${months} month${months === 1 ? '' : 's'}`;
    const yearLabel = `${years} year${years === 1 ? '' : 's'}`;
    if (remainingMonths === 0) return `${yearLabel} (${months} months)`;
    return `${yearLabel} ${remainingMonths} month${remainingMonths === 1 ? '' : 's'} (${months} months)`;
}