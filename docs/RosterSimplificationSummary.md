# Roster Simplification Summary

## Overview
- Removed `data/nasdaq100.json` (was static metadata with invented weights).
- Added `data/nasdaq100_symbols.json` as the default ticker universe (current 101 Nasdaq-100 tickers from Wikipedia, including dual-share listings).
- New optional `SYMBOLS` env var allows overriding the ticker list (comma-separated).
- Yahoo summary data now supplies name/sector/industry; weights derive from live market caps during refresh.

## Key Code Changes
- `lib/roster.ts`
  - Loads symbols from `SYMBOLS` env or the new JSON file (deduplicated, uppercased).
  - Exposes simplified `RosterEntry` with symbol-first focus and in-memory cache.
- `lib/yahoo/client.ts`
  - Requests the `assetProfile` module and prefers summary metadata for name/sector/industry.
  - Normalized quotes start with `weight = null`.
- `lib/services/refreshQuotes.ts`
  - Adds `applyMarketCapWeights` to compute weights from the latest market caps after each refresh.
- `lib/mock.ts`
  - Generates mock quotes from the symbol list, fabricating metadata/weights for local demos.
- `.env.example`, `README.md`, plans/docs updated to reflect the new configuration.

## Operational Notes
- Ensure production Railway env sets `SYMBOLS` if the default file is insufficient or needs quick edits.
- Weight computation requires valid `marketCap` figures; symbols without a cap get `null` weight.
- Linting currently fails locally under Node 16—upgrade to ≥18.17 before running `pnpm lint` / Next.js dev server.
