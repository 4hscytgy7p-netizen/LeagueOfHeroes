import { readFileSync } from 'fs';
import { join } from 'path';

export interface Participant {
  name: string;
  progress: number;
}

export interface Party {
  id: number;
  gm: string;
  gmProgress: number;
  players: Participant[];
  playerCount: number;
  totalPlayerProgress: number;
  totalProgress: number;
}

export interface StatEntry {
  name: string;
  games: number;
  totalProgress: number;
}

export interface PairStat {
  gm: string;
  player: string;
  games: number;
  totalProgress: number;
}

export interface GameStatsResult {
  parties: Party[];
  stats: {
    totalParties: number;
    uniqueGMs: string[];
    uniquePlayers: string[];
    totalPlayers: number;
    averagePlayersPerParty: number;
    topPlayersByParticipation: StatEntry[];
    bottomPlayersByParticipation: StatEntry[];
    topPlayersByProgress: StatEntry[];
    topGMsByGames: StatEntry[];
    topGMsByProgress: StatEntry[];
    topPairs: PairStat[];
    hasTimeData: boolean;
  };
}

const CSV_PATH = join(process.cwd(), 'stats.csv');

function parseCsv(csv: string): Party[] {
  const rows = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return rows.map((rawRow, index) => {
    const columns = rawRow.split(';').map((value) => value.trim());
    const lastNonEmptyIndex = columns.length - 1 - [...columns].reverse().findIndex((value) => value.length > 0);
    const values = lastNonEmptyIndex >= 0 ? columns.slice(0, lastNonEmptyIndex + 1) : columns;

    const gm = values[0] || 'Unknown';
    const gmProgress = parseInt(values[1] || '0', 10) || 0;
    const players: Participant[] = [];

    for (let i = 2; i + 1 < values.length; i += 2) {
      const name = values[i];
      if (!name) continue;
      const progress = parseInt(values[i + 1] || '0', 10) || 0;
      players.push({ name, progress });
    }

    const totalPlayerProgress = players.reduce((sum, player) => sum + player.progress, 0);
    const totalProgress = gmProgress + totalPlayerProgress;

    return {
      id: index + 1,
      gm,
      gmProgress,
      players,
      playerCount: players.length,
      totalPlayerProgress,
      totalProgress
    };
  });
}

function sortEntriesByProgress(entries: StatEntry[], descending = true) {
  return [...entries].sort((a, b) => {
    if (a.totalProgress !== b.totalProgress) return descending ? b.totalProgress - a.totalProgress : a.totalProgress - b.totalProgress;
    if (a.games !== b.games) return descending ? b.games - a.games : a.games - b.games;
    return a.name.localeCompare(b.name, 'ru');
  });
}

function sortEntriesByGames(entries: StatEntry[], descending = true) {
  return [...entries].sort((a, b) => {
    if (a.games !== b.games) return descending ? b.games - a.games : a.games - b.games;
    if (a.totalProgress !== b.totalProgress) return descending ? b.totalProgress - a.totalProgress : a.totalProgress - b.totalProgress;
    return a.name.localeCompare(b.name, 'ru');
  });
}

export function analyzeGameStats(): GameStatsResult {
  const raw = readFileSync(CSV_PATH, 'utf-8');
  const parties = parseCsv(raw);

  const gmMap = new Map<string, StatEntry>();
  const playerMap = new Map<string, StatEntry>();
  const pairMap = new Map<string, PairStat>();

  parties.forEach((party) => {
    const gmEntry = gmMap.get(party.gm) ?? { name: party.gm, games: 0, totalProgress: 0 };
    gmEntry.games += 1;
    gmEntry.totalProgress += party.gmProgress;
    gmMap.set(party.gm, gmEntry);

    party.players.forEach((player) => {
      const playerEntry = playerMap.get(player.name) ?? { name: player.name, games: 0, totalProgress: 0 };
      playerEntry.games += 1;
      playerEntry.totalProgress += player.progress;
      playerMap.set(player.name, playerEntry);

      const key = `${party.gm}|||${player.name}`;
      const pairEntry = pairMap.get(key) ?? { gm: party.gm, player: player.name, games: 0, totalProgress: 0 };
      pairEntry.games += 1;
      pairEntry.totalProgress += player.progress;
      pairMap.set(key, pairEntry);
    });
  });

  const totalParties = parties.length;
  const totalPlayers = Array.from(playerMap.values()).reduce((sum, entry) => sum + entry.games, 0);
  const averagePlayersPerParty = totalParties > 0
    ? Math.round((parties.reduce((sum, party) => sum + party.playerCount, 0) / totalParties) * 100) / 100
    : 0;

  const uniqueGMs = Array.from(gmMap.keys()).sort((a, b) => a.localeCompare(b, 'ru'));
  const uniquePlayers = Array.from(playerMap.keys()).sort((a, b) => a.localeCompare(b, 'ru'));

  return {
    parties,
    stats: {
      totalParties,
      uniqueGMs,
      uniquePlayers,
      totalPlayers,
      averagePlayersPerParty,
      topPlayersByParticipation: sortEntriesByGames(Array.from(playerMap.values())).slice(0, 8),
      bottomPlayersByParticipation: sortEntriesByGames(Array.from(playerMap.values()), false).slice(0, 8),
      topPlayersByProgress: sortEntriesByProgress(Array.from(playerMap.values())).slice(0, 8),
      topGMsByGames: sortEntriesByGames(Array.from(gmMap.values())).slice(0, 8),
      topGMsByProgress: sortEntriesByProgress(Array.from(gmMap.values())).slice(0, 8),
      topPairs: Array.from(pairMap.values())
        .sort((a, b) => {
          if (a.games !== b.games) return b.games - a.games;
          if (a.totalProgress !== b.totalProgress) return b.totalProgress - a.totalProgress;
          if (a.gm !== b.gm) return a.gm.localeCompare(b.gm, 'ru');
          return a.player.localeCompare(b.player, 'ru');
        })
        .slice(0, 10),
      hasTimeData: false
    }
  };
}
