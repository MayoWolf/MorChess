import type { ChessGame, Color, ResultKind, TimeClass, TimeSheet } from "../types";

type Headers = Record<string, string>;

const resultMap: Record<string, { white: ResultKind; black: ResultKind }> = {
  "1-0": { white: "win", black: "loss" },
  "0-1": { white: "loss", black: "win" },
  "1/2-1/2": { white: "draw", black: "draw" },
};

export function parsePgn(pgn: string, username: string): ChessGame[] {
  const lowerUser = username.trim().toLowerCase();
  if (!lowerUser) return [];

  return splitGames(pgn)
    .map((raw) => parseGame(raw, lowerUser))
    .filter((game): game is ChessGame => Boolean(game))
    .sort((a, b) => a.timestamp - b.timestamp);
}

function splitGames(pgn: string) {
  return pgn
    .replace(/\r\n/g, "\n")
    .split(/\n(?=\[Event\s+")/g)
    .map((game) => game.trim())
    .filter(Boolean);
}

function parseGame(raw: string, lowerUser: string): ChessGame | null {
  const headers = parseHeaders(raw);
  const white = headers.White ?? "";
  const black = headers.Black ?? "";
  const userColor: Color | null =
    white.toLowerCase() === lowerUser ? "white" : black.toLowerCase() === lowerUser ? "black" : null;

  if (!userColor) return null;

  const date = normalizeDate(headers.UTCDate || headers.Date, headers.UTCTime || headers.StartTime);
  if (!date) return null;

  const timestamp = Date.parse(date);
  const result = resultMap[headers.Result ?? ""]?.[userColor] ?? "draw";
  const userElo = numberOrNull(userColor === "white" ? headers.WhiteElo : headers.BlackElo);
  const opponentElo = numberOrNull(userColor === "white" ? headers.BlackElo : headers.WhiteElo);
  const moveText = raw.slice(raw.indexOf("\n\n") + 2);
  const plyCount = countPly(moveText);
  const clocks = estimateClockUse(moveText, headers.TimeControl, userColor);
  const link = headers.Link ?? null;
  const month = date.slice(0, 7);
  const timeControl = headers.TimeControl ?? "-";

  return {
    id: link ?? `${date}-${white}-${black}-${headers.Result ?? "unknown"}`,
    url: link,
    date,
    timestamp,
    year: Number(date.slice(0, 4)),
    month,
    white,
    black,
    userColor,
    opponent: userColor === "white" ? black : white,
    result,
    resultText: headers.Result ?? "*",
    userElo,
    opponentElo,
    eloDiff: userElo !== null && opponentElo !== null ? userElo - opponentElo : null,
    timeControl,
    timeClass: classifyTime(timeControl),
    timeSheet: classifyTimeSheet(timeControl),
    eco: headers.ECO ?? null,
    opening: parseOpening(headers.ECOUrl),
    termination: headers.Termination ?? null,
    plyCount,
    moveCount: Math.ceil(plyCount / 2),
    userClockSeconds: clocks.userSeconds,
    opponentClockSeconds: clocks.opponentSeconds,
    raw,
  };
}

function parseHeaders(raw: string): Headers {
  const headers: Headers = {};
  const headerPattern = /^\[([A-Za-z0-9_]+)\s+"((?:\\"|[^"])*)"\]$/gm;
  for (const match of raw.matchAll(headerPattern)) {
    headers[match[1]] = match[2].replace(/\\"/g, '"');
  }
  return headers;
}

function normalizeDate(dateTag?: string, timeTag?: string) {
  if (!dateTag || dateTag.includes("?")) return null;
  const date = dateTag.replace(/\./g, "-");
  const time = timeTag && !timeTag.includes("?") ? timeTag : "00:00:00";
  return `${date}T${time}Z`;
}

function numberOrNull(value?: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function classifyTime(timeControl: string): TimeClass {
  if (!timeControl || timeControl === "-") return "other";
  if (timeControl.includes("/")) return "daily";
  const base = Number(timeControl.split("+")[0]);
  if (!Number.isFinite(base)) return "other";
  if (base < 180) return "bullet";
  if (base < 600) return "blitz";
  if (base < 3600) return "rapid";
  return "daily";
}

function classifyTimeSheet(timeControl: string): TimeSheet {
  if (!timeControl || timeControl === "-") return "other";
  if (timeControl.includes("/")) return "daily";
  const base = Number(timeControl.split("+")[0]);
  if (!Number.isFinite(base)) return "other";
  if (base === 120) return "2m";
  if (base === 180) return "3m";
  if (base === 300) return "5m";
  if (base === 600) return "10m";
  if (base >= 86400) return "daily";
  return "other";
}

function parseOpening(ecoUrl?: string) {
  if (!ecoUrl) return null;
  const slug = ecoUrl.split("/").filter(Boolean).at(-1);
  if (!slug) return null;
  return decodeURIComponent(slug).replace(/-/g, " ");
}

function countPly(moveText: string) {
  const stripped = moveText
    .replace(/\{[^}]*\}/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\$\d+/g, " ")
    .replace(/\d+\.(\.\.)?/g, " ")
    .replace(/\b(1-0|0-1|1\/2-1\/2|\*)\b/g, " ");

  return stripped.split(/\s+/).filter((token) => token && !/^\d+$/.test(token)).length;
}

function estimateClockUse(moveText: string, timeControl: string, userColor: Color) {
  const base = Number(timeControl.split("+")[0]);
  const increment = Number(timeControl.split("+")[1] ?? 0);
  if (!Number.isFinite(base) || timeControl.includes("/")) {
    return { userSeconds: null, opponentSeconds: null };
  }

  const clocks = [...moveText.matchAll(/\[%clk\s+([0-9:.]+)\]/g)].map((match) => clockToSeconds(match[1]));
  if (clocks.length < 2) return { userSeconds: null, opponentSeconds: null };

  const previous = { white: base, black: base };
  const spent = { white: 0, black: 0 };

  clocks.forEach((clock, index) => {
    const color: Color = index % 2 === 0 ? "white" : "black";
    const used = previous[color] + increment - clock;
    if (used > 0 && used < base * 2) spent[color] += used;
    previous[color] = clock;
  });

  return {
    userSeconds: Math.round(spent[userColor]),
    opponentSeconds: Math.round(spent[userColor === "white" ? "black" : "white"]),
  };
}

function clockToSeconds(clock: string) {
  const parts = clock.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] ?? 0;
}
