# Dynamic NASDAQ-100 Roster + Weights Plan

## 1) Objectives
- Replace the static ticker file (`data/nasdaq100_symbols.json` by default) with a dynamic, cached roster.
- Compute per-constituent weights from live market caps each refresh.
- Keep the current Yahoo fetch + Mongo caching architecture intact.

## 2) Sources of Truth
- Roster (membership): Wikipedia NASDAQ-100 page (https://en.wikipedia.org/wiki/NASDAQ-100).
  - Public, updated quickly after rebalances.
  - Parse the table server-side and normalize tickers/names.
- Sector/Industry/Name: Yahoo Finance `quoteSummary` with `assetProfile` + `price` modules.
- Weights: Derived each refresh from live `marketCap` via Yahoo `quote`.
  - Note: Official index weights use float-adjusted caps and capping rules. The derived weights are an approximate proxy; for official weights a licensed feed is required.

## 3) Data Flow
- On demand or daily cron:
  1) Load roster from Mongo (if fresh) or scrape Wikipedia and upsert `roster_latest`.
  2) Fetch Yahoo quotes for all symbols (existing pipeline).
  3) Compute `weight = (marketCap / totalMarketCap) * 100` for all symbols with valid caps.
  4) Persist quotes (existing `quotes_latest`) and keep weights alongside the normalized `Quote`s.

## 4) Mongo Collections
- `roster_latest` (single document per symbol)
  - `_id: string` — symbol (e.g., `AAPL`)
  - `symbol: string`
  - `name: string`
  - `sector: string | null`
  - `industry: string | null`
  - `source: 'wikipedia+enriched' | 'manual'`
  - `updatedAt: string` (ISO)
  - Index: `{ _id: 1 }` unique

- `roster_sync_runs` (optional for observability)
  - `type: 'roster'`
  - `createdAt`, `finishedAt`, `status`, `durationMs`
  - `addedSymbols: string[]`, `removedSymbols: string[]`
  - `error?: string`

## 5) Library Additions
- `lib/rosterSource.ts`
  - `fetchWikipediaRoster(): Promise<Array<{ symbol: string; name: string }>>`
    - Scrape Wikipedia table, normalize symbols, strip footnotes/whitespace, keep duplicates like `GOOG`/`GOOGL`.
  - `enrichWithYahoo(entries): Promise<RosterEntry[]>`
    - Batch `yahoo-finance2.quoteSummary(symbol, { modules: ['price', 'assetProfile'] })`.
    - Derive `name` from `price.longName ?? price.shortName ?? price.symbol`.
    - Derive `sector`, `industry` from `assetProfile` when available.
  - `upsertRoster(entries): Promise<void>` — bulk upsert into `roster_latest`.
  - `getFreshRoster(maxAgeHours = 24): Promise<RosterEntry[]>`
    - Try Mongo if `updatedAt` within TTL for all symbols; else refetch + upsert.
    - On scrape/enrich failure, falls back to last known Mongo roster.

- `lib/roster.ts`
  - Replace current static JSON import with dynamic API.
  - Export async functions:
    - `loadRoster(): Promise<RosterEntry[]>`
    - `loadRosterSymbols(): Promise<string[]>`
  - Keep a lightweight in-memory cache with TTL to avoid repeated DB hits within a request burst.

## 6) Refresh Pipeline Changes
- `lib/services/refreshQuotes.ts`
  - Change `const roster = getRoster()` to `const roster = await loadRoster()`.
  - After normalizing quotes, compute weights:
    - `const caps = quotes.map(q => q.marketCap).filter(n => n && n > 0)`
    - `const total = caps.reduce((a,b)=>a+b, 0)`
    - For each quote with cap: `quote.weight = +(100 * (cap / total)).toFixed(4)`; else `null`.
  - Persist as part of `quote` document (no schema change required; `Quote.weight` already exists).

## 7) API Additions (Optional)
- `GET /api/roster` — returns the current roster + `updatedAt` for debugging.
- `POST /api/roster/refresh` — token-protected manual refresh (mirrors `/api/ndx/refresh`).

## 8) Packages & Config
- Add `cheerio` (HTML parsing) for Wikipedia scrape.
- Reuse existing `yahoo-finance2` and `node-fetch`.
- Environment:
  - `ROSTER_TTL_HOURS` (optional; default 24).

## 9) Failure Modes & Fallbacks
- Wikipedia layout changes: Parser should be resilient (select by table caption or column headers, not brittle CSS).
- Partial Yahoo failures: Keep `sector/industry` nullable; do not block roster upsert.
- Membership churn: Compute `addedSymbols`/`removedSymbols` vs last set; log to `roster_sync_runs`.
- If the new scrape produces an obviously smaller set (e.g., < 50 symbols), treat as failure and retain last roster.

## 10) Implementation Steps
1) Create `lib/rosterSource.ts` with scraping + enrichment + upsert helpers.
2) Create `lib/repository/roster.ts` for Mongo accessors (`getRoster`, `upsertRoster`, `getRosterSymbols`, `recordSyncRun`).
3) Replace `lib/roster.ts` with async loader that reads Mongo (and falls back to fetch+upsert when stale).
4) Update `lib/services/refreshQuotes.ts` to use `await loadRoster()` and compute weights from caps before persisting.
5) Add optional `/api/roster` routes for visibility.
6) Remove reliance on the static symbols file once the dynamic path is validated.
7) Update README with new setup notes and remove references to the placeholder JSON.

## 11) Parsing Outline (Wikipedia)
- Locate the NASDAQ-100 constituents table by caption or by headers containing `Ticker`/`Company`.
- For each row:
  - `symbol`: anchor text in “Ticker” column; trim; strip footnotes; upper-case.
  - `name`: cell text for “Company”.
  - Push `{ symbol, name }` (sector/industry will be enriched via Yahoo).

## 12) Enrichment Outline (Yahoo)
- Batch `quoteSummary` with modules `['price','assetProfile']` (≤20 per batch).
- Map fields:
  - `name = price.longName ?? price.shortName ?? symbol`
  - `sector = assetProfile.sector ?? null`
  - `industry = assetProfile.industry ?? null`
- Return `RosterEntry[]` with `{ symbol, name, sector, industry }`.

## 13) Weight Computation
- Inputs: normalized quotes with `marketCap`.
- Exclude `null`, `NaN`, and non-positive caps from the total.
- Weight per symbol: `cap / total * 100` (rounding to 2–4 decimals for display; keep full precision in memory if desired).
- Leave `weight = null` when cap is missing; do not renormalize remaining weights to 100% in storage (for transparency). For UI, you may renormalize live if desired.

## 14) Testing & Validation
- Unit-test Wikipedia parser against stored HTML fixtures.
- Validate that `roster_latest` count ≈ 100 and includes expected dual-class tickers (e.g., `GOOG`, `GOOGL`).
- Manual run:
  - Cron/script refresh seeds `roster_latest` and `quotes_latest`.
  - API `/api/ndx` returns quotes with non-null `weight` for the majority of symbols.

## 15) Operational Notes
- Schedule roster refresh daily (e.g., 03:00 UTC) and quotes refresh intraday per your current cadence.
- Log membership diffs and alert on large removals.
- Keep an eye on Yahoo rate limits; reuse batching and backoff strategy from existing client.

## 16) Out of Scope
- Official NASDAQ-100 methodology (float-adjusted free float, quarterly/annual caps, special rebalances). The proxy weight is sufficient for visualization; do not market as official.
