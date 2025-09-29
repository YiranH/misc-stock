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
