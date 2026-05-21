import type { FetchProgress } from "../types";

type ArchiveResponse = { archives?: string[] };
type ProfileResponse = { username?: string; joined?: number; avatar?: string; title?: string; followers?: number };

const API_ROOT = "https://api.chess.com/pub";

export async function fetchChessComPgn(
  username: string,
  options: {
    startYear?: number;
    endYear?: number;
    delayMs?: number;
    onProgress?: (progress: FetchProgress) => void;
  } = {}
) {
  const clean = username.trim().toLowerCase();
  if (!clean) throw new Error("Enter a Chess.com username.");

  const profile = await fetchJson<ProfileResponse>(`/player/${encodeURIComponent(clean)}`);
  const archivesResponse = await fetchJson<ArchiveResponse>(`/player/${encodeURIComponent(clean)}/games/archives`);
  const archives = archivesResponse.archives ?? [];
  const joinYear = profile.joined ? new Date(profile.joined * 1000).getUTCFullYear() : 2007;
  const startYear = options.startYear ?? joinYear;
  const endYear = options.endYear ?? new Date().getUTCFullYear();
  const filtered = archives.filter((archive) => {
    const year = archiveYear(archive);
    return year >= startYear && year <= endYear;
  });

  if (!filtered.length) throw new Error(`No Chess.com archives found for ${clean} in ${startYear}-${endYear}.`);

  const parts: string[] = [];
  let gamesFound = 0;
  options.onProgress?.({ archivesFound: filtered.length, archivesDone: 0, gamesFound, label: "Found archives" });

  for (let index = 0; index < filtered.length; index += 1) {
    const archive = filtered[index];
    const label = archiveLabel(archive);
    options.onProgress?.({ archivesFound: filtered.length, archivesDone: index, gamesFound, label: `Downloading ${label}` });
    const pgn = (await fetchText(`${proxyPath(new URL(archive).pathname)}/pgn`)).trim();
    if (pgn) {
      parts.push(pgn);
      gamesFound += (pgn.match(/\[Event\s+"/g) ?? []).length;
    }
    options.onProgress?.({ archivesFound: filtered.length, archivesDone: index + 1, gamesFound, label });
    if (options.delayMs) await sleep(options.delayMs);
  }

  return {
    username: profile.username ?? clean,
    profile,
    pgn: `${parts.join("\n\n")}\n`,
    archives: filtered,
    startYear,
    endYear,
    gamesFound,
  };
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetchWithFallback(path, "application/json");
  return response.json();
}

async function fetchText(path: string): Promise<string> {
  const response = await fetchWithFallback(path, "application/x-chess-pgn,text/plain,*/*");
  return response.text();
}

async function fetchWithFallback(path: string, accept: string) {
  const normalizedPath = proxyPath(path);
  const proxied = `/.netlify/functions/chesscom?path=${encodeURIComponent(normalizedPath)}`;
  const direct = `${API_ROOT}${normalizedPath}`;

  try {
    const response = await fetch(proxied, { headers: { Accept: accept } });
    if (response.ok && response.headers.get("content-type") !== "text/html") return response;
  } catch {
    // Local Vite dev does not have Netlify functions unless run through netlify dev.
  }

  const response = await fetch(direct, { headers: { Accept: accept } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} from Chess.com`);
  return response;
}

function proxyPath(path: string) {
  if (path.startsWith(API_ROOT)) return new URL(path).pathname;
  return path.startsWith("/pub/") ? path.slice(4) : path.startsWith("/") ? path : `/${path}`;
}

function archiveYear(url: string) {
  const parts = url.replace(/\/$/, "").split("/");
  return Number(parts.at(-2));
}

function archiveLabel(url: string) {
  const parts = url.replace(/\/$/, "").split("/");
  return `${parts.at(-2)}-${parts.at(-1)}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
