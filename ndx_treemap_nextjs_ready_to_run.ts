# ndx-treemap-nextjs — Ready‑to‑run repo

Below are **all files** you can copy into a fresh folder. Then run the commands in `README.md`.

---

## package.json
```json
{
  "name": "ndx-treemap-nextjs",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "d3-hierarchy": "^3.1.2",
    "next": "^14.2.5",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "swr": "^2.2.5",
    "zustand": "^4.5.2"
  },
  "devDependencies": {
    "@types/node": "^20.12.12",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38",
    "tailwindcss": "^3.4.10",
    "typescript": "^5.4.5"
  }
}
```

---

## tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

---

## next-env.d.ts
```ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/basic-features/typescript for more information.
```

---

## next.config.mjs
```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true
};
export default nextConfig;
```

---

## postcss.config.js
```js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

---

## tailwind.config.ts
```ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        slate: {
          850: '#1b2230'
        }
      }
    }
  },
  plugins: []
};
export default config;
```

---

## .gitignore
```gitignore
# dependencies
/node_modules

# production
/.next
/out

# misc
.DS_Store
.env*
```

---

## README.md
```md
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
- `data/nasdaq100_symbols.json` — sample NASDAQ-100 ticker list

## Swap to real data later
Replace `mockQuotes()` in `app/page.tsx` with a server route `/api/ndx` that returns quotes + mini-sparklines; keep the same `Quote` shape.
```
```

---

## app/layout.tsx
```tsx
import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'NASDAQ‑100 Treemap',
  description: 'Finviz‑style treemap with d3-hierarchy',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-900 min-h-screen text-white">{children}</body>
    </html>
  );
}
```

---

## app/globals.css
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body { height: 100%; }
```

---

## app/page.tsx
```tsx
'use client';
import useSWR from 'swr';
import Treemap from '@/components/Treemap';
import Tooltip from '@/components/Tooltip';
import Legend from '@/components/Legend';
import Controls from '@/components/Controls';
import { useMeasure } from '@/lib/useMeasure';
import { mockQuotes, buildHierarchy } from '@/lib/mock';
import { useTreemapStore } from '@/store/useTreemapStore';
import { Quote } from '@/types';

function uniqueSectors(quotes: Quote[]) {
  return Array.from(new Set(quotes.map(q => q.sector))).sort();
}

export default function Page() {
  const { search, sector, minAbsChange, setHover } = useTreemapStore();
  const { data: quotes } = useSWR('ndx', async () => mockQuotes(), { refreshInterval: 30000 });
  const { ref, width, height } = useMeasure<HTMLDivElement>();

  if (!quotes) return <div className="p-6">Loading…</div>;

  const sectors = uniqueSectors(quotes);

  // Apply filters
  const filtered = quotes.filter(q => {
    const hit = !search || q.symbol.toLowerCase().includes(search.toLowerCase()) || q.name.toLowerCase().includes(search.toLowerCase());
    const secOk = sector === 'ALL' || q.sector === sector;
    const magOk = Math.abs(q.changePct) >= minAbsChange;
    return hit && secOk && magOk;
  });

  const rootData = buildHierarchy(filtered);

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">NASDAQ‑100 Treemap</h1>
      <Controls sectors={sectors} />
      <div ref={ref} className="h-[72vh] w-full">
        {width > 0 && height > 0 && (
          <Treemap rootData={rootData} width={width} height={height} onHover={setHover} />
        )}
      </div>
      <Legend domain={[-3, 3]} />
      <Tooltip />
    </main>
  );
}
```

---

## components/Treemap.tsx
```tsx
'use client';
import { useMemo } from 'react';
import { HierarchyRectangularNode } from 'd3-hierarchy';
import { NodeDatum, Quote } from '@/types';
import { buildTreemapLayout } from '@/lib/d3Treemap';
import { colorForChange } from '@/lib/color';

type TreemapProps = {
  rootData: NodeDatum;
  width: number;
  height: number;
  onHover?: (q: Quote | null) => void;
};

export default function Treemap({ rootData, width, height, onHover }: TreemapProps) {
  const rectRoot: HierarchyRectangularNode<NodeDatum> = useMemo(
    () => buildTreemapLayout(rootData, width, height),
    [rootData, width, height]
  );
  const leaves = rectRoot.leaves();

  return (
    <svg width={width} height={height} className="bg-slate-850 rounded-2xl">
      {leaves.map(n => {
        const q = n.data.data!; // Quote present on leaves
        const w = n.x1 - n.x0, h = n.y1 - n.y0;
        return (
          <g key={q.symbol} transform={`translate(${n.x0},${n.y0})`}
             onMouseEnter={() => onHover?.(q)} onMouseLeave={() => onHover?.(null)}>
            <rect rx={6} ry={6} width={w} height={h} fill={colorForChange(q.changePct)} />
            <text x={8} y={18} className="fill-white font-bold text-[12px] select-none">{q.symbol}</text>
            <text x={8} y={36} className="fill-white/80 text-[11px] select-none">{q.changePct > 0 ? '+' : ''}{q.changePct}%</text>
          </g>
        );
      })}
    </svg>
  );
}
```

---

## components/Tooltip.tsx
```tsx
'use client';
import { useTreemapStore } from '@/store/useTreemapStore';
import Spark from './Spark';

export default function Tooltip() {
  const { hover } = useTreemapStore();
  if (!hover) return null;
  return (
    <div className="fixed left-4 bottom-4 pointer-events-none p-4 rounded-xl bg-slate-800/95 text-white shadow-xl w-[300px]">
      <div className="text-xs opacity-70">{hover.sector} · {hover.industry}</div>
      <div className="text-lg font-semibold">{hover.symbol} <span className="text-sm ml-2">{hover.last}</span></div>
      <div className="text-sm mb-1 truncate">{hover.name}</div>
      <Spark data={hover.spark} />
      <div className="mt-1 text-sm">{hover.changePct > 0 ? '+' : ''}{hover.changePct}%</div>
    </div>
  );
}
```

---

## components/Spark.tsx
```tsx
'use client';

export default function Spark({ data }: { data: number[] }) {
  const w = 200, h = 40;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - v * h}`).join(' ');
  return (
    <svg width={w} height={h} className="mt-1">
      <polyline fill="none" stroke="currentColor" strokeWidth="2" points={points} />
    </svg>
  );
}
```

---

## components/Legend.tsx
```tsx
'use client';

type LegendProps = {
  domain: [number, number]; // e.g. [-3, 3]
  ticks?: number[];
  formatter?: (v: number) => string;
};

export default function Legend({ domain, ticks, formatter }: LegendProps) {
  const [min, max] = domain;
  const values = ticks ?? Array.from({ length: 7 }, (_, i) => min + (i * (max - min)) / 6);
  const fmt = formatter ?? ((v: number) => `${v}%`);
  return (
    <div className="flex items-center gap-3">
      <div className="h-3 w-56 rounded bg-gradient-to-r from-[#c0392b] via-[#3a3f44] to-[#27ae60]" />
      <div className="flex justify-between w-56 text-xs opacity-80">
        {values.map(v => <span key={v}>{fmt(Number(v.toFixed(1)))}</span>)}
      </div>
    </div>
  );
}
```

---

## components/Controls.tsx
```tsx
'use client';
import { useTreemapStore } from '@/store/useTreemapStore';

export default function Controls({ sectors }: { sectors: string[] }) {
  const { search, setSearch, sector, setSector, minAbsChange, setMinAbsChange, setZoomPath } = useTreemapStore();

  return (
    <div className="flex flex-wrap gap-3 items-center">
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search ticker or name…"
        className="px-3 py-2 rounded-lg bg-slate-800 text-white placeholder:text-white/50"
      />
      <select
        value={sector}
        onChange={e => setSector(e.target.value as any)}
        className="px-3 py-2 rounded-lg bg-slate-800 text-white"
      >
        <option value="ALL">All sectors</option>
        {sectors.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      <label className="text-sm text-white/80">
        Min |Δ| %
        <input
          type="number"
          step="0.1"
          value={minAbsChange}
          onChange={e => setMinAbsChange(Number(e.target.value))}
          className="ml-2 w-20 px-2 py-1 rounded bg-slate-800 text-white"
        />
      </label>
      <button
        onClick={() => setZoomPath([])}
        className="px-3 py-2 rounded-lg bg-slate-700 text-white hover:bg-slate-600"
      >
        Reset Zoom
      </button>
    </div>
  );
}
```

---

## lib/d3Treemap.ts
```ts
import {
  hierarchy,
  treemap,
  treemapSquarify,
  HierarchyNode,
  HierarchyRectangularNode,
} from 'd3-hierarchy';
import { NodeDatum } from '@/types';

export function buildTreemapLayout(
  rootData: NodeDatum,
  width: number,
  height: number
): HierarchyRectangularNode<NodeDatum> {
  const root: HierarchyNode<NodeDatum> = hierarchy(rootData)
    .sum((d) => d.data?.marketCap ?? 0)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  const layout = treemap<NodeDatum>()
    .tile(treemapSquarify.ratio(1.1))
    .size([width, height])
    .paddingInner(2)
    .paddingOuter(4);

  return layout(root);
}
```

---

## lib/color.ts
```ts
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// simple hex mixer
function mix(a: string, b: string, t: number) {
  const ah = parseInt(a.slice(1), 16), bh = parseInt(b.slice(1), 16);
  const ar = (ah >> 16) & 255, ag = (ah >> 8) & 255, ab = ah & 255;
  const br = (bh >> 16) & 255, bg = (bh >> 8) & 255, bb = bh & 255;
  const r = Math.round(ar + (br - ar) * t), g = Math.round(ag + (bg - ag) * t), b2 = Math.round(ab + (bb - ab) * t);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b2).toString(16).slice(1)}`;
}

export function colorForChange(pct: number) {
  const x = clamp(pct, -3, 3) / 3; // -1..1
  if (x < 0) return mix('#c0392b', '#3a3f44', 1 + x); // red→gray
  return mix('#3a3f44', '#27ae60', x);                 // gray→green
}
```

---

## lib/mock.ts
```ts
import symbols from '@/data/nasdaq100_symbols.json';
import { Quote, NodeDatum } from '@/types';

export function mockQuotes(): Quote[] {
  return symbols.map((s) => ({
    symbol: s.symbol,
    name: s.name,
    sector: s.sector,
    industry: s.industry,
    marketCap: Math.max(1, s.weight) * 1e10, // fake size using weight
    changePct: Number(((Math.random() - 0.5) * 6).toFixed(2)), // -3..+3-ish
    last: Number((50 + Math.random() * 500).toFixed(2)),
    spark: Array.from({ length: 48 }, (_, i) => {
      const base = 0.5 + 0.3 * Math.sin(i / 5);
      const noise = (Math.random() - 0.5) * 0.25;
      return Math.max(0, Math.min(1, base + noise));
    })
  }));
}

export function buildHierarchy(quotes: Quote[]): NodeDatum {
  const bySector = groupBy(quotes, (q) => q.sector);
  return {
    name: 'root',
    children: Object.entries(bySector).map(([sector, arr]) => {
      const byInd = groupBy(arr, (q) => q.industry);
      return {
        name: sector,
        children: Object.entries(byInd).map(([ind, arr2]) => ({
          name: ind,
          children: arr2.map((q) => ({ name: q.symbol, data: q }))
        }))
      };
    })
  };
}

function groupBy<T>(xs: T[], f: (x: T) => string) {
  return xs.reduce((m, x) => { const k = f(x); (m[k] ||= []).push(x); return m; }, {} as Record<string, T[]>);
}
```

---

## lib/useMeasure.ts
```ts
import { useEffect, useRef, useState } from 'react';

export function useMeasure<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (cr) setSize({ width: Math.round(cr.width), height: Math.round(cr.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, width: size.width, height: size.height } as const;
}
```

---

## store/useTreemapStore.ts
```ts
import { create } from 'zustand';
import { Quote } from '@/types';

type S = {
  hover: Quote | null; setHover: (q: Quote | null) => void;
  search: string; setSearch: (s: string) => void;
  sector: string | 'ALL'; setSector: (s: string | 'ALL') => void;
  minAbsChange: number; setMinAbsChange: (n: number) => void;
  zoomPath: string[]; setZoomPath: (path: string[]) => void;
};

export const useTreemapStore = create<S>((set) => ({
  hover: null, setHover: (hover) => set({ hover }),
  search: '', setSearch: (search) => set({ search }),
  sector: 'ALL', setSector: (sector) => set({ sector }),
  minAbsChange: 0, setMinAbsChange: (minAbsChange) => set({ minAbsChange }),
  zoomPath: [], setZoomPath: (zoomPath) => set({ zoomPath }),
}));
```

---

## types.ts
```ts
export type Quote = {
  symbol: string; name: string;
  sector: string; industry: string;
  marketCap: number;
  changePct: number;
  last: number;
  spark: number[];
};

export type NodeDatum = {
  name: string;
  children?: NodeDatum[];
  data?: Quote;
};
```

---

## data/nasdaq100_symbols.json
```json
[
  { "symbol": "MSFT", "name": "Microsoft Corporation", "sector": "Technology", "industry": "Software - Infrastructure", "weight": 9.5 },
  { "symbol": "AAPL", "name": "Apple Inc.", "sector": "Technology", "industry": "Consumer Electronics", "weight": 8.2 },
  { "symbol": "NVDA", "name": "NVIDIA Corporation", "sector": "Technology", "industry": "Semiconductors", "weight": 7.8 },
  { "symbol": "AMZN", "name": "Amazon.com, Inc.", "sector": "Consumer Cyclical", "industry": "Internet Retail", "weight": 6.3 },
  { "symbol": "GOOGL", "name": "Alphabet Inc. Class A", "sector": "Communication Services", "industry": "Internet Content & Information", "weight": 3.5 },
  { "symbol": "GOOG", "name": "Alphabet Inc. Class C", "sector": "Communication Services", "industry": "Internet Content & Information", "weight": 3.4 },
  { "symbol": "META", "name": "Meta Platforms, Inc.", "sector": "Communication Services", "industry": "Internet Content & Information", "weight": 4.2 },
  { "symbol": "TSLA", "name": "Tesla, Inc.", "sector": "Consumer Cyclical", "industry": "Auto Manufacturers", "weight": 4.1 },
  { "symbol": "AVGO", "name": "Broadcom Inc.", "sector": "Technology", "industry": "Semiconductors", "weight": 4.0 },
  { "symbol": "PEP", "name": "PepsiCo, Inc.", "sector": "Consumer Defensive", "industry": "Beverages - Non-Alcoholic", "weight": 2.0 },
  { "symbol": "COST", "name": "Costco Wholesale Corporation", "sector": "Consumer Defensive", "industry": "Discount Stores", "weight": 2.2 },
  { "symbol": "ADBE", "name": "Adobe Inc.", "sector": "Technology", "industry": "Software - Infrastructure", "weight": 2.1 },
  { "symbol": "NFLX", "name": "Netflix, Inc.", "sector": "Communication Services", "industry": "Entertainment", "weight": 1.8 },
  { "symbol": "AMD", "name": "Advanced Micro Devices, Inc.", "sector": "Technology", "industry": "Semiconductors", "weight": 2.1 },
  { "symbol": "INTC", "name": "Intel Corporation", "sector": "Technology", "industry": "Semiconductors", "weight": 1.5 },
  { "symbol": "CSCO", "name": "Cisco Systems, Inc.", "sector": "Technology", "industry": "Communication Equipment", "weight": 1.2 },
  { "symbol": "TXN", "name": "Texas Instruments Incorporated", "sector": "Technology", "industry": "Semiconductors", "weight": 1.1 },
  { "symbol": "QCOM", "name": "QUALCOMM Incorporated", "sector": "Technology", "industry": "Semiconductors", "weight": 1.1 },
  { "symbol": "AMAT", "name": "Applied Materials, Inc.", "sector": "Technology", "industry": "Semiconductor Equipment & Materials", "weight": 1.0 },
  { "symbol": "PDD", "name": "PDD Holdings Inc.", "sector": "Consumer Cyclical", "industry": "Internet Retail", "weight": 1.0 },
  { "symbol": "PYPL", "name": "PayPal Holdings, Inc.", "sector": "Financial", "industry": "Credit Services", "weight": 0.9 },
  { "symbol": "MRVL", "name": "Marvell Technology, Inc.", "sector": "Technology", "industry": "Semiconductors", "weight": 0.8 },
  { "symbol": "ABNB", "name": "Airbnb, Inc.", "sector": "Consumer Cyclical", "industry": "Travel Services", "weight": 0.7 },
  { "symbol": "PANW", "name": "Palo Alto Networks, Inc.", "sector": "Technology", "industry": "Software - Infrastructure", "weight": 0.9 },
  { "symbol": "CRWD", "name": "CrowdStrike Holdings, Inc.", "sector": "Technology", "industry": "Software - Infrastructure", "weight": 0.8 },
  { "symbol": "FTNT", "name": "Fortinet, Inc.", "sector": "Technology", "industry": "Software - Infrastructure", "weight": 0.7 },
  { "symbol": "ZS", "name": "Zscaler, Inc.", "sector": "Technology", "industry": "Software - Infrastructure", "weight": 0.5 },
  { "symbol": "SNPS", "name": "Synopsys, Inc.", "sector": "Technology", "industry": "Software - Application", "weight": 0.7 },
  { "symbol": "PLTR", "name": "Palantir Technologies Inc.", "sector": "Technology", "industry": "Software - Infrastructure", "weight": 0.6 },
  { "symbol": "KLAC", "name": "KLA Corporation", "sector": "Technology", "industry": "Semiconductor Equipment & Materials", "weight": 0.6 }
]
