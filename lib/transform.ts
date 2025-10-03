import { NodeDatum, Quote } from '@/types';

export function buildHierarchy(quotes: Quote[]): NodeDatum {
  const bySector = groupBy(quotes, (q) => q.sector || 'Unknown');
  return {
    name: 'root',
    children: Object.entries(bySector).map(([sector, sectorQuotes]) => {
      const byIndustry = groupBy(sectorQuotes, (q) => q.industry || 'Other');
      return {
        name: sector,
        children: Object.entries(byIndustry).map(([industry, industryQuotes]) => ({
          name: industry,
          children: industryQuotes.map((quote) => ({ name: quote.symbol, data: quote })),
        })),
      };
    }),
  };
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return items.reduce<Record<string, T[]>>((acc, item) => {
    const key = keyFn(item) || 'Unknown';
    (acc[key] ||= []).push(item);
    return acc;
  }, {});
}
