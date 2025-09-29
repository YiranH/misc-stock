'use client';

type LegendProps = {
  domain: [number, number]; // e.g. [-3, 3]
  ticks?: number[];
  formatter?: (v: number) => string;
};

export default function Legend({ domain, ticks, formatter }: LegendProps) {
  const [min, max] = domain;
  const values = ticks ?? Array.from({ length: 7 }, (_, i) => min + (i * (max - min)) / 6);
  const fmt = formatter ?? ((v: number) => `${v}%`);
  return (
    <div className="flex items-center gap-3">
      <div className="h-3 w-56 rounded bg-gradient-to-r from-[#c0392b] via-[#3a3f44] to-[#27ae60]" />
      <div className="flex justify-between w-56 text-xs opacity-80">
        {values.map(v => <span key={v}>{fmt(Number(v.toFixed(1)))}</span>)}
      </div>
    </div>
  );
}
