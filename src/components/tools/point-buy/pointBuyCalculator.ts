import {
    BONUS_BUDGET, COST_TABLE, MAX_BASE, POINT_BUDGET, STAT_KEYS, STAT_NAMES,
    changeStat, createInitialStats, formatModifier, formatStatsResult,
    getActionBlockReason, getRemainingBudget, parseStats, serializeStats,
  } from '../../../utils/pointBuy';
  import type { StatAction, Stats } from '../../../utils/pointBuy';
  
  export function initializeCalculator() {
    const page = document.querySelector<HTMLElement>('.point-buy-page');
    if (!page || page.dataset.initialized) return;
    page.dataset.initialized = 'true';
  
    const table = page.querySelector<HTMLTableSectionElement>('#stats-table')!;
    const pointsDisplay = page.querySelector<HTMLElement>('#points-remaining')!;
    const bonusesDisplay = page.querySelector<HTMLElement>('#bonuses-remaining')!;
    const pointsProgress = page.querySelector<HTMLProgressElement>('#points-progress')!;
    const bonusesProgress = page.querySelector<HTMLProgressElement>('#bonuses-progress')!;
    const distributionStatus = page.querySelector<HTMLElement>('#distribution-status')!;
    const actionStatus = page.querySelector<HTMLElement>('#action-status')!;
    const storageStatus = page.querySelector<HTMLElement>('#storage-status')!;
    const resetButton = page.querySelector<HTMLButtonElement>('#reset-btn')!;
    const copyResultButton = page.querySelector<HTMLButtonElement>('#copy-result-btn')!;
    const copyLinkButton = page.querySelector<HTMLButtonElement>('#copy-link-btn')!;
    const manualCopy = page.querySelector<HTMLElement>('#manual-copy')!;
    const copyText = page.querySelector<HTMLTextAreaElement>('#copy-text')!;
    const storageKey = 'loh-point-buy-v1';
    const actions: StatAction[] = ['decrease-base', 'increase-base', 'decrease-racial', 'increase-racial'];
    const actionLabels: Record<StatAction, string> = {
      'decrease-base': 'уменьшить базовое значение',
      'increase-base': 'увеличить базовое значение',
      'decrease-racial': 'уменьшить бонус предыстории',
      'increase-racial': 'увеличить бонус предыстории',
    };
    let stats = createInitialStats();
    let storageAvailable = true;
  
    const sharedValue = new URL(window.location.href).searchParams.get('pb');
    const sharedStats = sharedValue === null ? null : parseStats(sharedValue);
    if (sharedStats) {
      stats = sharedStats;
      actionStatus.textContent = 'Распределение загружено из ссылки.';
    } else {
      if (sharedValue !== null) actionStatus.textContent = 'В ссылке некорректное распределение. Оно не применено.';
      try {
        const savedValue = localStorage.getItem(storageKey);
        const savedStats = savedValue === null ? null : parseStats(savedValue);
        if (savedStats) {
          stats = savedStats;
          actionStatus.textContent += (actionStatus.textContent ? ' ' : '') + 'Восстановлено сохранённое распределение.';
        }
      } catch {
        storageAvailable = false;
      }
    }
  
    function saveStats() {
      if (storageAvailable) {
        try {
          localStorage.setItem(storageKey, serializeStats(stats));
        } catch {
          storageAvailable = false;
        }
      }
      storageStatus.textContent = storageAvailable
        ? 'Сохраняется автоматически.'
        : 'Автосохранение недоступно. Скопируйте результат или ссылку, чтобы сохранить распределение.';
    }
  
    function renderStats() {
      const remaining = getRemainingBudget(stats);
      pointsDisplay.textContent = String(remaining.points);
      bonusesDisplay.textContent = String(remaining.bonuses);
      pointsProgress.value = POINT_BUDGET - remaining.points;
      bonusesProgress.value = BONUS_BUDGET - remaining.bonuses;
      pointsProgress.setAttribute('aria-valuetext', 'Потрачено ' + pointsProgress.value + ' из ' + POINT_BUDGET);
      bonusesProgress.setAttribute('aria-valuetext', 'Распределено ' + bonusesProgress.value + ' из ' + BONUS_BUDGET);
  
      const complete = remaining.points === 0 && remaining.bonuses === 0;
      distributionStatus.classList.toggle('is-complete', complete);
      distributionStatus.textContent = complete
        ? '✓ Все очки и бонусы распределены.'
        : remaining.points === 0
          ? 'Осталось бонусов: ' + remaining.bonuses + '.'
          : remaining.bonuses === 0
            ? 'Осталось очков: ' + remaining.points + '.'
            : 'Осталось: ' + remaining.points + ' очк. и ' + remaining.bonuses + (remaining.bonuses === 1 ? ' бонус.' : ' бонуса.');
  
      for (const key of STAT_KEYS) {
        const row = table.querySelector<HTMLTableRowElement>('[data-stat-row="' + key + '"]')!;
        const { base, racial } = stats[key];
        const values = {
          base: String(base), racial: '+' + racial, total: String(base + racial),
          modifier: formatModifier(base + racial), cost: String(COST_TABLE[base]),
        };
        for (const [field, value] of Object.entries(values)) {
          row.querySelectorAll<HTMLElement>('[data-value="' + field + '"]').forEach((element) => {
            element.textContent = value;
          });
        }
  
        for (const action of actions) {
          const button = row.querySelector<HTMLButtonElement>('[data-action="' + action + '"]')!;
          const reason = getActionBlockReason(stats, key, action);
          button.disabled = reason !== null;
          button.title = reason ?? actionLabels[action];
          button.setAttribute('aria-label', STAT_NAMES[key] + ': ' + actionLabels[action] + (reason ? '. ' + reason : ''));
        }
        const baseReason = getActionBlockReason(stats, key, 'increase-base');
        const bonusReason = getActionBlockReason(stats, key, 'increase-racial');
        const nextCost = COST_TABLE[base + 1] - COST_TABLE[base];
        row.querySelector<HTMLElement>('[data-hint="base"]')!.textContent = baseReason
          ? baseReason + (base < MAX_BASE ? ' · нужно ' + nextCost + ' очк.' : '')
          : base + ' → ' + (base + 1) + ': ' + nextCost + ' очк.';
        row.querySelector<HTMLElement>('[data-hint="racial"]')!.textContent = bonusReason ?? 'До +2 на характеристику';
      }
      resetButton.disabled = remaining.points === POINT_BUDGET && remaining.bonuses === BONUS_BUDGET;
      copyResultButton.disabled = false;
      copyLinkButton.disabled = false;
    }
  
    function onChange() {
      actionStatus.textContent = '';
      manualCopy.hidden = true;
      renderStats();
      saveStats();
      // A reload of a shared URL should restore the latest edits, including a reset.
      const url = new URL(window.location.href);
      if (url.searchParams.has('pb')) {
        url.searchParams.set('pb', serializeStats(stats));
        try { window.history.replaceState(window.history.state, '', url); } catch { /* Editing remains available. */ }
      }
    }
  
    table.addEventListener('click', (event) => {
      if (!(event.target instanceof Element)) return;
      const button = event.target.closest<HTMLButtonElement>('button[data-action]');
      if (!button || button.disabled) return;
      const key = button.dataset.stat as keyof Stats;
      const action = button.dataset.action as StatAction;
      if (!STAT_KEYS.includes(key) || !actions.includes(action)) return;
      const nextStats = changeStat(stats, key, action);
      if (nextStats === stats) return;
      stats = nextStats;
      onChange();
      if (button.disabled) {
        // Keep keyboard focus in this row when the current action reaches a limit.
        const opposite = action.startsWith('increase') ? action.replace('increase', 'decrease') : action.replace('decrease', 'increase');
        const row = button.closest('tr');
        const nextButton = row?.querySelector<HTMLButtonElement>('[data-action="' + opposite + '"]:not(:disabled)')
          ?? row?.querySelector<HTMLButtonElement>('.stat-btn:not(:disabled)');
        nextButton?.focus({ preventScroll: true });
      }
    });
  
    resetButton.addEventListener('click', () => {
      stats = createInitialStats();
      onChange();
      actionStatus.textContent = 'Распределение сброшено. Все характеристики снова равны 8.';
      table.querySelector<HTMLButtonElement>('[data-action="increase-base"]')?.focus({ preventScroll: true });
    });
  
    async function copy(text: string, successMessage: string) {
      manualCopy.hidden = true;
      try {
        if (!navigator.clipboard) throw new Error('Clipboard unavailable');
        await navigator.clipboard.writeText(text);
        actionStatus.textContent = successMessage;
      } catch {
        copyText.value = text;
        copyText.rows = text.includes('\n') ? 8 : 3;
        manualCopy.hidden = false;
        actionStatus.textContent = 'Автоматическое копирование недоступно. Скопируйте выделенный текст ниже.';
        copyText.focus();
        copyText.select();
      }
    }
  
    copyResultButton.addEventListener('click', () => void copy(formatStatsResult(stats), 'Результат скопирован.'));
    copyLinkButton.addEventListener('click', () => {
      const url = new URL(window.location.href);
      url.searchParams.set('pb', serializeStats(stats));
      void copy(url.toString(), 'Ссылка на это распределение скопирована.');
    });
  
    renderStats();
    saveStats();
  }
  