'use client';
import useSWR from 'swr';
import Treemap from '@/components/Treemap';
import Tooltip from '@/components/Tooltip';
import Legend from '@/components/Legend';
import Controls from '@/components/Controls';
import { useMeasure } from '@/lib/useMeasure';
import { buildHierarchy } from '@/lib/transform';
import { useTreemapStore } from '@/store/useTreemapStore';
import { Quote } from '@/types';

function uniqueSectors(quotes: Quote[]) {
  return Array.from(new Set(quotes.map(q => q.sector))).sort();
}

type ApiPayload = {
  quotes: Quote[];
  fetchedAt: string | null;
  source: 'memory' | 'database' | 'refresh';
  refreshed: boolean;
};

const fetcher = async (url: string): Promise<ApiPayload> => {
  const res = await fetch(url);
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = payload?.error ?? 'Failed to load quotes';
    throw new Error(error);
  }
  return payload as ApiPayload;
};

export default function Page() {
  const { search, sector, minAbsChange } = useTreemapStore();
  const { data, error } = useSWR<ApiPayload>('/api/ndx', fetcher, { refreshInterval: 60_000 });
  const { ref, width, height } = useMeasure<HTMLDivElement>();

  if (error) {
    return <div className="p-6 text-red-500">{error.message}</div>;
  }

  if (!data) {
    return <div className="p-6">Loading…</div>;
  }

  const quotes = data.quotes;

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
      <div className="space-y-1 text-xs text-white/60">
        <div>
          Last update: {data.fetchedAt ? new Date(data.fetchedAt).toLocaleString() : 'unknown'}
          {data.source ? ` · Source: ${data.source}` : ''}
        </div>
        <p>Data updates daily after market close.</p>
      </div>
      <div ref={ref} className="h-[72vh] w-full">
        {width > 0 && height > 0 && (
          <Treemap rootData={rootData} width={width} height={height} />
        )}
      </div>
      <Legend domain={[-3, 3]} />
      <Tooltip />
    </main>
  );
}
