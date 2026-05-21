import { subDays } from "date-fns";
import type { ChessGame, RangeKey, ResultKind, TimeClass, TimeSheet } from "../types";

export type Row = { name: string; games: number; wins: number; losses: number; draws: number; score: number };
export type EloPoint = { date: string; elo: number; games: number };
export type Bucket = { name: string; games: number; winRate: number; score: number };

export const timeSheetOrder: TimeSheet[] = ["2m", "3m", "5m", "10m", "daily", "other"];

export const timeSheetLabels: Record<TimeSheet, string> = {
  "2m": "Two minutes",
  "3m": "Three minutes",
  "5m": "Five minutes",
  "10m": "Ten minutes",
  daily: "Daily",
  other: "Other",
};

export function filterGames(games: ChessGame[], range: RangeKey, selectedYear: number) {
  if (range === "all") return games;
  if (range === "year") return games.filter((game) => game.year === selectedYear);

  const newest = games.at(-1)?.timestamp ?? Date.now();
  const days = range === "365d" ? 365 : range === "90d" ? 90 : 30;
  const cutoff = subDays(new Date(newest), days).getTime();
  return games.filter((game) => game.timestamp >= cutoff);
}

export function filterByTimeSheet(games: ChessGame[], timeSheet: TimeSheet) {
  return games.filter((game) => game.timeSheet === timeSheet);
}

export function availableTimeSheets(games: ChessGame[]) {
  const found = new Set(games.map((game) => game.timeSheet));
  return timeSheetOrder.filter((timeSheet) => found.has(timeSheet));
}

export function bestDefaultTimeSheet(games: ChessGame[]): TimeSheet {
  const available = availableTimeSheets(games);
  if (available.includes("10m")) return "10m";
  return available[0] ?? "10m";
}

export function summarize(games: ChessGame[]) {
  const wins = games.filter((game) => game.result === "win").length;
  const losses = games.filter((game) => game.result === "loss").length;
  const draws = games.filter((game) => game.result === "draw").length;
  const rated = games.filter((game) => game.userElo !== null);
  const firstElo = rated[0]?.userElo ?? null;
  const latestElo = rated.at(-1)?.userElo ?? null;
  const bestElo = maxOrNull(rated.map((game) => game.userElo));
  const avgOpponent = average(games.map((game) => game.opponentElo));
  const avgMoves = average(games.map((game) => game.moveCount));
  const totalClock = sum(games.map((game) => game.userClockSeconds));

  return {
    games: games.length,
    wins,
    losses,
    draws,
    score: scoreOf({ wins, losses, draws }),
    winRate: games.length ? Math.round((wins / games.length) * 100) : 0,
    firstElo,
    latestElo,
    bestElo,
    eloChange: firstElo !== null && latestElo !== null ? latestElo - firstElo : null,
    avgOpponent,
    avgMoves,
    totalClock,
  };
}

export function eloSeries(games: ChessGame[]): EloPoint[] {
  const daily = new Map<string, { elo: number; games: number }>();
  for (const game of games) {
    if (game.userElo === null) continue;
    const day = game.date.slice(0, 10);
    const prev = daily.get(day);
    daily.set(day, { elo: game.userElo, games: (prev?.games ?? 0) + 1 });
  }
  return [...daily.entries()].map(([date, value]) => ({ date, elo: value.elo, games: value.games }));
}

export function volumeSeries(games: ChessGame[]) {
  const monthly = new Map<string, { games: number; score: number; elo: number | null }>();
  for (const game of games) {
    const item = monthly.get(game.month) ?? { games: 0, score: 0, elo: null };
    item.games += 1;
    item.score += gameScore(game.result);
    if (game.userElo !== null) item.elo = game.userElo;
    monthly.set(game.month, item);
  }
  return [...monthly.entries()].map(([month, value]) => ({
    month,
    games: value.games,
    score: Math.round((value.score / value.games) * 100),
    elo: value.elo,
  }));
}

export function resultSeries(games: ChessGame[]) {
  const monthly = new Map<string, Record<ResultKind, number>>();
  for (const game of games) {
    const item = monthly.get(game.month) ?? { win: 0, loss: 0, draw: 0 };
    item[game.result] += 1;
    monthly.set(game.month, item);
  }
  return [...monthly.entries()].map(([month, value]) => ({ month, ...value }));
}

export function bucketByTimeClass(games: ChessGame[]): Bucket[] {
  const order: TimeClass[] = ["bullet", "blitz", "rapid", "daily", "other"];
  return order.map((timeClass) => bucket(timeClass, games.filter((game) => game.timeClass === timeClass))).filter((b) => b.games);
}

export function bucketByTimeSheet(games: ChessGame[]): Bucket[] {
  return timeSheetOrder
    .map((timeSheet) => bucket(timeSheetLabels[timeSheet], games.filter((game) => game.timeSheet === timeSheet)))
    .filter((b) => b.games);
}

export function bucketByColor(games: ChessGame[]): Bucket[] {
  return ["white", "black"].map((color) => bucket(color, games.filter((game) => game.userColor === color)));
}

export function colorSplit(games: ChessGame[]) {
  const white = games.filter((game) => game.userColor === "white").length;
  const black = games.length - white;
  const whitePct = games.length ? Math.round((white / games.length) * 100) : 0;
  return [
    { name: "white", games: white, share: whitePct },
    { name: "black", games: black, share: games.length ? 100 - whitePct : 0 },
  ];
}

export function topOpenings(games: ChessGame[], limit = 12): Row[] {
  const rows = new Map<string, Row>();
  for (const game of games) {
    const name = game.opening ?? game.eco ?? "Unknown opening";
    const row = rows.get(name) ?? { name, games: 0, wins: 0, losses: 0, draws: 0, score: 0 };
    row.games += 1;
    if (game.result === "win") row.wins += 1;
    if (game.result === "loss") row.losses += 1;
    if (game.result === "draw") row.draws += 1;
    rows.set(name, row);
  }
  return [...rows.values()]
    .map((row) => ({ ...row, score: scoreOf(row) }))
    .sort((a, b) => b.games - a.games || b.score - a.score)
    .slice(0, limit);
}

export function topOpponents(games: ChessGame[], limit = 10): Row[] {
  const rows = new Map<string, Row>();
  for (const game of games) {
    const row = rows.get(game.opponent) ?? { name: game.opponent, games: 0, wins: 0, losses: 0, draws: 0, score: 0 };
    row.games += 1;
    if (game.result === "win") row.wins += 1;
    if (game.result === "loss") row.losses += 1;
    if (game.result === "draw") row.draws += 1;
    rows.set(game.opponent, row);
  }
  return [...rows.values()]
    .map((row) => ({ ...row, score: scoreOf(row) }))
    .sort((a, b) => b.games - a.games || b.score - a.score)
    .slice(0, limit);
}

export function hourlyHeat(games: ChessGame[]) {
  const rows = Array.from({ length: 24 }, (_, hour) => ({ hour, games: 0, wins: 0 }));
  for (const game of games) {
    const hour = new Date(game.timestamp).getUTCHours();
    rows[hour].games += 1;
    if (game.result === "win") rows[hour].wins += 1;
  }
  return rows.map((row) => ({
    name: `${String(row.hour).padStart(2, "0")}:00`,
    games: row.games,
    winRate: row.games ? Math.round((row.wins / row.games) * 100) : 0,
  }));
}

export function streaks(games: ChessGame[]) {
  let currentWins = 0;
  let currentLosses = 0;
  let bestWins = 0;
  let bestLosses = 0;

  for (const game of games) {
    if (game.result === "win") {
      currentWins += 1;
      currentLosses = 0;
    } else if (game.result === "loss") {
      currentLosses += 1;
      currentWins = 0;
    } else {
      currentWins = 0;
      currentLosses = 0;
    }
    bestWins = Math.max(bestWins, currentWins);
    bestLosses = Math.max(bestLosses, currentLosses);
  }

  return { bestWins, bestLosses };
}

export function availableYears(games: ChessGame[]) {
  return [...new Set(games.map((game) => game.year))].sort((a, b) => b - a);
}

function bucket(name: string, games: ChessGame[]): Bucket {
  const summary = summarize(games);
  return { name, games: games.length, winRate: summary.winRate, score: summary.score };
}

function scoreOf(row: Pick<Row, "wins" | "losses" | "draws">) {
  const games = row.wins + row.losses + row.draws;
  return games ? Math.round(((row.wins + row.draws * 0.5) / games) * 100) : 0;
}

function gameScore(result: ResultKind) {
  return result === "win" ? 1 : result === "draw" ? 0.5 : 0;
}

function average(values: Array<number | null>) {
  const usable = values.filter((value): value is number => value !== null && Number.isFinite(value));
  return usable.length ? Math.round(usable.reduce((sum, value) => sum + value, 0) / usable.length) : null;
}

function sum(values: Array<number | null>) {
  const usable = values.filter((value): value is number => value !== null && Number.isFinite(value));
  return usable.length ? usable.reduce((acc, value) => acc + value, 0) : null;
}

function maxOrNull(values: Array<number | null>) {
  const usable = values.filter((value): value is number => value !== null && Number.isFinite(value));
  return usable.length ? Math.max(...usable) : null;
}
