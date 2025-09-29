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
