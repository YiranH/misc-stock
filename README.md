# NASDAQ‑100 Treemap (Next.js + d3-hierarchy)

A Finviz‑style treemap for the NASDAQ‑100 backed by live Yahoo Finance quotes and MongoDB caching.

## Setup
> Requires Node.js 18.17 or newer.

```bash
pnpm install
cp .env.example .env.local   # fill in MongoDB + refresh token
pnpm tsx scripts/refreshNdx.ts --force  # seed quotes
pnpm dev                     # http://localhost:3000
```

### Environment
- `MONGODB_URI` (required) — connection string used across the API, refresh script, and SWR-backed UI.
- `MONGODB_DB` (optional) — defaults to `stock-analyzer`.
- `REFRESH_TOKEN` — shared secret for `POST /api/ndx/refresh`.
- `SYMBOLS` (optional) — comma-separated ticker override; defaults to `data/nasdaq100_symbols.json`.
- `YAHOO_APP_ID` — optional Yahoo app id if you have one; not required for anonymous usage.

## Data refresh
- `GET /api/ndx` — delivers the latest cached quotes (auto-refreshes when stale; 15 min TTL).
- `POST /api/ndx/refresh` — forces a refresh when called with `X-Refresh-Token: <REFRESH_TOKEN>`.
- `pnpm tsx scripts/refreshNdx.ts --force` — CLI helper for Railway cron or local backfills (`--since <minutes>` to skip when fresh).

## What’s inside
- Next.js (App Router, TS)
- d3-hierarchy for treemap layout
- Zustand for UI state (hover/search/filter/zoom)
- SWR fetching the `/api/ndx` route
- Yahoo Finance integration + MongoDB persistence (`lib/yahoo`, `lib/repository`, `lib/services`)
- Tailwind for styles

## Files of interest
- `app/page.tsx` — data load, filters, responsive sizing
- `components/Treemap.tsx` — SVG layout & tiles
- `components/Tooltip.tsx`, `Spark.tsx`, `Legend.tsx`, `Controls.tsx`
- `lib/services/refreshQuotes.ts` — refresh/caching orchestration
- `lib/yahoo/client.ts` — Yahoo Finance fetch + normalization
- `lib/d3Treemap.ts` — typed treemap builder
- `lib/transform.ts` — roster → treemap hierarchy builder
- `data/nasdaq100_symbols.json` — default NASDAQ-100 ticker universe (override via `SYMBOLS`)
```
