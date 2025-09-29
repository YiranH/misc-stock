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
