# BE Plan

Define objectives: serve treemap market data + company metadata, minimize Alpha Vantage (https://www.alphavantage.co/documentation/) calls, deliver fast responses to app.

## API surface:
GET /treemap: aggregated latest prices, change %, sector/industry.
GET /company/:symbol: cached fundamentals (name, sector, market cap).
GET /health: pipeline status (last sync, error state).

## Data sources:
Alpha Vantage TIME_SERIES_DAILY_ADJUSTED for per-symbol history; SYMBOL_SEARCH or static mapping for tickers; OVERVIEW for fundamentals.
Maintain static JSON for NASDAQ-100 constituents (or seed from data/nasdaq100.json).

## Storage layer:
Lightweight DB (SQLite/Postgres) with tables: companies, price_snapshots, sync_runs.
companies: symbol PK, name, sector, industry, last_overview_at, overview_payload.
price_snapshots: id PK, symbol FK, trading_day, open/high/low/close/volume, percent_change, raw_payload.
sync_runs: id PK, run_type (daily_prices,fundamentals), status, started_at, finished_at, message.

## Caching strategy:
Fetch daily series once per trading day; store entire day; treemap request served straight from DB.
Fundamentals cached with configurable TTL (e.g., 7 days) before re-fetch.
In-memory cache (LRU) on API layer for hot responses with short TTL (30–60s) to avoid DB thrash.

## Scheduler workflow:
Background job (cron or queue worker) runs after market close (e.g., 5pm ET) to update all prices in batches respecting Alpha Vantage 5 calls/min, 500/day limit.
Batch by grouping tickers per minute; job persists progress so it can resume.
Fundamentals refresh job runs once per week/off-peak, only refetching when last_overview_at exceeds TTL.

## Request-time behavior:
GET /treemap checks latest price_snapshots date; if stale (e.g., >1 day), respond with existing data + stale: true flag and enqueue priority refresh (respecting limits).
GET /company/:symbol returns cached overview; if stale, return cached data and trigger async refresh.

## Rate-limit handling:
Queue alpha calls with token bucket (5 tokens/min) to stay under limit.
Implement exponential backoff on 429/5xx; log and record failure in sync_runs.

## Data normalization:
Compute percent change from previous close server-side; store for treemap.
Map sectors/industries into consistent taxonomy for treemap grouping.

## ETL edge cases:
Market holidays/weekends: scheduler skips or marks sync_runs as skipped.
Missing symbols: mark companies.status = inactive and exclude from treemap.

## Testing & monitoring:
No tests for now.
Structured logging + alert on repeated sync failures.

## Security & config:
Store API key in env var (ALPHAVANTAGE_API_KEY), rotate via secrets manager.
Expose minimal error detail to clients; log full context server-side.

## Future enhancements:
Webhook or SSE to push daily refresh status to UI.
Add alternative provider (IEX/free) fallback when Alpha Vantage rate-limits.
Persist intraday snapshots if treemap needs live market view later.