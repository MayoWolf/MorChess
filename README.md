<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="React 19" />
  <img src="https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white" alt="Vite 6" />
  <img src="https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Recharts-2.15-FF6384?logo=chartdotjs&logoColor=white" alt="Recharts" />
  <img src="https://img.shields.io/badge/Deployed-Netlify-00C7B7?logo=netlify&logoColor=white" alt="Netlify" />
</p>

<h1 align="center">♟️ MorChess</h1>

<p align="center">
  <strong>Your Chess.com history, turned into rating trendlines and habits you can actually read.</strong>
</p>

<p align="center">
  <a href="https://morchess.netlify.app">Live App</a>
</p>

---

## What is MorChess?

MorChess is a client-side analytics dashboard that pulls your entire Chess.com game archive and transforms it into interactive visualizations. No server stores your data — everything runs in the browser.

Enter your username, hit pull, and within seconds you get a full breakdown of your chess career: rating curves, time-of-day habits, opening repertoire stats, opponent history, win/loss streaks, and a GitHub-style activity heatmap.

---

## Features

| Category | What you get |
|----------|-------------|
| **ELO Trend** | Interactive area chart showing your rating over time with zoom by range |
| **Monthly Volume** | Bar chart of games played per month |
| **Results Breakdown** | Stacked win/draw/loss bars by month |
| **Time-Control Sheets** | Separate views for Bullet (2m), Blitz (3m, 5m), Rapid (10m), and Daily |
| **Opening Signals** | Top openings ranked by frequency and score percentage |
| **Frequent Opponents** | Who you play most and your record against them |
| **Activity Heatmap** | Year-by-year daily activity grid — click any square for that day's breakdown |
| **White/Black Split** | Color distribution and performance comparison |
| **UTC Time of Day** | When you play most and how it correlates with performance |
| **Streaks** | Best win streak and longest losing skid |
| **Clock Usage** | Total time spent from `[%clk]` PGN comments |
| **Profile View** | At-a-glance summary of your peak rating, total games, and score |

---

## Tech Stack

```
React 19          — UI framework
TypeScript 5.7    — Type safety across the entire codebase
Vite 6            — Dev server + production bundler
Recharts 2.15     — Composable chart components
Lucide React      — Icon system
date-fns          — Date utilities
Netlify Functions — CORS proxy for Chess.com API
```

---

## Architecture

```
src/
├── App.tsx              — Main app shell, views, state management
├── main.tsx             — React entry point
├── styles.css           — Full design system (dark theme, responsive)
├── types.ts             — Shared TypeScript types
└── lib/
    ├── chesscom.ts      — Chess.com API client with progress streaming
    ├── pgn.ts           — PGN parser (headers + clock comments)
    └── stats.ts         — All statistical computations and data transforms

netlify/
└── functions/
    └── chesscom.js      — Serverless proxy to bypass CORS restrictions
```

**Data flow:**

```
Chess.com API → fetch archives → download PGNs → parse headers/clocks → compute stats → render charts
```

Everything is computed client-side with `useMemo` hooks. No database, no auth, no tracking.

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Install & Run

```sh
git clone https://github.com/MayoWolf/MorChess.git
cd MorChess
npm install
npm run dev
```

Open `http://127.0.0.1:5173` and enter any Chess.com username.

### Production Build

```sh
npm run build
npm run preview
```

---

## Deployment

MorChess is deployed on [Netlify](https://netlify.com). The `netlify.toml` config handles:

- Build command: `npm run build`
- Publish directory: `dist`
- Serverless function: `netlify/functions/chesscom.js`

The Netlify function acts as a lightweight proxy to the Chess.com public API, avoiding CORS issues in production. During local development, the app falls back to direct API requests.

---

## How It Works

1. **Archive Discovery** — Hits `api.chess.com/pub/player/{username}/games/archives` to get all monthly archive URLs
2. **PGN Download** — Iterates through each archive, downloading the PGN text with a small delay to respect rate limits
3. **Parsing** — Extracts game metadata from PGN headers (`[White]`, `[Black]`, `[Result]`, `[ECO]`, `[TimeControl]`, etc.) and clock data from move comments
4. **Time-Control Classification** — Maps raw time controls to sheets (2m, 3m, 5m, 10m, daily) for separated analysis
5. **Statistical Computation** — Calculates ELO trends, win rates, streaks, opening performance, opponent records, hourly distribution, and more
6. **Visualization** — Renders everything through Recharts with a responsive dark theme

---

## Design Philosophy

- **Zero backend** — Your data never leaves your browser
- **Instant feedback** — Progress bar streams as archives download
- **Separated sheets** — Bullet and rapid are different games; analyze them separately
- **Dense information** — Every pixel earns its place on screen
- **Mobile-first responsive** — Full functionality on phones with adapted layouts
- **Dark theme** — Easy on the eyes during late-night analysis sessions

---

## Contributing

PRs welcome. If you want to add a new stat or visualization:

1. Add the computation to `src/lib/stats.ts`
2. Wire it into `App.tsx` with a `useMemo` hook
3. Render it in the dashboard grid

---

## License

MIT

---

<p align="center">
  Built by <a href="https://github.com/MayoWolf">MayoWolf</a>
</p>
