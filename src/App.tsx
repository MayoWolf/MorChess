import {
  Activity,
  BarChart3,
  CalendarClock,
  Crown,
  Download,
  FileUp,
  Gauge,
  GitBranch,
  Hourglass,
  RefreshCw,
  Search,
  Swords,
  Target,
  Timer,
  Trophy,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fetchChessComPgn } from "./lib/chesscom";
import { parsePgn } from "./lib/pgn";
import {
  availableTimeSheets,
  availableYears,
  bestDefaultTimeSheet,
  bucketByTimeSheet,
  colorSplit,
  eloSeries,
  filterByTimeSheet,
  filterGames,
  hourlyHeat,
  resultSeries,
  streaks,
  summarize,
  timeSheetLabels,
  topOpenings,
  topOpponents,
  volumeSeries,
} from "./lib/stats";
import type { ChessGame, FetchProgress, ParseSummary, RangeKey, TimeSheet } from "./types";

const ranges: Array<{ key: RangeKey; label: string }> = [
  { key: "all", label: "All" },
  { key: "365d", label: "1Y" },
  { key: "90d", label: "90D" },
  { key: "30d", label: "30D" },
  { key: "year", label: "Year" },
];

type ViewKey = "profile" | "analytics" | "games" | "settings";

export function App() {
  const [username, setUsername] = useState("mayowolf46");
  const [games, setGames] = useState<ChessGame[]>([]);
  const [summary, setSummary] = useState<ParseSummary | null>(null);
  const [range, setRange] = useState<RangeKey>("all");
  const [timeSheet, setTimeSheet] = useState<TimeSheet>("10m");
  const [activeView, setActiveView] = useState<ViewKey>("analytics");
  const [selectedYear, setSelectedYear] = useState(new Date().getUTCFullYear());
  const [startYear, setStartYear] = useState("");
  const [endYear, setEndYear] = useState(String(new Date().getUTCFullYear()));
  const [status, setStatus] = useState("Ready");
  const [progress, setProgress] = useState<FetchProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const availableSheets = useMemo(() => availableTimeSheets(games), [games]);
  const sheetGames = useMemo(() => filterByTimeSheet(games, timeSheet), [games, timeSheet]);
  const allRangedGames = useMemo(() => filterGames(games, range, selectedYear), [games, range, selectedYear]);
  const years = useMemo(() => availableYears(sheetGames.length ? sheetGames : games), [games, sheetGames]);
  const rangedGames = useMemo(() => filterGames(sheetGames, range, selectedYear), [range, selectedYear, sheetGames]);
  const totals = useMemo(() => summarize(rangedGames), [rangedGames]);
  const allTotals = useMemo(() => summarize(sheetGames), [sheetGames]);
  const eloRows = useMemo(() => eloSeries(rangedGames), [rangedGames]);
  const monthlyRows = useMemo(() => volumeSeries(rangedGames), [rangedGames]);
  const resultRows = useMemo(() => resultSeries(rangedGames), [rangedGames]);
  const timeRows = useMemo(() => bucketByTimeSheet(allRangedGames), [allRangedGames]);
  const colorRows = useMemo(() => colorSplit(rangedGames), [rangedGames]);
  const openingRows = useMemo(() => topOpenings(rangedGames), [rangedGames]);
  const opponentRows = useMemo(() => topOpponents(rangedGames), [rangedGames]);
  const hourRows = useMemo(() => hourlyHeat(rangedGames), [rangedGames]);
  const streakRows = useMemo(() => streaks(rangedGames), [rangedGames]);
  const recentGames = useMemo(() => [...rangedGames].slice(-5).reverse(), [rangedGames]);

  useEffect(() => {
    if (games.length && !availableSheets.includes(timeSheet)) {
      setTimeSheet(bestDefaultTimeSheet(games));
    }
  }, [availableSheets, games, timeSheet]);

  useEffect(() => {
    if (years.length && !years.includes(selectedYear)) {
      setSelectedYear(years[0]);
    }
  }, [selectedYear, years]);

  async function loadFromChessCom() {
    setError(null);
    setIsLoading(true);
    setStatus("Contacting Chess.com");
    setProgress(null);

    try {
      const result = await fetchChessComPgn(username, {
        startYear: startYear ? Number(startYear) : undefined,
        endYear: endYear ? Number(endYear) : undefined,
        delayMs: 120,
        onProgress: (next) => {
          setProgress(next);
          setStatus(next.label);
        },
      });
      ingestPgn(result.pgn, result.username);
      setStatus(`Loaded ${result.gamesFound.toLocaleString()} games`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load Chess.com data.");
      setStatus("Needs attention");
    } finally {
      setIsLoading(false);
    }
  }

  async function importFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setError(null);
    setIsLoading(true);
    setStatus("Reading PGN");
    try {
      const text = await file.text();
      ingestPgn(text, username);
      setStatus(`Imported ${file.name}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not import that PGN.");
      setStatus("Needs attention");
    } finally {
      setIsLoading(false);
    }
  }

  function ingestPgn(pgn: string, user: string) {
    const parsed = parsePgn(pgn, user);
    if (!parsed.length) throw new Error(`No games found for "${user}" in that PGN.`);
    setGames(parsed);
    const nextSheet = bestDefaultTimeSheet(parsed);
    const nextSheetGames = filterByTimeSheet(parsed, nextSheet);
    const nextYears = availableYears(nextSheetGames.length ? nextSheetGames : parsed);
    setTimeSheet(nextSheet);
    setSelectedYear(nextYears[0] ?? new Date().getUTCFullYear());
    setSummary({
      username: user,
      totalGames: parsed.length,
      firstDate: parsed[0]?.date ?? null,
      lastDate: parsed.at(-1)?.date ?? null,
      importedAt: new Date().toISOString(),
    });
  }

  function downloadPgn() {
    const blob = new Blob([games.map((game) => game.raw).join("\n\n")], { type: "application/x-chess-pgn" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${summary?.username ?? username}_mor_chess_export.pgn`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const progressPercent = progress?.archivesFound
    ? Math.round((progress.archivesDone / progress.archivesFound) * 100)
    : games.length
      ? 100
      : 0;

  return (
    <>
      <aside className="sideNav">
        <div className="sideProfile">
          <div className="avatarMark">
            <Crown size={28} aria-hidden="true" />
          </div>
          <h2>{summary?.username ?? (username || "GrandmasterPlayer")}</h2>
          <p>Rating: {formatNumber(allTotals.latestElo) ?? "-"} • {timeSheetLabels[timeSheet]}</p>
          <span>Active now</span>
        </div>
        <nav className="sideLinks" aria-label="Desktop navigation">
          <button className={activeView === "profile" ? "active" : ""} onClick={() => setActiveView("profile")} type="button">
            <Target size={20} />
            My Profile
          </button>
          <button className={activeView === "analytics" ? "active" : ""} onClick={() => setActiveView("analytics")} type="button">
            <BarChart3 size={20} />
            Analytics
          </button>
          <button className={activeView === "games" ? "active" : ""} onClick={() => setActiveView("games")} type="button">
            <Swords size={20} />
            Games
          </button>
          <button className={activeView === "settings" ? "active" : ""} onClick={() => setActiveView("settings")} type="button">
            <Gauge size={20} />
            Settings
          </button>
        </nav>
      </aside>

      <header className="mobileTopBar">
        <div>
          <span className="avatarMini">
            <Crown size={18} />
          </span>
          <strong>MorChess</strong>
        </div>
        <button type="button" aria-label="Search games" onClick={() => setActiveView("games")}>
          <Search size={22} />
        </button>
      </header>

      <main className="appMain">
      <header className="appHeader">
        <div>
          <span className="eyebrow">
            <Crown size={16} aria-hidden="true" />
            MorChess
          </span>
          <h1>Chess.com history, turned into rating trendlines and habits you can actually read.</h1>
        </div>

        <div className="rangeCluster">
          <div className="segmentedControl" aria-label="Time range">
            {ranges.map((item) => (
              <button
                className={range === item.key ? "active" : ""}
                key={item.key}
                onClick={() => setRange(item.key)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>
          <select value={selectedYear} onChange={(event) => setSelectedYear(Number(event.target.value))}>
            {(years.length ? years : [selectedYear]).map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      </header>

      <section className="sheetTabs" aria-label="Separated time-control sheets">
        <div>
          <span>Time-control sheet</span>
          <strong>{timeSheetLabels[timeSheet]}</strong>
        </div>
        <div className="sheetButtons">
          {(availableSheets.length ? availableSheets : (["2m", "3m", "5m", "10m", "daily"] as TimeSheet[])).map((sheet) => (
            <button
              className={sheet === timeSheet ? "active" : ""}
              disabled={Boolean(games.length) && !availableSheets.includes(sheet)}
              key={sheet}
              onClick={() => setTimeSheet(sheet)}
              type="button"
            >
              {timeSheetLabels[sheet]}
              {games.length ? <span>{filterByTimeSheet(games, sheet).length.toLocaleString()}</span> : null}
            </button>
          ))}
        </div>
      </section>

      {activeView === "analytics" ? (
        <>
      <section className="commandGrid">
        <div className="commandDeck">
          <div className="deckHeader">
            <span className="microLabel">
              <Activity size={15} aria-hidden="true" />
              {status}
            </span>
            <span className="livePill">{progressPercent}%</span>
          </div>
          <div className="deckHero">
            <strong>{formatNumber(allTotals.latestElo) ?? "ELO"}</strong>
            <span>{timeSheetLabels[timeSheet]} latest rating</span>
          </div>
          <div className="progressTrack">
            <span style={{ width: `${progressPercent}%` }} />
          </div>
          <div className="deckStats">
            <MiniStat label={`${timeSheetLabels[timeSheet]} Games`} value={allTotals.games.toLocaleString()} />
            <MiniStat label="Peak" value={formatNumber(allTotals.bestElo) ?? "-"} />
            <MiniStat label="Record" value={`${allTotals.wins}-${allTotals.losses}-${allTotals.draws}`} />
          </div>
        </div>

        <form
          className="fetchPanel"
          onSubmit={(event) => {
            event.preventDefault();
            void loadFromChessCom();
          }}
        >
          <label>
            <span>Chess.com username</span>
            <div className="inputWrap">
              <Search size={17} aria-hidden="true" />
              <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="hikaru" />
            </div>
          </label>
          <div className="twoInputs">
            <label>
              <span>Start year</span>
              <input value={startYear} onChange={(event) => setStartYear(event.target.value)} placeholder="auto" />
            </label>
            <label>
              <span>End year</span>
              <input value={endYear} onChange={(event) => setEndYear(event.target.value)} placeholder="2026" />
            </label>
          </div>
          <button disabled={isLoading} type="submit">
            {isLoading ? <RefreshCw className="spin" size={18} /> : <GitBranch size={18} />}
            Pull PGNs
          </button>
        </form>

        <div className="importPanel">
          <label className="dropButton">
            <FileUp size={22} aria-hidden="true" />
            <span>Import PGN</span>
            <input accept=".pgn,.txt" type="file" onChange={(event) => void importFiles(event.target.files)} />
          </label>
          <button className="ghostButton" disabled={!games.length} onClick={downloadPgn} type="button">
            <Download size={18} />
            Export current PGN
          </button>
          <p>{summary ? `${formatDate(summary.firstDate)} to ${formatDate(summary.lastDate)}` : "Drop in your existing export anytime."}</p>
        </div>
      </section>

      {error ? <div className="errorBanner">{error}</div> : null}

      <section className="metricGrid">
        <Metric icon={<Trophy size={18} />} label="Score" value={`${totals.score}%`} detail={`${totals.winRate}% pure win rate`} />
        <Metric icon={<Gauge size={18} />} label="ELO change" value={signed(totals.eloChange)} detail="first to latest in range" />
        <Metric icon={<Target size={18} />} label="Average opponent" value={formatNumber(totals.avgOpponent) ?? "-"} detail="rated games only" />
        <Metric icon={<Swords size={18} />} label="Average length" value={totals.avgMoves ? `${totals.avgMoves} moves` : "-"} detail="based on PGN moves" />
        <Metric icon={<Hourglass size={18} />} label="Clock used" value={formatClock(totals.totalClock)} detail="from [%clk] comments" />
        <Metric icon={<Timer size={18} />} label="Best streak" value={`${streakRows.bestWins}W`} detail={`${streakRows.bestLosses}L longest skid`} />
      </section>

      {games.length ? (
        <section className="dashboardGrid">
          <ChartPanel title="ELO Trend" icon={<BarChart3 size={17} />}>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={eloRows}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" minTickGap={28} />
                <YAxis domain={["dataMin - 20", "dataMax + 20"]} width={44} />
                <Tooltip />
                <Area dataKey="elo" type="monotone" stroke="#9fd668" fill="#244400" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartPanel>

          <ChartPanel title="Monthly Volume" icon={<CalendarClock size={17} />}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyRows}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" minTickGap={24} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="games" fill="#81b64c" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartPanel>

          <ChartPanel title="Results By Month" icon={<Swords size={17} />}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={resultRows}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" minTickGap={24} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="win" stackId="a" fill="#81B64C" />
                <Bar dataKey="draw" stackId="a" fill="#91908E" />
                <Bar dataKey="loss" stackId="a" fill="#E64848" />
              </BarChart>
            </ResponsiveContainer>
          </ChartPanel>

          <ChartPanel title="Sheet Breakdown" icon={<Timer size={17} />}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={timeRows}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="games" radius={[5, 5, 0, 0]}>
                  {timeRows.map((_, index) => (
                    <Cell key={index} fill={["#9fd668", "#e9c349", "#4099FF", "#c2c9b6", "#91908E"][index % 5]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartPanel>

          <TablePanel title="Best Opening Signals" rows={openingRows} />
          <TablePanel title="Frequent Opponents" rows={opponentRows} />

          <ChartPanel title="White / Black Split" icon={<Target size={17} />}>
            <div className="splitGrid">
              {colorRows.map((row) => (
                <div className="splitCard" key={row.name}>
                  <span>{row.name}</span>
                  <strong>{row.share}%</strong>
                  <small>{row.games} games</small>
                </div>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={colorRows}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="share" fill="#9fd668" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartPanel>

          <ChartPanel title="UTC Time Of Day" icon={<Hourglass size={17} />}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={hourRows}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" interval={2} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="games" fill="#81b64c" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartPanel>
        </section>
      ) : (
        <section className="emptyStart">
          <Upload size={28} aria-hidden="true" />
          <h2>Pull a username or import your PGN export to light up the board.</h2>
          <p>The app reads Chess.com PGN headers and clock comments, then builds rating, time control, opening, color, opponent, and volume views locally in your browser.</p>
        </section>
      )}
        </>
      ) : null}

      {activeView === "games" ? <GameHistory games={[...rangedGames].slice(-80).reverse()} /> : null}

      {activeView === "profile" ? (
        <ProfilePage
          allGames={games.length}
          allTotals={allTotals}
          summary={summary}
          timeSheet={timeSheet}
          totals={totals}
        />
      ) : null}

      {activeView === "settings" ? (
        <SettingsPage
          endYear={endYear}
          isLoading={isLoading}
          onDownload={downloadPgn}
          onEndYearChange={setEndYear}
          onImport={importFiles}
          onLoad={loadFromChessCom}
          onResetFilters={() => {
            setRange("all");
            setTimeSheet(bestDefaultTimeSheet(games));
            setSelectedYear(availableYears(games)[0] ?? new Date().getUTCFullYear());
          }}
          onStartYearChange={setStartYear}
          onUsernameChange={setUsername}
          startYear={startYear}
          username={username}
          hasGames={Boolean(games.length)}
        />
      ) : null}
      </main>

      <nav className="mobileBottomNav" aria-label="Mobile navigation">
        <button className={activeView === "analytics" ? "active" : ""} onClick={() => setActiveView("analytics")} type="button">
          <BarChart3 size={22} />
          Overview
        </button>
        <button className={activeView === "games" ? "active" : ""} onClick={() => setActiveView("games")} type="button">
          <Swords size={22} />
          Games
        </button>
        <button className={activeView === "profile" ? "active" : ""} onClick={() => setActiveView("profile")} type="button">
          <Target size={22} />
          Profile
        </button>
        <button className={activeView === "settings" ? "active" : ""} onClick={() => setActiveView("settings")} type="button">
          <Gauge size={22} />
          Settings
        </button>
      </nav>
    </>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Metric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return (
    <article className="metricTile">
      <div>{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function ChartPanel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <article className="chartPanel">
      <div className="panelHeader">
        <span>{icon}</span>
        <h2>{title}</h2>
      </div>
      {children}
    </article>
  );
}

function TablePanel({ title, rows }: { title: string; rows: Array<{ name: string; games: number; wins: number; losses: number; draws: number; score: number }> }) {
  return (
    <article className="tablePanel">
      <div className="panelHeader">
        <span>
          <BarChart3 size={17} />
        </span>
        <h2>{title}</h2>
      </div>
      <div className="rankRows">
        {rows.map((row, index) => (
          <div className="rankRow" key={row.name}>
            <span>{index + 1}</span>
            <strong>{row.name}</strong>
            <small>{row.games} games</small>
            <em>{row.score}%</em>
          </div>
        ))}
      </div>
    </article>
  );
}

function GameHistory({ games }: { games: ChessGame[] }) {
  return (
    <section className="gamesPreview" id="games">
      <div className="gamesHeader">
        <div>
          <h2>Game History</h2>
          <p>Recent matches, openings, and rating swings.</p>
        </div>
        <button type="button">
          <Search size={17} />
          Filter
        </button>
      </div>
      <div className="gameRows">
        {games.map((game) => {
          const letter = game.result === "win" ? "W" : game.result === "loss" ? "L" : "D";
          const elo = game.eloDiff === null ? "" : `${game.eloDiff > 0 ? "+" : ""}${game.eloDiff} ELO`;
          return (
            <article className={`gameRow ${game.result}`} key={game.id}>
              <div className="resultBadge">{letter}</div>
              <div className="gameMeta">
                <div>
                  <span>{timeSheetLabels[game.timeSheet]} • {game.timeControl}</span>
                  {elo ? <em>{elo}</em> : null}
                </div>
                <strong>{game.opponent}</strong>
                <small>{game.opening ?? game.eco ?? "Unknown opening"} • {game.moveCount} moves</small>
              </div>
              <a href={game.url ?? "#"} target="_blank" rel="noreferrer">
                Analyze
              </a>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ProfilePage({
  allGames,
  allTotals,
  summary,
  timeSheet,
  totals,
}: {
  allGames: number;
  allTotals: ReturnType<typeof summarize>;
  summary: ParseSummary | null;
  timeSheet: TimeSheet;
  totals: ReturnType<typeof summarize>;
}) {
  return (
    <section className="profileGrid">
      <article className="profileHero">
        <div className="avatarMark profileAvatar">
          <Crown size={34} aria-hidden="true" />
        </div>
        <div>
          <span className="microLabel">My Profile</span>
          <h2>{summary?.username ?? "Chess.com player"}</h2>
          <p>{summary ? `${formatDate(summary.firstDate)} to ${formatDate(summary.lastDate)}` : "Pull or import games to build your profile."}</p>
        </div>
      </article>

      <Metric icon={<Gauge size={18} />} label={`${timeSheetLabels[timeSheet]} Rating`} value={formatNumber(allTotals.latestElo) ?? "-"} detail="latest rating in selected sheet" />
      <Metric icon={<Trophy size={18} />} label="Sheet Score" value={`${totals.score}%`} detail={`${totals.games.toLocaleString()} games in current range`} />
      <Metric icon={<Swords size={18} />} label="Total Imported" value={allGames.toLocaleString()} detail="all games across every sheet" />
      <Metric icon={<Target size={18} />} label="Peak Rating" value={formatNumber(allTotals.bestElo) ?? "-"} detail={timeSheetLabels[timeSheet]} />
    </section>
  );
}

function SettingsPage({
  endYear,
  hasGames,
  isLoading,
  onDownload,
  onEndYearChange,
  onImport,
  onLoad,
  onResetFilters,
  onStartYearChange,
  onUsernameChange,
  startYear,
  username,
}: {
  endYear: string;
  hasGames: boolean;
  isLoading: boolean;
  onDownload: () => void;
  onEndYearChange: (value: string) => void;
  onImport: (files: FileList | null) => void;
  onLoad: () => Promise<void>;
  onResetFilters: () => void;
  onStartYearChange: (value: string) => void;
  onUsernameChange: (value: string) => void;
  startYear: string;
  username: string;
}) {
  return (
    <section className="settingsGrid">
      <form
        className="fetchPanel settingsPanel"
        onSubmit={(event) => {
          event.preventDefault();
          void onLoad();
        }}
      >
        <div>
          <span className="microLabel">Settings</span>
          <h2>Data Source</h2>
        </div>
        <label>
          <span>Chess.com username</span>
          <div className="inputWrap">
            <Search size={17} aria-hidden="true" />
            <input value={username} onChange={(event) => onUsernameChange(event.target.value)} placeholder="hikaru" />
          </div>
        </label>
        <div className="twoInputs">
          <label>
            <span>Start year</span>
            <input value={startYear} onChange={(event) => onStartYearChange(event.target.value)} placeholder="auto" />
          </label>
          <label>
            <span>End year</span>
            <input value={endYear} onChange={(event) => onEndYearChange(event.target.value)} placeholder="2026" />
          </label>
        </div>
        <button disabled={isLoading} type="submit">
          {isLoading ? <RefreshCw className="spin" size={18} /> : <GitBranch size={18} />}
          Pull PGNs
        </button>
      </form>

      <article className="importPanel settingsPanel">
        <span className="microLabel">Manual Import</span>
        <label className="dropButton">
          <FileUp size={22} aria-hidden="true" />
          <span>Import PGN</span>
          <input accept=".pgn,.txt" type="file" onChange={(event) => onImport(event.target.files)} />
        </label>
        <button className="ghostButton" disabled={!hasGames} onClick={onDownload} type="button">
          <Download size={18} />
          Export current PGN
        </button>
        <button className="ghostButton" disabled={!hasGames} onClick={onResetFilters} type="button">
          <Gauge size={18} />
          Reset filters
        </button>
      </article>
    </section>
  );
}

function formatNumber(value: number | null) {
  return value === null ? null : value.toLocaleString();
}

function signed(value: number | null) {
  if (value === null) return "-";
  return value > 0 ? `+${value}` : String(value);
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function formatClock(value: number | null) {
  if (value === null) return "-";
  const hours = Math.floor(value / 3600);
  const minutes = Math.round((value % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}
