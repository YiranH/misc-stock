'use client';
import { useMemo } from 'react';
import { HierarchyRectangularNode } from 'd3-hierarchy';
import { NodeDatum, Quote } from '@/types';
import { buildTreemapLayout } from '@/lib/d3Treemap';
import { colorForChange } from '@/lib/color';
import { useTreemapStore } from '@/store/useTreemapStore';

type TreemapProps = {
  rootData: NodeDatum;
  width: number;
  height: number;
};

export default function Treemap({ rootData, width, height }: TreemapProps) {
  const rectRoot: HierarchyRectangularNode<NodeDatum> = useMemo(
    () => buildTreemapLayout(rootData, width, height),
    [rootData, width, height]
  );
  const leaves = rectRoot.leaves();
  const { setHover, setHoverEl } = useTreemapStore();

  return (
    <svg width={width} height={height} className="bg-slate-850 rounded-lg">
      {leaves.map(n => {
        const q = n.data.data!; // Quote present on leaves
        const w = n.x1 - n.x0, h = n.y1 - n.y0;
        return (
          <g key={q.symbol} transform={`translate(${n.x0},${n.y0})`}
             onMouseEnter={(e) => {
               setHover(q);
               setHoverEl(e.currentTarget);
             }}
             onMouseLeave={() => {
               setHover(null);
               setHoverEl(null);
             }}>
            <rect rx={3} ry={3} width={w} height={h} fill={colorForChange(q.changePct)} />
            <text x={8} y={18} className="fill-white font-bold text-[12px] select-none">{q.symbol}</text>
            <text x={8} y={36} className="fill-white/80 text-[11px] select-none">{q.changePct > 0 ? '+' : ''}{q.changePct}%</text>
          </g>
        );
      })}
    </svg>
  );
}
