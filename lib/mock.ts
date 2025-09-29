import symbols from '@/data/nasdaq100.json';
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
