(function () {
  'use strict';

  const STORAGE_KEY = 'mortgageComparison';

  const loanBalanceInput = document.getElementById('loan-balance');
  const currentRateInput = document.getElementById('current-rate');
  const remainingTermInput = document.getElementById('remaining-term');
  const currentSummary = document.getElementById('current-summary');
  const currentRepaymentEl = document.getElementById('current-repayment');
  const lendersContainer = document.getElementById('lenders-container');
  const emptyState = document.getElementById('empty-state');
  const resultsSection = document.getElementById('results-section');
  const resultsBody = document.getElementById('results-body');
  const addLenderBtn = document.getElementById('add-lender-btn');
  const lenderTemplate = document.getElementById('lender-template');

  let lenders = [];
  let nextLenderId = 1;

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.loanBalance != null) loanBalanceInput.value = data.loanBalance;
      if (data.currentRate != null) currentRateInput.value = data.currentRate;
      if (data.remainingTerm != null) remainingTermInput.value = data.remainingTerm;
      if (Array.isArray(data.lenders)) {
        lenders = data.lenders;
        nextLenderId = data.nextLenderId || lenders.reduce((max, l) => Math.max(max, l.id), 0) + 1;
      }
    } catch (e) {
      console.warn('Could not load saved data:', e);
    }
  }

  function saveState() {
    const data = {
      loanBalance: loanBalanceInput.value,
      currentRate: currentRateInput.value,
      remainingTerm: remainingTermInput.value,
      lenders,
      nextLenderId,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function formatCurrency(amount) {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  function formatCurrencyPrecise(amount) {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  function formatRate(rate) {
    return rate.toFixed(2) + '%';
  }

  /**
   * Standard amortising loan monthly repayment.
   * M = P * [r(1+r)^n] / [(1+r)^n - 1]
   */
  function calculateMonthlyRepayment(principal, annualRate, termYears) {
    if (principal <= 0 || termYears <= 0) return 0;
    const monthlyRate = annualRate / 100 / 12;
    const months = termYears * 12;
    if (monthlyRate === 0) return principal / months;
    const factor = Math.pow(1 + monthlyRate, months);
    return (principal * monthlyRate * factor) / (factor - 1);
  }

  function getLoanInputs() {
    return {
      balance: parseFloat(loanBalanceInput.value) || 0,
      rate: parseFloat(currentRateInput.value) || 0,
      term: parseFloat(remainingTermInput.value) || 0,
    };
  }

  function isLoanValid(loan) {
    return loan.balance > 0 && loan.rate >= 0 && loan.term > 0;
  }

  function renderLenderCard(lender, index) {
    const clone = lenderTemplate.content.cloneNode(true);
    const card = clone.querySelector('.lender-card');
    card.dataset.id = lender.id;

    clone.querySelector('.lender-number').textContent = index + 1;
    const nameInput = clone.querySelector('.lender-name');
    const rateInput = clone.querySelector('.lender-rate');
    const costInput = clone.querySelector('.lender-cost');

    nameInput.value = lender.name || '';
    rateInput.value = lender.rate ?? '';
    costInput.value = lender.switchingCost ?? '';

    const updateLender = () => {
      const idx = lenders.findIndex((l) => l.id === lender.id);
      if (idx === -1) return;
      lenders[idx] = {
        id: lender.id,
        name: nameInput.value,
        rate: rateInput.value,
        switchingCost: costInput.value,
      };
      saveState();
      recalculate();
    };

    nameInput.addEventListener('input', updateLender);
    rateInput.addEventListener('input', updateLender);
    costInput.addEventListener('input', updateLender);

    clone.querySelector('.btn-remove').addEventListener('click', () => {
      lenders = lenders.filter((l) => l.id !== lender.id);
      saveState();
      renderLenders();
      recalculate();
    });

    lendersContainer.appendChild(clone);
  }

  function renderLenders() {
    lendersContainer.innerHTML = '';
    lenders.forEach((lender, i) => renderLenderCard(lender, i));
    emptyState.hidden = lenders.length > 0;
  }

  function addLender() {
    lenders.push({
      id: nextLenderId++,
      name: '',
      rate: '',
      switchingCost: '',
    });
    saveState();
    renderLenders();
    recalculate();

    const lastCard = lendersContainer.lastElementChild;
    if (lastCard) {
      const nameInput = lastCard.querySelector('.lender-name');
      if (nameInput) nameInput.focus();
    }
  }

  function formatBreakEven(months) {
    if (!isFinite(months) || months <= 0) return '—';
    if (months > 600) return '600+ months';
    const rounded = Math.ceil(months);
    if (rounded === 1) return '1 month';
    if (rounded < 12) return rounded + ' months';
    const years = Math.floor(rounded / 12);
    const rem = rounded % 12;
    if (rem === 0) return years + (years === 1 ? ' year' : ' years');
    return years + ' yr ' + rem + ' mo';
  }

  function recalculate() {
    const loan = getLoanInputs();

    if (!isLoanValid(loan)) {
      currentSummary.hidden = true;
      resultsSection.hidden = true;
      return;
    }

    const currentRepayment = calculateMonthlyRepayment(loan.balance, loan.rate, loan.term);
    currentRepaymentEl.textContent = formatCurrencyPrecise(currentRepayment) + ' / month';
    currentSummary.hidden = false;

    const validLenders = lenders.filter((l) => {
      const rate = parseFloat(l.rate);
      return l.name.trim() && !isNaN(rate) && rate >= 0;
    });

    if (validLenders.length === 0) {
      resultsSection.hidden = true;
      return;
    }

    const comparisons = validLenders.map((l) => {
      const rate = parseFloat(l.rate);
      const switchingCost = parseFloat(l.switchingCost) || 0;
      const repayment = calculateMonthlyRepayment(loan.balance, rate, loan.term);
      const monthlySaving = currentRepayment - repayment;
      const annualSaving = monthlySaving * 12;
      const breakEvenMonths = monthlySaving > 0 ? switchingCost / monthlySaving : Infinity;

      return {
        id: l.id,
        name: l.name.trim(),
        rate,
        switchingCost,
        repayment,
        monthlySaving,
        annualSaving,
        breakEvenMonths,
      };
    });

    const lowestRepayment = Math.min(...comparisons.map((c) => c.repayment));

    resultsBody.innerHTML = '';
    comparisons.forEach((c) => {
      const row = document.createElement('tr');
      if (c.repayment === lowestRepayment) {
        row.classList.add('best-lender');
      }

      const savingClass =
        c.monthlySaving > 0 ? 'saving-positive' : c.monthlySaving < 0 ? 'saving-negative' : 'saving-neutral';

      const isBest = c.repayment === lowestRepayment;
      const nameCell = isBest
        ? c.name + '<span class="badge-best">Lowest</span>'
        : c.name;

      row.innerHTML =
        '<td>' + nameCell + '</td>' +
        '<td>' + formatRate(c.rate) + '</td>' +
        '<td><strong>' + formatCurrencyPrecise(c.repayment) + '</strong></td>' +
        '<td class="' + savingClass + '">' + (c.monthlySaving >= 0 ? '+' : '') + formatCurrencyPrecise(c.monthlySaving) + '</td>' +
        '<td class="' + savingClass + '">' + (c.annualSaving >= 0 ? '+' : '') + formatCurrency(c.annualSaving) + '</td>' +
        '<td>' + formatCurrency(c.switchingCost) + '</td>' +
        '<td>' + formatBreakEven(c.breakEvenMonths) + '</td>';

      resultsBody.appendChild(row);
    });

    resultsSection.hidden = false;
  }

  loanBalanceInput.addEventListener('input', () => {
    saveState();
    recalculate();
  });
  currentRateInput.addEventListener('input', () => {
    saveState();
    recalculate();
  });
  remainingTermInput.addEventListener('input', () => {
    saveState();
    recalculate();
  });

  addLenderBtn.addEventListener('click', addLender);

  loadState();
  renderLenders();
  recalculate();
})();
