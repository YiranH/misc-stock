# NASDAQ-100 Data Integration Plan

## 1. Objectives
- Replace mock treemap data with live NASDAQ-100 quotes sourced from Yahoo Finance (`yahoo-finance2`).
- Persist enriched fundamentals (market cap, PE, beta, EPS, dividend yield, 52w stats, volume, etc.) for UI tooltips and historical analysis.
- Provide resilient caching using MongoDB + in-memory cache to avoid rate limits and cold-start issues on Railway.
- Bundle an automated refresh flow suitable for Railway cron jobs while exposing an on-demand refresh endpoint.

## 2. High-Level Architecture
1. **Roster Metadata**: Use `data/nasdaq100_symbols.json` (or `SYMBOLS` env override) as the ticker universe; hydrate name/sector/industry from Yahoo.
2. **Yahoo Fetcher Layer**: Batched requests to Yahoo Finance for quote + sparkline + summary data, normalized into our `Quote` shape.
3. **Persistence Layer**: MongoDB collections for `quotes_latest`, `quotes_daily` (optional snapshots), and optional `sync_runs` for cron visibility.
4. **Caching**: In-memory cache (process lifetime) plus MongoDB serving as durable cache. Disk cache no longer required.
5. **API Surface**: `/api/ndx` GET for UI, `/api/ndx/refresh` POST for manual refresh (token-protected).
6. **Background Job**: `scripts/refreshNdx.ts` executed on Railway cron to keep data fresh without manual intervention.

## 3. Detailed Tasks

### 3.1 Dependencies & Configuration
- Add npm packages: `yahoo-finance2`, `mongodb`.
- Update `.env.example` and README with `MONGODB_URI`, `YAHOO_APP_ID` (if used), `REFRESH_TOKEN`.
- Ensure `pnpm-lock.yaml` reflects new deps.

### 3.2 Type & Data Model Updates
- Extend `types.ts` `Quote` interface with fields: `marketCap`, `peRatio`, `beta`, `eps`, `dividendYield`, `fiftyTwoWeekHigh`, `fiftyTwoWeekLow`, `fiftyTwoWeekChange`, `fiftyTwoWeekChangePct`, `averageVolume10Day`, `averageVolume30Day`, `volume`, `previousClose`, `open`, `dayHigh`, `dayLow`, `spark` (values + interval metadata).
- Introduce `QuoteSnapshot` type for Mongo persistence separating metadata vs fetched fundamentals.

### 3.3 Yahoo Client (`lib/yahoo/client.ts`)
- Wrap `yahooFinance.quoteSummary`, `quote`, and `spark` calls.
- Implement batching (<=20 symbols per call) with retry/backoff for rate limits.
- Normalize missing fields (fallback to `null` when absent).
- Capture raw payload for debugging (`rawQuote` in snapshot document).

### 3.4 Mongo Connectivity (`lib/db/mongo.ts`)
- Implement singleton MongoDB client with cached promise to reuse connections across hot reloads in Next.
- Provide helper to access collections (`quotes_latest`, `quotes_daily`, `sync_runs`).
- Add compound indexes: `quotes_latest` `_id: symbol`; `quotes_daily` unique `{ symbol: 1, asOf: -1 }`; optional TTL on `sync_runs` entries.

### 3.5 Repository Layer (`lib/repository/quotes.ts`)
- Functions: `getLatestQuotes()`, `upsertLatestQuotes(quotes)`, `recordDailySnapshots(quotes)` (optional), `recordSyncRun(result)`.
- Ensure upserts use bulk operations to minimize network round trips.
- Convert dates to ISO strings for consistent storage.

### 3.6 Caching (`lib/cache/quotesCache.ts`)
- Store `{ quotes: Quote[], fetchedAt: number }` in module scope.
- `getCachedQuotes(maxAgeMs)` returns fresh data if `Date.now() - fetchedAt < maxAgeMs`.
- `setCachedQuotes` updates memory after successful refresh.
- Fallback to Mongo queries when memory cache is cold.

### 3.7 API Routes
- `app/api/ndx/route.ts` (GET):
  - Check in-memory cache (`maxAgeMs = 15 * 60 * 1000`).
  - If stale, read `quotes_latest` from Mongo. If still stale or missing, trigger `refreshQuotes()` (Yahoo fetch + upsert).
  - Return `Quote[]`. Include headers `Cache-Control: s-maxage=60, stale-while-revalidate=300`.
- `app/api/ndx/refresh/route.ts` (POST):
  - Validate `X-Refresh-Token` header or similar.
  - Trigger `refreshQuotes({ force: true })`.
  - Return status + summary (symbols refreshed, duration).

### 3.8 Refresh Logic (`lib/services/refreshQuotes.ts`)
- Accept options `{ force?: boolean, maxAgeMs?: number }`.
- On non-force refresh, compute age using `quotes_latest` `fetchedAt` field; skip if younger than threshold.
- On success, write to Mongo + memory cache and optionally `quotes_daily` if `asOf` indicates new trading day.
- Emit structured logs for debugging (symbol counts, rate limit warnings).

### 3.9 Background Script (`scripts/refreshNdx.ts`)
- CLI using `tsx`. Options: `--force`, `--since <minutes>`.
- Loads roster, calls `refreshQuotes({ force })` or respects TTL.
- Records run outcome in `sync_runs` (timestamp, duration, refreshedSymbols, error if any).
- Exit codes: `0` success/no-op, `1` failure (so Railway alerts).

### 3.10 Frontend Updates
- Replace SWR fetcher in `app/page.tsx` to call `/api/ndx`.
- Move `buildHierarchy` function to `lib/transform.ts` (re-export as needed); remove `mockQuotes` usage.
- Update components (`Tooltip`, etc.) to render new fundamentals; ensure optional chaining for missing data.
- Adjust Zustand store defaults if needed (e.g., `minAbsChange` thresholds) to accommodate real percent changes.

### 3.11 Documentation & Environment
- Update README with setup steps:
  - Install new dependencies.
  - Configure `.env.local` with `MONGODB_URI`, `REFRESH_TOKEN`.
  - Running `pnpm tsx scripts/refreshNdx.ts --force` locally.
  - Railway cron configuration (`pnpm tsx scripts/refreshNdx.ts --since 15`).
- Add `docs/NasdaqDataPlan.md` (this file) reference in project docs index if applicable.

### 3.12 Testing & Validation
- Add unit tests for normalization logic (if testing harness available) or at least sample fixtures under `__tests__/` or `fixtures/`.
- Manual testing checklist:
  - Local refresh script populates Mongo (`quotes_latest` count == roster length).
  - API returns data within expected TTL.
  - UI treemap renders real data; highlights from fundamentals appear.
  - Railway cron logs show successful refresh across multiple runs.

### 3.13 Rollout Steps
1. Implement backend modules & tests locally.
2. Run refresh script to seed Mongo.
3. Verify UI + API locally using seeded data.
4. Deploy to Railway with environment variables set and cron configured.
5. Monitor first day of production usage for rate limit errors and adjust refresh interval if needed.

## 4. Open Questions
- Do we want to persist longer history (e.g. intraday snapshots) for later analytics? If yes, expand `quotes_daily` storage strategy.
- Should we add alerting when refresh fails repeatedly (e.g. send Slack/webhook)?
