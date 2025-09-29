export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// simple hex mixer
function mix(a: string, b: string, t: number) {
  const ah = parseInt(a.slice(1), 16), bh = parseInt(b.slice(1), 16);
  const ar = (ah >> 16) & 255, ag = (ah >> 8) & 255, ab = ah & 255;
  const br = (bh >> 16) & 255, bg = (bh >> 8) & 255, bb = bh & 255;
  const r = Math.round(ar + (br - ar) * t), g = Math.round(ag + (bg - ag) * t), b2 = Math.round(ab + (bb - ab) * t);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b2).toString(16).slice(1)}`;
}

export function colorForChange(pct: number) {
  const x = clamp(pct, -3, 3) / 3; // -1..1
  if (x < 0) return mix('#c0392b', '#3a3f44', 1 + x); // red→gray
  return mix('#3a3f44', '#27ae60', x);                 // gray→green
}
