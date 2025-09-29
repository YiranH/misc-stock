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
