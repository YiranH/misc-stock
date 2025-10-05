# GitHub Actions Daily Refresh

## Objectives
- Run `scripts/refreshNdx.ts` daily after the U.S. market closes to keep Mongo data current without relying on a separate cron service.
- Provide a manual trigger via `workflow_dispatch` for ad-hoc refreshes.

## Pre-flight Checklist
- Verify the script works headlessly: `pnpm tsx scripts/refreshNdx.ts --since 180` (Node 20+, pnpm 7.x to match `pnpm-lock.yaml`, roster data in `data/nasdaq100_symbols.json`).
- Review roster overrides or Yahoo dependencies; ensure no local-only files are required.

## Secrets & Configuration
Set these in **Settings → Secrets and variables → Actions**:
- `MONGO_URL` (required)
- `MONGODB_DB` (optional override)
- `REFRESH_TOKEN` (if `/api/ndx/refresh` verifies a token)
- `YAHOO_APP_ID` (optional)
- `SYMBOLS` (optional roster override)

Remove unused secrets so the workflow surface stays clean.

## Scheduling Guidance
- Default cron: `30 21 * * 1-5` (21:30 UTC ≈ 4:30 pm ET standard / 5:30 pm ET DST).
- Add a second entry (e.g. `30 20`) if you want a run closer to closing time; keep `--since` so duplicate runs skip when data is fresh.

## Workflow Template
```
name: Refresh NDX Quotes

on:
  schedule:
    - cron: '30 21 * * 1-5'
  workflow_dispatch:

jobs:
  refresh:
    runs-on: ubuntu-latest
    env:
      MONGO_URL: ${{ secrets.MONGO_URL }}
      MONGODB_DB: ${{ secrets.MONGODB_DB }}
      REFRESH_TOKEN: ${{ secrets.REFRESH_TOKEN }}
      YAHOO_APP_ID: ${{ secrets.YAHOO_APP_ID }}
      SYMBOLS: ${{ secrets.SYMBOLS }}
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with:
          version: 7.32.4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - name: Refresh quotes
        run: pnpm tsx scripts/refreshNdx.ts --since 180
```

## Operations Notes
- Monitor runs from the Actions tab; failures surface Mongo/Yahoo issues immediately.
- Use `workflow_dispatch` for manual reruns (e.g. after code/config updates).
- Adjust cron or `--since` thresholds if Yahoo rate limiting or market calendar changes cause gaps.
