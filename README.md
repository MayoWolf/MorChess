# MorChess

A Vite + React dashboard for Chess.com PGN history.

## Run locally

```sh
npm install
npm run dev
```

Type a Chess.com username and pull PGNs from the public monthly archive endpoints, or import an existing `.pgn` file.

## Build

```sh
npm run build
```

## Netlify

Netlify uses `netlify/functions/chesscom.js` as a small proxy for Chess.com API requests. The app falls back to direct Chess.com requests during local Vite development.
# MorChess
