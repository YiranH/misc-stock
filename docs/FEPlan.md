I want to create a chart (source: https://elite.finviz.com/map.ashx?t=sec_ndx) like this using react and nextjs.

![treemap](treemap_example.png)

Here’s a plan to build a Finviz-style NASDAQ-100 treemap in **React + Next.js** with mocked data.

# What we’re building

* **Hierarchical treemap**: Sector → Industry → Ticker tiles
* **Tile size**: market-cap (or index weight)
* **Tile color**: intraday % change (red ↔ gray ↔ green)
* **UI niceties**: tooltip with mini sparkline, legend, zoom to group, search, and simple filters

---

## 1) Tech choices (strong takes)

* **Layout**: `d3-hierarchy` + `treemapSquarify` → best control & performance.
* **Render**: SVG (not Canvas) – easier interactivity, plenty fast for ~100–300 nodes.
* **State**: `zustand` (minimal & excellent) for filters/hover/zoom.
* **Data fetch**: `swr` (simple cache) — you can swap to real API later.
* **Styling**: Tailwind CSS for speed.
* **Sparklines**: tiny inline SVGs. No heavy chart lib needed.

---

## 2) Data model

Mock once, then you can wire it to a feed.

```ts
// types.ts
export type Quote = {
  symbol: string; name: string;
  sector: string; industry: string;
  marketCap: number; // size
  changePct: number; // color driver, e.g., -3.2, 0.75
  last: number;
  spark: number[]; // 30–60 points, normalized 0..1
};

// hierarchical shape for d3
export type NodeDatum = {
  name: string;
  children?: NodeDatum[];
  data?: Quote;
};
```

Build a tree: **root → sectors → industries → tickers**.

---

## 3) Color & size rules

* **Size** = `marketCap` (or NDX weight if you have it).
* **Color**: diverging scale centered at 0.

  * Domain: `[-3, 0, 3]` (cap extremes at ±3%).
  * Map to colors: `#c0392b` → `#3a3f44` (neutral gray) → `#27ae60`.

---

## 4) File structure

```
app/
  page.tsx
  components/
    Treemap.tsx
    Tile.tsx
    Tooltip.tsx
    Legend.tsx
    Spark.tsx
  lib/
    d3Treemap.ts
    color.ts
    mock.ts
  store/
    useTreemapStore.ts
  styles/globals.css
types.ts
```

---

## 5) Core logic (d3 treemap)

```ts
// lib/d3Treemap.ts
import { hierarchy, treemap, treemapSquarify } from 'd3-hierarchy';

export function buildTreemap(rootData: any, width: number, height: number) {
  const root = hierarchy(rootData)
    .sum((d: any) => d.data?.marketCap || 0)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  return treemap<Node & { data?: any }>()
    .tile(treemapSquarify.ratio(1.1))
    .size([width, height])
    .paddingInner(2)
    .paddingOuter(4)(root);
}
```

---

## 6) Color helpers

```ts
// lib/color.ts
export const clamp = (v:number, lo:number, hi:number) => Math.max(lo, Math.min(hi, v));
export function colorForChange(pct: number) {
  const x = clamp(pct, -3, 3) / 3; // -1..1
  if (x < 0) { // red→gray
    const t = 1 + x; // 0..1
    return mix('#c0392b', '#3a3f44', t);
  } else { // gray→green
    const t = x; // 0..1
    return mix('#3a3f44', '#27ae60', t);
  }
}
// tiny hex mixer
function mix(a:string,b:string,t:number){ const ah=parseInt(a.slice(1),16), bh=parseInt(b.slice(1),16);
  const ar=(ah>>16)&255, ag=(ah>>8)&255, ab=ah&255;
  const br=(bh>>16)&255, bg=(bh>>8)&255, bb=bh&255;
  const r=Math.round(ar+(br-ar)*t), g=Math.round(ag+(bg-ag)*t), b2=Math.round(ab+(bb-ab)*t);
  return `#${((1<<24)+(r<<16)+(g<<8)+b2).toString(16).slice(1)}`;
}
```

---

## 7) Mock NASDAQ-100 data

* Hardcode a list of **NQ100 tickers → sector/industry** (static JSON).
* Generate market caps and changes with noise; add spark arrays.

```ts
// lib/mock.ts
import symbols from './nasdaq100_symbols.json';
export function mockQuotes(): Quote[] {
  return symbols.map(s => ({
    symbol: s.symbol, name: s.name,
    sector: s.sector, industry: s.industry,
    marketCap: s.weight * 1e9, // or random cap
    changePct: +(Math.max(-4, Math.min(4, (Math.random()-0.5)*6))).toFixed(2),
    last: +(100 + Math.random()*500).toFixed(2),
    spark: Array.from({length: 40}, (_,i)=> Math.max(0, Math.min(1, 0.5 + 0.3*Math.sin(i/5)+ (Math.random()-0.5)*0.2)))
  }));
}
export function buildHierarchy(quotes: Quote[]): NodeDatum {
  const bySector = groupBy(quotes, q=>q.sector);
  return { name: 'root', children: Object.entries(bySector).map(([sector, arr])=>{
    const byInd = groupBy(arr, q=>q.industry);
    return {
      name: sector,
      children: Object.entries(byInd).map(([ind, arr2])=>({
        name: ind,
        children: arr2.map(q => ({ name: q.symbol, data: q }))
      }))
    };
  })};
}
function groupBy<T>(xs:T[], f:(x:T)=>string){ return xs.reduce((m, x)=>{ const k=f(x); (m[k] ||= []).push(x); return m;}, {} as Record<string,T[]>); }
```

Use **SWR** to pretend-fetch:

```ts
// app/page.tsx
import useSWR from 'swr';
import { mockQuotes, buildHierarchy } from '@/lib/mock';
const fetcher = async () => {
  const quotes = mockQuotes(); // later: real API
  return buildHierarchy(quotes);
};
```

---

## 8) Treemap component (SVG)

```tsx
// components/Treemap.tsx
'use client';
import { useMemo, useRef, useState } from 'react';
import { buildTreemap } from '@/lib/d3Treemap';
import { colorForChange } from '@/lib/color';
import { useTreemapStore } from '@/store/useTreemapStore';

export default function Treemap({rootData}:{rootData:any}) {
  const ref = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({w: 1200, h: 700}); // swap for ResizeObserver
  const nodes = useMemo(()=> buildTreemap(rootData, size.w, size.h).leaves(), [rootData, size]);

  const { setHover } = useTreemapStore();
  return (
    <svg ref={ref} width="100%" height={size.h} viewBox={`0 0 ${size.w} ${size.h}`} className="bg-slate-900 rounded-2xl">
      {nodes.map((n)=> {
        const q = n.data.data; // Quote
        const x = n.x0, y = n.y0, w = n.x1-n.x0, h = n.y1-n.y0;
        return (
          <g key={q.symbol} transform={`translate(${x},${y})`}
             onMouseEnter={()=> setHover(q)} onMouseLeave={()=> setHover(null)}>
            <rect rx={6} ry={6} width={w} height={h} fill={colorForChange(q.changePct)} />
            <text x={8} y={18} className="fill-white font-bold text-[12px]">{q.symbol}</text>
            <text x={8} y={36} className="fill-white/80 text-[11px]">{q.changePct > 0 ? '+' : ''}{q.changePct}%</text>
          </g>
        );
      })}
    </svg>
  );
}
```

---

## 9) Tooltip & sparkline

```tsx
// components/Tooltip.tsx
'use client';
import { useTreemapStore } from '@/store/useTreemapStore';

export default function Tooltip(){
  const { hover } = useTreemapStore();
  if(!hover) return null;
  return (
    <div className="fixed pointer-events-none left-4 bottom-4 p-4 rounded-xl bg-slate-800 text-white shadow-xl">
      <div className="text-sm opacity-70">{hover.sector} · {hover.industry}</div>
      <div className="text-xl font-bold">{hover.symbol} <span className="ml-2 text-base">{hover.last}</span></div>
      <div className="text-sm">{hover.name}</div>
      <Spark data={hover.spark}/>
      <div className="mt-1">{hover.changePct>0?'+':''}{hover.changePct}%</div>
    </div>
  );
}

// components/Spark.tsx
export function Spark({data}:{data:number[]}) {
  const w=140, h=36;
  const pts = data.map((v,i)=> `${(i/(data.length-1))*w},${h-(v*h)}`).join(' ');
  return <svg width={w} height={h}><polyline fill="none" stroke="currentColor" strokeWidth="2" points={pts} /></svg>;
}
```

---

## 10) Global state (hover, zoom, filters)

```ts
// store/useTreemapStore.ts
import { create } from 'zustand';
import { Quote } from '@/types';
type S = { hover: Quote|null; setHover:(q:Quote|null)=>void; sector?:string; setSector:(s?:string)=>void; };
export const useTreemapStore = create<S>((set)=>({
  hover: null, setHover:(hover)=>set({hover}),
  sector: undefined, setSector:(sector)=>set({sector}),
}));
```

---

## 11) Page glue

```tsx
// app/page.tsx
'use client';
import useSWR from 'swr';
import Treemap from '@/components/Treemap';
import Tooltip from '@/components/Tooltip';
import { mockQuotes, buildHierarchy } from '@/lib/mock';

export default function Page(){
  const { data } = useSWR('ndx', async ()=>{
    const quotes = mockQuotes();
    return buildHierarchy(quotes);
  }, { refreshInterval: 30_000 }); // pretend “live”
  if(!data) return <div className="p-6 text-white">Loading…</div>;
  return (
    <main className="p-6 space-y-4">
      <Controls />
      <Treemap rootData={data}/>
      <Legend />
      <Tooltip />
    </main>
  );
}
```

---

## 12) Controls & Legend (quick)

* **Legend**: gradient bar from −3% to +3% with ticks.
* **Controls**: search input (filter leaves), sector dropdown, “zoom to sector/industry”.

Zooming: when zooming to a node, recompute treemap with that node as root and animate via CSS transforms or by interpolating `x0..y1`.

---

## 13) Performance tips

* Keep nodes under ~400; group micro-caps as “OTHER”.
* Memoize layout; only recompute when data or zoom target changes.
* Use a `ResizeObserver` to make SVG responsive to container width.

---

## 14) Testing & polish

* Snapshot test `buildHierarchy` and color mapping edge cases.
* Add keyboard nav (arrow keys cycle hover).
* Add accessible titles (`<title>` on rects) for screen readers.

---

## 15) Future (when you go real-time)

* Replace `mockQuotes()` with a server route `/api/ndx` that fetches quotes & historical bars.
* Move layout to a **server action** if you ever compute for larger universes (S&P 500).
