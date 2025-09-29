# NASDAQ‑100 Treemap (Next.js + d3-hierarchy)

A Finviz‑style treemap for the NASDAQ‑100. Mock data today; swap in a real feed later.

## Run
```bash
pnpm i   # or npm i / yarn
pnpm dev # http://localhost:3000
```

## What’s inside
- Next.js (App Router, TS)
- d3-hierarchy for treemap layout
- Zustand for UI state (hover/search/filter/zoom)
- SWR for pretend polling
- Tailwind for styles

## Files of interest
- `app/page.tsx` — data load, filters, responsive sizing
- `components/Treemap.tsx` — SVG layout & tiles
- `components/Tooltip.tsx`, `Spark.tsx`, `Legend.tsx`, `Controls.tsx`
- `lib/d3Treemap.ts` — typed treemap builder
- `lib/useMeasure.ts` — ResizeObserver hook
- `lib/mock.ts` — mock data + hierarchy builder
- `data/nasdaq100.json` — sample NDX membership metadata

## Swap to real data later
Replace `mockQuotes()` in `app/page.tsx` with a server route `/api/ndx` that returns quotes + mini-sparklines; keep the same `Quote` shape.
```
