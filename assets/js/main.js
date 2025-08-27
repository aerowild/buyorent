document.addEventListener('DOMContentLoaded', () => {
    // All script logic is now safely inside this listener

    const form = document.getElementById('calc-form');
    const chartCanvas = document.createElement('canvas');
    chartCanvas.id = 'comparisonChart';
    let myChart;

    const formatCurrency = (num) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num);

    function getFormSettings() {
        const settings = {};
        form.querySelectorAll('input[type="number"]').forEach(input => {
            settings[input.id] = input.value;
        });
        return settings;
    }

    function calculateScenario(settings) {
        const homePrice = parseFloat(settings['home-price']);
        const downPaymentPercent = parseFloat(settings['down-payment']) / 100;
        const interestRate = parseFloat(settings['interest-rate']) / 100;
        const loanTerm = parseInt(settings['loan-term']);
        let pmi = parseFloat(settings['pmi']);
        const buyerHOA = parseFloat(settings['buyer-hoa']);
        const buyerUtilities = parseFloat(settings['buyer-utilities']);
        const monthlyRent = parseFloat(settings['monthly-rent']);
        const renterHOA = parseFloat(settings['renter-hoa']);
        const renterUtilities = parseFloat(settings['renter-utilities']);
        const rentersInsurance = parseFloat(settings['renter-insurance']);
        const propertyTaxRate = parseFloat(settings['property-tax']) / 100;
        const homeInsurance = parseFloat(settings['home-insurance']);
        const maintenanceRate = parseFloat(settings['maintenance']) / 100;
        const appreciationRate = parseFloat(settings['home-appreciation']) / 100;
        const rentIncreaseRate = parseFloat(settings['rent-increase']) / 100;
        const investmentReturnRate = parseFloat(settings['investment-return']) / 100;
        const taxRate = parseFloat(settings['tax-rate']) / 100;
        const duration = parseInt(settings['duration']);
        const buyClosingCostRate = parseFloat(settings['buy-closing-cost']) / 100;
        const sellClosingCostRate = parseFloat(settings['sell-closing-cost']) / 100;
        const monthlyIncome = parseFloat(settings['monthly-income']);
        const otherMonthlyExpensesBuy = parseFloat(settings['other-monthly-expenses-buy']);
        const otherMonthlyExpensesRent = parseFloat(settings['other-monthly-expenses-rent']);

        const numberOfPayments = loanTerm * 12;
        if (downPaymentPercent >= 0.2) pmi = 0;
        const downPaymentAmount = homePrice * downPaymentPercent;
        const loanAmount = homePrice - downPaymentAmount;
        const monthlyInterestRate = interestRate / 12;
        const mortgagePayment = loanAmount > 0 ? (loanAmount * (monthlyInterestRate * Math.pow(1 + monthlyInterestRate, numberOfPayments))) / (Math.pow(1 + monthlyInterestRate, numberOfPayments) - 1) : 0;
        const buyingClosingCosts = homePrice * buyClosingCostRate;
        const initialCashOutlayForBuying = downPaymentAmount + buyingClosingCosts;
        
        let rentData = [], buyData = [], yearlyRawData = [];
        let currentRent = monthlyRent, currentHomeValue = homePrice, remainingLoan = loanAmount;
        let renterPortfolio = initialCashOutlayForBuying;
        let buyerPortfolio = 0; 

        for (let year = 1; year <= duration; year++) {
            let interestPaidYearly = 0;
            if (loanAmount > 0) {
                for(let m = 0; m < 12; m++) {
                    let interestForMonth = remainingLoan * monthlyInterestRate;
                    interestPaidYearly += interestForMonth;
                    remainingLoan -= (mortgagePayment - interestForMonth);
                }
            }
            if (remainingLoan / currentHomeValue < 0.8) pmi = 0;

            const annualPropertyTax = currentHomeValue * propertyTaxRate;
            const buyerAnnualCashOutflow = (mortgagePayment * 12) + annualPropertyTax + homeInsurance + (homePrice * maintenanceRate) + ((buyerHOA + buyerUtilities + pmi) * 12);
            const buyerAnnualSavings = (monthlyIncome * 12) - buyerAnnualCashOutflow - (otherMonthlyExpensesBuy * 12);
            buyerPortfolio = (buyerPortfolio + (buyerAnnualSavings > 0 ? buyerAnnualSavings : 0)) * (1 + investmentReturnRate);
            
            currentHomeValue *= (1 + appreciationRate);
            const homeEquity = currentHomeValue - remainingLoan - (currentHomeValue * sellClosingCostRate);
            const buyerNetWorth = homeEquity + buyerPortfolio;
            buyData.push(buyerNetWorth);
            
            const renterAnnualCashOutflow = (currentRent * 12) + ((renterHOA + renterUtilities) * 12) + rentersInsurance;
            const renterAnnualSavings = (monthlyIncome * 12) - renterAnnualCashOutflow - (otherMonthlyExpensesRent * 12);
            renterPortfolio = (renterPortfolio + (renterAnnualSavings > 0 ? renterAnnualSavings : 0)) * (1 + investmentReturnRate);
            
            const renterNetWorth = renterPortfolio;
            rentData.push(renterNetWorth);
            currentRent *= (1 + rentIncreaseRate);
            yearlyRawData.push({ year, renterNetWorth, buyerNetWorth, renterPortfolio, buyerPortfolio, homeEquity });
        }

        const finalData = yearlyRawData[duration - 1] || {};
        return {
            finalRenterNetWorth: finalData.renterNetWorth || 0,
            finalBuyerNetWorth: finalData.buyerNetWorth || 0,
            finalRenterPortfolio: finalData.renterPortfolio || 0,
            finalBuyerPortfolio: finalData.buyerPortfolio || 0,
            finalHomeEquity: finalData.homeEquity || 0,
            rentData,
            buyData,
            duration
        };
    }

    function displaySingleScenario(results) {
        const wrapper = document.getElementById('results-wrapper');
        const verdict = results.finalBuyerNetWorth > results.finalRenterNetWorth ? 'Buying' : 'Renting';
        const difference = Math.abs(results.finalBuyerNetWorth - results.finalRenterNetWorth);
        wrapper.innerHTML = `
            <div id="summary-verdicts">
                <div class="verdict-box" style="background-color:${verdict === 'Buying' ? '#d4edda' : '#f8d7da'};">
                    For this scenario, <strong>${verdict}</strong> is better by <strong>${formatCurrency(difference)}</strong>.
                </div>
            </div>
            <div id="single-table-container">
                 <table class="results-table">
                    <tr class="header-row"><th>Metric</th><th>Renting</th><th>Buying</th></tr>
                    <tr><td>Home Equity (net of selling costs)</td><td>N/A</td><td>${formatCurrency(results.finalHomeEquity)}</td></tr>
                    <tr><td>Investment Portfolio</td><td>${formatCurrency(results.finalRenterPortfolio)}</td><td>${formatCurrency(results.finalBuyerPortfolio)}</td></tr>
                    <tr class="net-worth-row"><td><strong>Total Net Worth</strong></td><td><strong>${formatCurrency(results.finalRenterNetWorth)}</strong></td><td><strong>${formatCurrency(results.finalBuyerNetWorth)}</strong></td></tr>
                </table>
            </div>
            <div class="chart-container"></div>`;
        const chartContainer = wrapper.querySelector('.chart-container');
        chartContainer.appendChild(chartCanvas);
        if (myChart) myChart.destroy();
        myChart = new Chart(chartCanvas, {
            type: 'line', data: {
                labels: Array.from({ length: results.duration }, (_, i) => `Year ${i + 1}`),
                datasets: [
                    { label: 'Renting Net Worth', data: results.rentData, borderColor: '#e67e22', fill: false },
                    { label: 'Buying Net Worth', data: results.buyData, borderColor: '#3498db', fill: false }
                ]
            }, options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: `Net Worth Over ${results.duration} Years` } } }
        });
    }

    function displayComparison(resultsA, resultsB, nameA, nameB) {
        const wrapper = document.getElementById('results-wrapper');
        const verdictA = resultsA.finalBuyerNetWorth > resultsA.finalRenterNetWorth ? 'Buying' : 'Renting';
        const verdictB = resultsB.finalBuyerNetWorth > resultsB.finalRenterNetWorth ? 'Buying' : 'Renting';
        const renderRow = (valA, valB) => `<td class="${valA > valB ? 'highlight' : ''}">${formatCurrency(valA)}</td><td class="${valB > valA ? 'highlight' : ''}">${formatCurrency(valB)}</td>`;
        wrapper.innerHTML = `
            <div id="summary-verdicts">
                <div class="verdict-box" style="background-color:${verdictA === 'Buying' ? '#d4edda' : '#f8d7da'};"><strong>${nameA}:</strong> ${verdictA} is better.</div>
                <div class="verdict-box" style="background-color:${verdictB === 'Buying' ? '#d4edda' : '#f8d7da'};"><strong>${nameB}:</strong> ${verdictB} is better.</div>
            </div>
            <div id="comparison-table-container">
                <table class="comparison-table"><tr class="header-row"><th>Metric</th><th>Scenario A: ${nameA}</th><th>Scenario B: ${nameB}</th></tr>
                    <tr><th>Final Net Worth (Renting)</th>${renderRow(resultsA.finalRenterNetWorth, resultsB.finalRenterNetWorth)}</tr>
                    <tr><th>Final Net Worth (Buying)</th>${renderRow(resultsA.finalBuyerNetWorth, resultsB.finalBuyerNetWorth)}</tr>
                    <tr><th>Home Equity (Buying)</th>${renderRow(resultsA.finalHomeEquity, resultsB.finalHomeEquity)}</tr>
                    <tr><th>Investment Portfolio (Buying)</th>${renderRow(resultsA.finalBuyerPortfolio, resultsB.finalBuyerPortfolio)}</tr>
                </table>
            </div>
            <div class="chart-container"></div>`;
        const chartContainer = wrapper.querySelector('.chart-container');
        chartContainer.appendChild(chartCanvas);
        if (myChart) myChart.destroy();
        myChart = new Chart(chartCanvas, {
            type: 'line', data: {
                labels: Array.from({ length: resultsA.duration }, (_, i) => `Year ${i + 1}`),
                datasets: [
                    { label: `${nameA} - Renting`, data: resultsA.rentData, borderColor: '#e67e22', fill: false },
                    { label: `${nameA} - Buying`, data: resultsA.buyData, borderColor: '#3498db', fill: false },
                    { label: `${nameB} - Renting`, data: resultsB.rentData, borderColor: '#c0392b', fill: false, borderDash: [5, 5] },
                    { label: `${nameB} - Buying`, data: resultsB.buyData, borderColor: '#27ae60', fill: false, borderDash: [5, 5] }
                ]
            }, options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: `Scenario Comparison: ${nameA} vs. ${nameB}` }}}
        });
    }
    
    // --- EVENT LISTENERS ---
    document.getElementById('calculate-button').addEventListener('click', () => {
        const settings = getFormSettings();
        const results = calculateScenario(settings);
        displaySingleScenario(results);
    });
    
    document.getElementById('compare-button').addEventListener('click', () => {
        const presets = getPresets();
        const nameA = document.getElementById('scenario-a-select').value;
        const nameB = document.getElementById('scenario-b-select').value;
        if (!presets[nameA] || !presets[nameB]) { alert('Please select two valid presets to compare.'); return; }
        const resultsA = calculateScenario(presets[nameA]);
        const resultsB = calculateScenario(presets[nameB]);
        displayComparison(resultsA, resultsB, nameA, nameB);
    });
    
    // --- PRESET MANAGEMENT ---
    const presetNameInput = document.getElementById('preset-name');
    const deleteSelect = document.getElementById('preset-delete-select');
    const scenarioASelect = document.getElementById('scenario-a-select');
    const scenarioBSelect = document.getElementById('scenario-b-select');
    const PRESETS_KEY = 'rentVsBuyPresets';

    function getPresets() { return JSON.parse(localStorage.getItem(PRESETS_KEY)) || {}; }
    function populatePresets() {
        const presets = getPresets();
        const presetNames = Object.keys(presets);
        [deleteSelect, scenarioASelect, scenarioBSelect].forEach(sel => {
            sel.innerHTML = '';
            const defaultOptText = presetNames.length > 0 ? `Select a preset... (${presetNames.length} saved)` : 'No presets saved';
            sel.innerHTML = `<option>${defaultOptText}</option>`;
            presetNames.forEach(name => {
                sel.innerHTML += `<option value="${name}">${name}</option>`;
            });
        });
    }

    document.getElementById('save-preset-btn').addEventListener('click', () => {
        const name = presetNameInput.value.trim();
        if (!name) { alert('Please enter a name for the preset.'); return; }
        const presets = getPresets();
        presets[name] = getFormSettings();
        localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
        presetNameInput.value = '';
        populatePresets();
        alert(`Preset "${name}" saved!`);
    });

    document.getElementById('delete-preset-btn').addEventListener('click', () => {
        const name = deleteSelect.value;
        const presets = getPresets();
        if (presets[name] && confirm(`Delete preset "${name}"?`)) {
            delete presets[name];
            localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
            populatePresets();
        }
    });

    // Initial load
    populatePresets();
});