# Database Layer

## Purpose
- Provide durable caching and lightweight history for NASDAQ-100 quotes.
- Backed by MongoDB with in-memory cache for hot reads.

## Environment
- `MONGO_URL` (required) — connection string.
- `MONGODB_DB` (optional) — database name; defaults to `stock-analyzer`.
  - Source: lib/env.ts:1, lib/env.ts:20, lib/env.ts:24

## Connection & Indexes
- Singleton client + DB promise reused across hot reloads.
  - lib/db/mongo.ts:1, lib/db/mongo.ts:17, lib/db/mongo.ts:35
- Index bootstrap (first connect):
  - `quotes_latest`: `{ _id: 1 }` (implicit)
  - `quotes_daily`: unique `{ symbol: 1, asOf: -1 }`
  - `sync_runs`: TTL on `{ createdAt: -1 }`, 14 days
  - Source: lib/db/mongo.ts:45

Note: Mongo TTL requires a BSON Date field. Current code stores `createdAt` as ISO string; the TTL will not purge unless stored as Date. See “Caveats” below.

## Collections & Schemas

### quotes_latest
- One document per symbol containing the latest normalized quote and raw payloads.
- Shape: lib/repository/quotes.ts:6, types.ts:44
- Document fields:
  - `_id: string` — symbol (e.g., `AAPL`).
  - `fetchedAt: string` — ISO timestamp of refresh.
  - `quote: Quote` — normalized fields for UI/analytics (see Quote below).
  - `rawQuote?: unknown` — original Yahoo `quote` payload.
  - `rawSummary?: unknown` — original Yahoo `quoteSummary` payload.
  - `rawSpark?: unknown` — original Yahoo `spark` payload.
- Access patterns:
  - Read all, sorted by `_id`: lib/repository/quotes.ts:38
  - Upsert many by `_id` (bulk): lib/repository/quotes.ts:56

### quotes_daily
- Optional daily snapshots keyed by trading day.
- Shape: lib/repository/quotes.ts:8
- Document fields:
  - `symbol: string`
  - `asOf: string` — `YYYY-MM-DD` derived from `quote.fetchedAt`.
  - `quote: Quote` — the normalized quote as of that day.
  - `fetchedAt: string` — ISO timestamp when stored.
- Index: unique `{ symbol: 1, asOf: -1 }` ensures one snapshot per day per symbol.
- Access patterns:
  - Write-once via upsert-on-insert: lib/repository/quotes.ts:69

### sync_runs
- Observability for refresh executions.
- Shape: lib/repository/quotes.ts:15
- Document fields:
  - `type: 'refresh'`
  - `createdAt: string` — ISO start time.
  - `finishedAt?: string` — ISO finish time.
  - `status: 'success' | 'skipped' | 'error'`
  - `durationMs?: number`
  - `refreshedSymbols?: string[]`
  - `skippedSymbols?: string[]`
  - `error?: string`
- Index: TTL on `createdAt` (intended 14 days): lib/db/mongo.ts:45
- Access patterns:
  - Insert-only: lib/repository/quotes.ts:89

## Types Stored

### Quote
- Definition: types.ts:9
- Fields (all numbers nullable unless noted):
  - `symbol: string`
  - `name: string`
  - `sector: string`
  - `industry: string`
  - `weight: number | null` — derived from market cap share.
  - `marketCap: number | null`
  - `changePct: number` — rounded two decimals; computed if missing.
  - `last, previousClose, open, dayHigh, dayLow: number | null`
  - `volume, averageVolume10Day, averageVolume30Day: number | null`
  - `peRatio, beta, eps, dividendYield: number | null`
  - `fiftyTwoWeekHigh, fiftyTwoWeekLow, fiftyTwoWeekChange, fiftyTwoWeekChangePct: number | null`
  - `marketState: string | null`
  - `fetchedAt: string` — ISO timestamp when fetched.
  - `spark: QuoteSpark | null`

### QuoteSpark
- Definition: types.ts:3
- Fields:
  - `interval: string` — e.g., `5m`.
  - `timestamps: number[]` — epoch millis.
  - `closes: number[]` — prices aligned to `timestamps`.

## Data Flow
- Refresh orchestrator: lib/services/refreshQuotes.ts:101
  - Load roster symbols.
  - Fetch Yahoo `quote`, `quoteSummary`, `spark` in batches: lib/yahoo/client.ts:119
  - Normalize into `Quote` (null-safe): lib/yahoo/client.ts:175
  - Upsert `quotes_latest`; optionally snapshot to `quotes_daily`.
  - Record `sync_runs` and update in-memory cache.
- Read paths:
  - API GET `/api/ndx` reads memory → Mongo fallback with 15 min TTL: app/api/ndx/route.ts:9
  - Health summary (count, newest timestamp): app/api/health/route.ts:7, lib/queries.ts:24

## Retention & Refresh Cadence
- `quotes_latest`: mutable; always upserted with the newest payload per symbol.
- `quotes_daily`: append-only per trading day; no TTL by default.
- `sync_runs`: intended TTL 14 days (see caveat).
- Default API max age: 15 minutes: lib/queries.ts:5, app/api/ndx/route.ts:7

## Caveats & Notes
- TTL index on `sync_runs.createdAt` requires a Date type; documents currently use ISO strings. To enable TTL, store `createdAt`/`finishedAt` as BSON `Date` values.
- Consider indexing `quotes_latest.fetchedAt` if frequent recency queries emerge.
- All timestamps are stored as ISO strings except `QuoteSpark.timestamps` which are epoch millis.

## Quick Reference: Access Helpers
- `getLatestQuotes()` — read all latest docs: lib/repository/quotes.ts:38
- `getLatestQuotesMetadata()` — count + newest fetchedAt: lib/repository/quotes.ts:47
- `upsertLatestQuotes(docs)` — bulk upsert latest: lib/repository/quotes.ts:56
- `recordDailySnapshots(docs)` — daily unique snapshots: lib/repository/quotes.ts:69
- `recordSyncRun(doc)` — insert run log: lib/repository/quotes.ts:89
