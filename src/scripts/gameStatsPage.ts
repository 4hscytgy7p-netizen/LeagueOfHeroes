import { analyzeGameStats, GAME_STATS_CSV_URL } from '../utils/gameStats.ts';
import type { GameStatsResult } from '../utils/gameStats.ts';
import {
  CHART_METRICS, buildStatsChart, getFilteredStats, getStatsPartyPage,
  getStatsPlayerCard, getStatsRanking, groupStatsPie, readStatsView, writeStatsView
} from '../utils/gameStatsView.ts';
import type { ChartEntry, ChartMetric, PartySort, RankingKind } from '../utils/gameStatsView.ts';

const numbers = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
const percentages = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });
const COLORS = ['#7c3aed', '#2563eb', '#0f766e', '#c2410c', '#be185d', '#854d0e', '#64748b'];

function formatChartValue(value: number, unit: string): string {
  const forms = unit === 'участий' ? ['участие', 'участия', 'участий']
    : unit === 'партий' ? ['партия', 'партии', 'партий'] : ['ОП', 'ОП', 'ОП'];
  const lastTwo = Math.abs(value) % 100;
  const last = lastTwo % 10;
  const form = lastTwo >= 11 && lastTwo <= 14 ? 2 : last === 1 ? 0 : last >= 2 && last <= 4 ? 1 : 2;
  return `${numbers.format(value)} ${forms[form]}`;
}

export function escapeStatsHtml(value: string | number): string {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]!);
}

function chartShares(entries: ChartEntry[]) {
  const total = entries.reduce((sum, entry) => sum + entry.value, 0);
  return { total, percent: (value: number) => total > 0 ? `${percentages.format(value / total * 100)}%` : '—' };
}

export function renderStatsPie(entries: ChartEntry[], unit: string): string {
  const slices = groupStatsPie(entries);
  const { total, percent } = chartShares(entries);
  if (total <= 0 || entries.some(entry => entry.value < 0)) {
    return '<p class="stats-chart-empty">Для диаграммы долей нужны положительные значения. Все значения доступны в таблице ниже.</p>';
  }
  const circumference = 2 * Math.PI * 92;
  let offset = 0;
  const arcs = slices.map((entry, index) => {
    const length = entry.value / total * circumference;
    const arc = `<circle cx="130" cy="130" r="92" fill="none" stroke="${COLORS[index]}" stroke-width="38"
      stroke-dasharray="${length} ${circumference}" stroke-dashoffset="${-offset}" transform="rotate(-90 130 130)">
      <title>${escapeStatsHtml(entry.label)}: ${escapeStatsHtml(formatChartValue(entry.value, unit))} · ${percent(entry.value)}</title></circle>`;
    offset += length;
    return arc;
  }).join('');
  const legend = slices.map((entry, index) => `<li>
    <span class="stats-legend-swatch" style="background:${COLORS[index]}" aria-hidden="true"></span>
    <span class="stats-legend-name">${escapeStatsHtml(entry.label)}</span>
    <span class="stats-legend-value">${escapeStatsHtml(formatChartValue(entry.value, unit))} <strong>${percent(entry.value)}</strong></span>
  </li>`).join('');
  return `<div class="stats-pie-layout"><svg viewBox="0 0 260 260" role="img" aria-labelledby="stats-pie-title stats-pie-description">
    <title id="stats-pie-title">Доли выбранного показателя</title>
    <desc id="stats-pie-description">Проценты рассчитаны по всей выборке. Значения каждого сектора приведены в легенде и таблице ниже.</desc>
    ${arcs}<text x="130" y="124" text-anchor="middle" class="stats-pie-total">${escapeStatsHtml(numbers.format(total))}</text>
    <text x="130" y="147" text-anchor="middle" class="stats-pie-unit">${escapeStatsHtml(unit)} всего</text>
    </svg><ul class="stats-pie-legend" aria-label="Значения секторов">${legend}</ul></div>`;
}

export function initializeGameStatsPage() {
  const root = document.querySelector<HTMLElement>('.game-stats-page');
  if (!root || root.dataset.initialized) return;
  root.dataset.initialized = 'true';
  const element = <T extends HTMLElement = HTMLElement>(id: string) => root.querySelector<T>(`#${id}`)!;
  const inputGm = element<HTMLInputElement>('stats-gm');
  const inputPlayer = element<HTMLInputElement>('stats-player');
  const loadMessage = element('stats-load-message');
  const content = element('stats-content');
  const reload = element<HTMLButtonElement>('stats-reload');
  const skeleton = element('stats-skeleton');
  let data: GameStatsResult | undefined;
  let state = readStatsView(window.location.search);
  let loading = false;

  function syncUrl() {
    const url = writeStatsView(new URL(window.location.href), state);
    if (url.href !== window.location.href) window.history.replaceState(null, '', url);
  }

  function syncControls() {
    inputGm.value = state.gm;
    inputPlayer.value = state.player;
    element<HTMLSelectElement>('stats-chart-metric').value = state.metric;
    element<HTMLSelectElement>('stats-sort').value = state.sort;
    element<HTMLSelectElement>('stats-direction').value = state.direction;
    element<HTMLSelectElement>('stats-page-size').value = String(state.pageSize);
    for (const [attribute, value] of [['chart', state.chart], ['ranking', state.ranking], ['measure', state.measure]]) {
      root!.querySelectorAll<HTMLButtonElement>(`[data-${attribute}]`).forEach(button => {
        button.setAttribute('aria-pressed', String(button.dataset[attribute] === value));
      });
    }
  }

  function renderFilters(result: GameStatsResult) {
    element('stats-results').textContent = `Найдено ${numbers.format(result.stats.totalParties)} из ${numbers.format(data!.stats.totalParties)} партий`;
    const chips = element('stats-filter-chips');
    chips.replaceChildren();
    for (const [key, label] of [['gm', 'Мастер'], ['player', 'Партии с участием']] as const) {
      if (!state[key]) continue;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'stats-chip';
      button.textContent = `${label}: ${state[key]} ×`;
      button.setAttribute('aria-label', `Убрать фильтр: ${label} ${state[key]}`);
      button.addEventListener('click', () => {
        state[key] = '';
        state.page = 1;
        resetHints();
        render();
        (key === 'gm' ? inputGm : inputPlayer).focus();
      });
      chips.append(button);
    }
    element<HTMLButtonElement>('stats-reset').disabled = !state.gm && !state.player;
  }

  function renderSummary(result: GameStatsResult) {
    const summary = {
      totalParties: result.stats.totalParties, uniqueGMs: result.stats.uniqueGMs.length,
      uniquePlayers: result.stats.uniquePlayers.length, averagePlayersPerParty: result.stats.averagePlayersPerParty
    };
    root!.querySelectorAll<HTMLElement>('[data-stats-summary]').forEach(card => {
      card.textContent = numbers.format(summary[card.dataset.statsSummary as keyof typeof summary]);
    });
    element('stats-personal').hidden = !state.player;
    if (state.player) {
      const personal = getStatsPlayerCard(result.parties, state.player);
      element('stats-personal-title').textContent = `Статистика игрока: ${state.player}`;
      const values: [string, number][] = [
        ['Партий', personal.games], ['Всего ОП', personal.totalProgress], ['ОП за партию', personal.averageProgress],
        ['Мастеров', personal.gms], ['Других игроков', personal.partners]
      ];
      element('stats-personal-values').innerHTML = values.map(([label, value]) => `<div><dt>${label}</dt><dd>${escapeStatsHtml(numbers.format(value))}</dd></div>`).join('');
    }
  }

  function renderChart(result: GameStatsResult) {
    const metric = CHART_METRICS[state.metric];
    const entries = buildStatsChart(result, state.metric);
    const { percent } = chartShares(entries);
    element('stats-chart-title').textContent = metric.title;
    element('stats-chart-description').textContent = `Партий в выборке: ${numbers.format(result.stats.totalParties)} · ${state.chart === 'pie' ? metric.share : 'Абсолютные значения'}`;
    const chart = element('stats-chart');
    if (state.chart === 'pie') {
      chart.innerHTML = renderStatsPie(entries, metric.unit);
      element('stats-chart-note').textContent = 'Доли рассчитаны по всей выборке. После первых 6 участников остальные объединены в «Другие». Нулевые значения доступны в таблице.';
    } else if (!entries.length) {
      chart.innerHTML = '<p class="stats-chart-empty">В выбранных партиях нет участников для этого показателя.</p>';
      element('stats-chart-note').textContent = 'Выберите другой показатель или измените фильтры.';
    } else {
      const visible = entries.slice(0, 12);
      const max = Math.max(...entries.map(entry => Math.abs(entry.value)), 1);
      chart.innerHTML = `<ol class="stats-bars" role="list" aria-label="${escapeStatsHtml(metric.title)}">${visible.map(entry => `<li>
        <div class="stats-bar-heading"><span>${escapeStatsHtml(entry.label)}</span><strong>${escapeStatsHtml(formatChartValue(entry.value, metric.unit))}</strong></div>
        <div class="stats-bar-track" aria-hidden="true"><div class="stats-bar-fill" style="width:${Math.abs(entry.value) / max * 100}%"></div></div>
      </li>`).join('')}</ol>`;
      element('stats-chart-note').textContent = `Показано ${visible.length} из ${entries.length} участников. Полный список — в таблице ниже.`;
    }
    element('stats-chart-caption').textContent = `${metric.title}. ${metric.share}.`;
    element('stats-chart-unit').textContent = state.metric.endsWith('progress') ? 'ОП' : state.metric.startsWith('players') ? 'Участия' : 'Партии';
    element('stats-chart-data').innerHTML = entries.map(entry => `<tr><th scope="row">${escapeStatsHtml(entry.label)}</th><td>${escapeStatsHtml(numbers.format(entry.value))}</td><td>${percent(entry.value)}</td></tr>`).join('');
  }

  function renderRanking(result: GameStatsResult) {
    const rows = getStatsRanking(result, state);
    const visible = state.showAll ? rows : rows.slice(0, 8);
    const names = { players: 'Игроки', gms: 'Мастера', pairs: 'Пары мастер / игрок' };
    element('stats-ranking-title').textContent = `${names[state.ranking]} — ${state.measure === 'games' ? 'по числу партий' : 'по суммарному ОП'}`;
    element('stats-ranking-description').textContent = `Показано ${visible.length} из ${rows.length} · в выбранных партиях`;
    element('stats-pairs-note').hidden = state.ranking !== 'pairs';
    const list = element('stats-ranking-list');
    list.classList.toggle('stats-ranking-expanded', state.showAll);
    list.innerHTML = visible.map((entry, index) => `<li>
      <span class="stats-rank-number" aria-hidden="true">${index + 1}</span>
      <span class="stats-rank-name">${escapeStatsHtml(entry.name)}</span>
      <span class="stats-rank-values"><strong>${escapeStatsHtml(formatChartValue(state.measure === 'games' ? entry.games : entry.totalProgress, state.measure === 'games' ? 'партий' : 'ОП'))}</strong>
      <small>${escapeStatsHtml(formatChartValue(state.measure === 'games' ? entry.totalProgress : entry.games, state.measure === 'games' ? 'ОП' : 'партий'))}</small></span>
    </li>`).join('');
    const all = element<HTMLButtonElement>('stats-ranking-all');
    all.hidden = rows.length <= 8;
    all.textContent = state.showAll ? 'Показать первые 8' : `Показать всех (${rows.length})`;
    all.setAttribute('aria-expanded', String(state.showAll));
  }

  function renderParties(result: GameStatsResult) {
    const page = getStatsPartyPage(result.parties, state);
    state.page = page.page;
    const playersHtml = (party: typeof page.parties[number]) => party.players.length
      ? `<details class="stats-party-details"><summary>Состав: ${party.playerCount} игроков</summary><ul>${party.players.map(player => `<li><span>${escapeStatsHtml(player.name)}</span><strong>${escapeStatsHtml(numbers.format(player.progress))} ОП</strong></li>`).join('')}</ul></details>`
      : '<span class="stats-muted">Игроки не указаны</span>';
    element('stats-parties-body').innerHTML = page.parties.map(party => `<tr>
      <th scope="row">#${party.id}</th><td>${escapeStatsHtml(party.gm)}</td><td>${escapeStatsHtml(numbers.format(party.gmProgress))}</td>
      <td>${playersHtml(party)}</td><td>${party.playerCount}</td><td class="stats-numeric">${escapeStatsHtml(numbers.format(party.totalProgress))}</td>
    </tr>`).join('');
    element('stats-party-cards').innerHTML = page.parties.map(party => `<article class="stats-party-card">
      <div class="stats-party-card-heading"><h3>${escapeStatsHtml(party.gm)}</h3><span class="stats-muted">Запись #${party.id}</span></div>
      <dl><div><dt>ОП мастера</dt><dd>${escapeStatsHtml(numbers.format(party.gmProgress))}</dd></div><div><dt>Игроков</dt><dd>${party.playerCount}</dd></div><div><dt>Всего ОП</dt><dd>${escapeStatsHtml(numbers.format(party.totalProgress))}</dd></div></dl>
      ${playersHtml(party)}</article>`).join('');
    element('stats-parties-caption').textContent = `Партии выбранной выборки. Страница ${page.page} из ${page.pages}. Всего ОП включает мастера и игроков.`;
    element('stats-page-range').textContent = `${page.start + 1}–${page.start + page.parties.length} из ${numbers.format(result.stats.totalParties)} партий`;
    element<HTMLButtonElement>('stats-prev').disabled = page.page === 1;
    element<HTMLButtonElement>('stats-next').disabled = page.page === page.pages;
    element<HTMLSelectElement>('stats-page').replaceChildren(...Array.from({ length: page.pages }, (_, index) => new Option(`${index + 1} из ${page.pages}`, String(index + 1))));
    element<HTMLSelectElement>('stats-page').value = String(page.page);
    root!.querySelectorAll<HTMLElement>('[data-sort-heading]').forEach(heading => {
      const active = heading.dataset.sortHeading === state.sort;
      if (active) heading.setAttribute('aria-sort', state.direction === 'asc' ? 'ascending' : 'descending');
      else heading.removeAttribute('aria-sort');
    });
    root!.querySelectorAll<HTMLElement>('[data-sort-indicator]').forEach(indicator => {
      indicator.textContent = indicator.dataset.sortIndicator === state.sort ? (state.direction === 'asc' ? '↑' : '↓') : '';
      indicator.setAttribute('aria-hidden', 'true');
    });
  }

  function render() {
    if (!data) return;
    element('stats-share-status').replaceChildren();
    const result = getFilteredStats(data.parties, state);
    syncControls();
    renderFilters(result);
    renderSummary(result);
    const empty = result.stats.totalParties === 0;
    element('stats-no-results').hidden = !empty;
    element('stats-analysis').hidden = empty;
    const sourceEmpty = data.stats.totalParties === 0;
    element('stats-empty-title').textContent = sourceEmpty ? 'В источнике пока нет партий' : 'Подходящих партий нет';
    element('stats-empty-description').textContent = sourceEmpty ? 'Обновите данные позже или откройте источник.' : 'Измените выбранные имена или сбросьте фильтры.';
    element('stats-empty-reset').hidden = sourceEmpty;
    if (!empty) {
      renderChart(result);
      renderRanking(result);
      renderParties(result);
    } else {
      state.page = 1;
    }
    syncUrl();
  }

  function resetHints() {
    inputGm.removeAttribute('aria-invalid');
    inputPlayer.removeAttribute('aria-invalid');
    element('stats-gm-hint').textContent = 'Начните вводить имя и выберите из списка.';
    element('stats-player-hint').textContent = 'Партии с участием выбранного игрока.';
  }

  function resetFilters() {
    state.gm = '';
    state.player = '';
    state.page = 1;
    resetHints();
    render();
    inputGm.focus();
  }

  function applyName(key: 'gm' | 'player', input: HTMLInputElement, committed: boolean) {
    if (!data) return;
    const value = input.value.trim();
    const choices = key === 'gm' ? data.stats.uniqueGMs : data.stats.uniquePlayers;
    const selected = choices.find(name => name.toLocaleLowerCase('ru') === value.toLocaleLowerCase('ru'));
    const hint = element(`stats-${key}-hint`);
    if (value && !selected) {
      hint.textContent = 'Выберите имя из подсказок. Введённый текст ещё не применён.';
      if (committed) input.setAttribute('aria-invalid', 'true');
      return;
    }
    input.removeAttribute('aria-invalid');
    hint.textContent = key === 'gm' ? 'Начните вводить имя и выберите из списка.' : 'Партии с участием выбранного игрока.';
    if (state[key] === (selected ?? '')) return;
    state[key] = selected ?? '';
    state.page = 1;
    render();
  }

  async function loadData() {
    if (loading) return;
    loading = true;
    reload.disabled = true;
    reload.textContent = 'Загрузка…';
    content.setAttribute('aria-busy', 'true');
    loadMessage.hidden = false;
    loadMessage.classList.remove('stats-load-error');
    loadMessage.textContent = data ? 'Обновление статистики…' : 'Загрузка актуальной статистики…';
    skeleton.hidden = Boolean(data);
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(GAME_STATS_CSV_URL, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error(`Statistics HTTP ${response.status}`);
      const csv = await response.text();
      if (csv.trim() && !csv.split(/\r?\n/).some(line => /^[^;]+;\s*-?\d+\s*;/.test(line.replace(/^\uFEFF/, '')))) {
        throw new Error('Invalid statistics CSV');
      }
      const nextData = analyzeGameStats(csv);
      // Keep the last successful data on screen if a refresh fails.
      data = nextData;
      element<HTMLDataListElement>('stats-gm-options').replaceChildren(...data.stats.uniqueGMs.map(name => new Option(name, name)));
      element<HTMLDataListElement>('stats-player-options').replaceChildren(...data.stats.uniquePlayers.map(name => new Option(name, name)));
      resetHints();
      render();
      content.hidden = false;
      const fetchedAt = new Date();
      element('stats-loaded-at').textContent = `Получено ${new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Kiev' }).format(fetchedAt)} · Киев`;
      loadMessage.textContent = 'Актуальная статистика загружена.';
      loadMessage.hidden = true;
      reload.textContent = 'Обновить данные';
    } catch (error) {
      loadMessage.classList.add('stats-load-error');
      loadMessage.textContent = data
        ? 'Не удалось обновить статистику. Показаны ранее полученные данные. Попробуйте загрузить ещё раз.'
        : 'Не удалось загрузить статистику. Проверьте соединение и попробуйте ещё раз.';
      reload.textContent = 'Повторить загрузку';
      console.error('Failed to load game statistics', error);
    } finally {
      window.clearTimeout(timer);
      loading = false;
      reload.disabled = false;
      skeleton.hidden = true;
      content.setAttribute('aria-busy', 'false');
    }
  }

  reload.addEventListener('click', () => void loadData());
  element('stats-reset').addEventListener('click', resetFilters);
  element('stats-empty-reset').addEventListener('click', resetFilters);
  for (const [key, input] of [['gm', inputGm], ['player', inputPlayer]] as const) {
    input.addEventListener('input', () => applyName(key, input, false));
    input.addEventListener('change', () => applyName(key, input, true));
    input.addEventListener('keydown', event => { if (event.key === 'Enter') applyName(key, input, true); });
  }
  root.querySelectorAll<HTMLButtonElement>('[data-chart]').forEach(button => button.addEventListener('click', () => {
    state.chart = button.dataset.chart as 'bar' | 'pie'; render();
  }));
  root.querySelectorAll<HTMLButtonElement>('[data-ranking]').forEach(button => button.addEventListener('click', () => {
    state.ranking = button.dataset.ranking as RankingKind; render();
  }));
  root.querySelectorAll<HTMLButtonElement>('[data-measure]').forEach(button => button.addEventListener('click', () => {
    state.measure = button.dataset.measure as 'games' | 'progress'; render();
  }));
  root.querySelectorAll<HTMLButtonElement>('[data-sort]').forEach(button => button.addEventListener('click', () => {
    const sort = button.dataset.sort as PartySort;
    state.direction = sort === state.sort ? (state.direction === 'asc' ? 'desc' : 'asc') : sort === 'gm' ? 'asc' : 'desc';
    state.sort = sort; state.page = 1; render();
  }));
  element<HTMLSelectElement>('stats-chart-metric').addEventListener('change', event => {
    state.metric = (event.target as HTMLSelectElement).value as ChartMetric; render();
  });
  element('stats-ranking-all').addEventListener('click', () => { state.showAll = !state.showAll; render(); });
  element<HTMLSelectElement>('stats-sort').addEventListener('change', event => {
    state.sort = (event.target as HTMLSelectElement).value as PartySort; state.page = 1; render();
  });
  element<HTMLSelectElement>('stats-direction').addEventListener('change', event => {
    state.direction = (event.target as HTMLSelectElement).value as 'asc' | 'desc'; state.page = 1; render();
  });
  element<HTMLSelectElement>('stats-page-size').addEventListener('change', event => {
    state.pageSize = Number((event.target as HTMLSelectElement).value); state.page = 1; render();
  });
  function changePage(page: number) {
    state.page = page; render();
    element('stats-parties-title').focus({ preventScroll: true });
    element('stats-parties-title').scrollIntoView({ block: 'start' });
  }
  element('stats-prev').addEventListener('click', () => changePage(state.page - 1));
  element('stats-next').addEventListener('click', () => changePage(state.page + 1));
  element<HTMLSelectElement>('stats-page').addEventListener('change', event => changePage(Number((event.target as HTMLSelectElement).value)));
  element('stats-share').addEventListener('click', async () => {
    const status = element('stats-share-status');
    // The link describes the applied filters, even while a new name is being typed.
    const url = writeStatsView(new URL(window.location.href), state).href;
    try {
      await navigator.clipboard.writeText(url);
      status.textContent = 'Ссылка на текущую выборку скопирована.';
    } catch {
      status.replaceChildren();
      const label = document.createElement('label');
      label.htmlFor = 'stats-share-link';
      label.textContent = 'Скопируйте ссылку вручную:';
      const input = document.createElement('input');
      input.id = 'stats-share-link'; input.type = 'url'; input.readOnly = true; input.value = url;
      status.append(label, input); input.focus(); input.select();
    }
  });
  window.addEventListener('popstate', () => {
    state = readStatsView(window.location.search); resetHints(); render();
  });
  void loadData();
}
