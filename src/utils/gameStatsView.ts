import { summarizeGameStats } from './gameStats.ts';
import type { GameStatsResult, Party } from './gameStats.ts';

export type ChartMetric = 'players_games' | 'players_progress' | 'gms_games' | 'gms_progress';
export type RankingKind = 'players' | 'gms' | 'pairs';
export type PartySort = 'id' | 'gm' | 'playerCount' | 'totalProgress';
export interface StatsViewState {
  gm: string;
  player: string;
  chart: 'bar' | 'pie';
  metric: ChartMetric;
  ranking: RankingKind;
  measure: 'games' | 'progress';
  showAll: boolean;
  sort: PartySort;
  direction: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

export const DEFAULT_STATS_VIEW: StatsViewState = {
  gm: '', player: '', chart: 'bar', metric: 'players_games',
  ranking: 'players', measure: 'games', showAll: false,
  sort: 'id', direction: 'desc', page: 1, pageSize: 25
};

export const CHART_METRICS: Record<ChartMetric, { title: string; unit: string; share: string }> = {
  players_games: { title: 'Игроки по числу участий', unit: 'участий', share: 'Доля от всех участий игроков' },
  players_progress: { title: 'Игроки по суммарному ОП', unit: 'ОП', share: 'Доля от ОП всех игроков' },
  gms_games: { title: 'Мастера по числу партий', unit: 'партий', share: 'Доля от всех партий' },
  gms_progress: { title: 'Мастера по суммарному ОП', unit: 'ОП', share: 'Доля от ОП всех мастеров' }
};

function oneOf<T extends string>(value: string | null, values: readonly T[], fallback: T): T {
  return values.includes(value as T) ? value as T : fallback;
}

export function readStatsView(search: string): StatsViewState {
  const params = new URLSearchParams(search);
  const page = Number(params.get('page'));
  const size = Number(params.get('size'));
  return {
    gm: params.get('gm') ?? '', player: params.get('player') ?? '',
    chart: oneOf(params.get('chart'), ['bar', 'pie'], 'bar'),
    metric: oneOf(params.get('metric'), ['players_games', 'players_progress', 'gms_games', 'gms_progress'], 'players_games'),
    ranking: oneOf(params.get('ranking'), ['players', 'gms', 'pairs'], 'players'),
    measure: oneOf(params.get('measure'), ['games', 'progress'], 'games'),
    showAll: params.get('all') === '1',
    sort: oneOf(params.get('sort'), ['id', 'gm', 'playerCount', 'totalProgress'], 'id'),
    direction: oneOf(params.get('direction'), ['asc', 'desc'], 'desc'),
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
    pageSize: [10, 25, 50].includes(size) ? size : 25
  };
}

export function writeStatsView(url: URL, state: StatsViewState): URL {
  const result = new URL(url);
  const values = {
    gm: state.gm, player: state.player, chart: state.chart === 'bar' ? '' : state.chart,
    metric: state.metric === 'players_games' ? '' : state.metric,
    ranking: state.ranking === 'players' ? '' : state.ranking,
    measure: state.measure === 'games' ? '' : state.measure,
    all: state.showAll ? '1' : '', sort: state.sort === 'id' ? '' : state.sort,
    direction: state.direction === 'desc' ? '' : state.direction,
    page: state.page === 1 ? '' : String(state.page), size: state.pageSize === 25 ? '' : String(state.pageSize)
  };
  for (const [key, value] of Object.entries(values)) {
    if (value) result.searchParams.set(key, value);
    else result.searchParams.delete(key);
  }
  return result;
}

export function filterStatsParties(parties: Party[], state: Pick<StatsViewState, 'gm' | 'player'>): Party[] {
  return parties.filter(party => (!state.gm || party.gm === state.gm)
    && (!state.player || party.players.some(player => player.name === state.player)));
}

export interface ChartEntry { label: string; value: number; other?: boolean }

export function buildStatsChart(result: GameStatsResult, metric: ChartMetric): ChartEntry[] {
  const entries = metric.startsWith('players') ? result.rankings.players : result.rankings.gms;
  return entries.map(entry => ({
    label: entry.name, value: metric.endsWith('progress') ? entry.totalProgress : entry.games
  })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, 'ru'));
}

// Retain the full denominator by grouping the tail, rather than dropping it.
export function groupStatsPie(entries: ChartEntry[], limit = 6): ChartEntry[] {
  const positive = entries.filter(entry => entry.value > 0);
  if (positive.length <= limit) return positive;
  const other = positive.slice(limit).reduce((sum, entry) => sum + entry.value, 0);
  return [...positive.slice(0, limit), { label: 'Другие', value: other, other: true }];
}

export function getStatsRanking(result: GameStatsResult, state: Pick<StatsViewState, 'ranking' | 'measure'>) {
  const rows = state.ranking === 'pairs'
    ? result.rankings.pairs.map(pair => ({ name: `${pair.gm} / ${pair.player}`, ...pair }))
    : result.rankings[state.ranking].map(entry => ({ ...entry, gm: '', player: '' }));
  return rows.sort((a, b) => {
    const primary = state.measure === 'games' ? b.games - a.games : b.totalProgress - a.totalProgress;
    const secondary = state.measure === 'games' ? b.totalProgress - a.totalProgress : b.games - a.games;
    return primary || secondary || a.name.localeCompare(b.name, 'ru');
  });
}

export function getStatsPartyPage(parties: Party[], state: Pick<StatsViewState, 'sort' | 'direction' | 'page' | 'pageSize'>) {
  const sorted = [...parties].sort((a, b) => {
    const delta = state.sort === 'gm'
      ? a.gm.localeCompare(b.gm, 'ru') : a[state.sort] - b[state.sort];
    return (state.direction === 'asc' ? delta : -delta) || b.id - a.id;
  });
  const pages = Math.max(1, Math.ceil(parties.length / state.pageSize));
  const page = Math.min(Math.max(1, state.page), pages);
  const start = (page - 1) * state.pageSize;
  return { parties: sorted.slice(start, start + state.pageSize), page, pages, start };
}

export function getStatsPlayerCard(parties: Party[], name: string) {
  const played = parties.filter(party => party.players.some(player => player.name === name));
  const totalProgress = played.reduce((sum, party) => sum
    + party.players.filter(player => player.name === name).reduce((total, player) => total + player.progress, 0), 0);
  return {
    games: played.length, totalProgress,
    averageProgress: played.length ? totalProgress / played.length : 0,
    gms: new Set(played.map(party => party.gm)).size,
    partners: new Set(played.flatMap(party => party.players.map(player => player.name)).filter(player => player !== name)).size
  };
}

export function getFilteredStats(parties: Party[], state: Pick<StatsViewState, 'gm' | 'player'>) {
  return summarizeGameStats(filterStatsParties(parties, state));
}
