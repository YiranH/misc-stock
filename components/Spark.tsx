'use client';

import { QuoteSpark } from '@/types';

type SparkProps = {
  spark: QuoteSpark | null;
  width?: number;
  height?: number;
};

export default function Spark({ spark, width = 200, height = 40 }: SparkProps) {
  if (!spark || spark.closes.length < 2) {
    return <div className="mt-1 h-[40px] text-xs text-white/50">Sparkline unavailable</div>;
  }
  const { closes } = spark;
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;
  const points = closes
    .map((close, i) => {
      const x = (i / (closes.length - 1)) * width;
      const y = height - ((close - min) / range) * height;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} className="mt-1">
      <polyline fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" points={points} />
    </svg>
  );
}
