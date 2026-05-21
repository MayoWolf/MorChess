export type ResultKind = "win" | "loss" | "draw";
export type Color = "white" | "black";
export type TimeClass = "bullet" | "blitz" | "rapid" | "daily" | "other";
export type TimeSheet = "2m" | "3m" | "5m" | "10m" | "daily" | "other";
export type RangeKey = "all" | "365d" | "90d" | "30d" | "year";

export type ChessGame = {
  id: string;
  url: string | null;
  date: string;
  timestamp: number;
  year: number;
  month: string;
  white: string;
  black: string;
  userColor: Color;
  opponent: string;
  result: ResultKind;
  resultText: string;
  userElo: number | null;
  opponentElo: number | null;
  eloDiff: number | null;
  timeControl: string;
  timeClass: TimeClass;
  timeSheet: TimeSheet;
  eco: string | null;
  opening: string | null;
  termination: string | null;
  plyCount: number;
  moveCount: number;
  userClockSeconds: number | null;
  opponentClockSeconds: number | null;
  raw: string;
};

export type ParseSummary = {
  username: string;
  totalGames: number;
  firstDate: string | null;
  lastDate: string | null;
  importedAt: string;
};

export type FetchProgress = {
  archivesFound: number;
  archivesDone: number;
  gamesFound: number;
  label: string;
};
