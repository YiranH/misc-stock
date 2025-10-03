# Tooltip Smart Anchoring Plan

Goal: Make the detail box (tooltip) flexible and non-obstructive by anchoring it to the hovered tile with viewport-aware flip/shift behavior. The tooltip should prefer sitting outside the hovered tile, not hide the sector context, and never go off-screen.

## UX Objectives
- Anchor to the hovered tile, not a fixed corner.
- Prefer placement to the right/top-left depending on space; flip when colliding.
- Keep the tooltip outside the tile so the sector remains visible.
- Avoid jitter; smooth repositions with a subtle transition.
- Never block interactions with the treemap (pointer-events: none on tooltip).
- No new dependencies required (Floating UI optional later).

## State & Data Model
- Extend global store (`zustand`) to track the tile element for accurate, live rects:
  - `hover: Quote | null`
  - `hoverEl: Element | null` — reference to the `<g>` (SVG group) for the hovered tile
  - `setHover`, `setHoverEl`
- Do NOT only store a static rect. When the page scrolls/resizes, the rect changes; keeping the element lets us recompute the rect cheaply.

## Event Flow
1. User hovers a tile.
2. Treemap sets `hover` and `hoverEl` on `mouseenter` and clears them on `mouseleave`.
3. Tooltip renders when `hover` is set; it measures its own size.
4. Tooltip computes position using `hoverEl.getBoundingClientRect()` and its measured size.
5. On `scroll`/`resize`, Tooltip recomputes position using the same `hoverEl`.

## Positioning Strategy
- Positioning context: `position: fixed` so coordinates are viewport-based.
- Preferred placements (in order): `right-start` → `left-start` → `top-start` → `bottom-start`.
- Spacing: `gap = 8px` between tile and tooltip; `margin = 8px` min distance to viewport edges.
- Flip: If preferred side has insufficient space to fit width/height, try the next side.
- Shift: Clamp `top`/`left` within viewport margins to avoid overflow.
- Fallback: If none fully fit, pick the placement that yields max visible area, then clamp.

### Computation Details
- Viewport: `vw = window.innerWidth`, `vh = window.innerHeight`.
- Anchor: `r = hoverEl.getBoundingClientRect()`.
- Tooltip size: measured via `ResizeObserver` on a `ref` (`w`, `h`).
- Candidate placements (unclamped):
  - right-start: `left = r.right + gap`, `top = r.top`
  - left-start: `left = r.left - w - gap`, `top = r.top`
  - top-start: `left = r.left`, `top = r.top - h - gap`
  - bottom-start: `left = r.left`, `top = r.bottom + gap`
- After choosing a placement, clamp within margins:
  - `left = Math.min(Math.max(left, margin), vw - w - margin)`
  - `top  = Math.min(Math.max(top,  margin), vh - h - margin)`
- Heuristics for tiny tiles: If `r.height < 18` or `r.width < 36`, bias to `right-start`/`left-start` to avoid covering the tile itself; if both sides fail, use `bottom-start`.

## File-level Changes

1) store/useTreemapStore.ts
- Add:
  - `hoverEl: Element | null`
  - `setHoverEl: (el: Element | null) => void`
- Keep `hover` + `setHover` as-is.

2) components/Treemap.tsx
- Import store setters and update event handlers:
  - `onMouseEnter={(e) => { setHover(q); setHoverEl(e.currentTarget); }}`
  - `onMouseLeave={() => { setHover(null); setHoverEl(null); }}`
- Optional: Add `onMouseMove={(e) => { /* could update pointer coord if needed later */ }}`
- No prop changes required; keeps existing `onHover` prop or removes it if redundant. Simpler: rely on store directly inside Treemap.

3) components/Tooltip.tsx
- Add a `ref` to the tooltip root for measurement; use `ResizeObserver` to get `{ w, h }`.
- Read `hover` and `hoverEl` from store.
- Compute position in a `useLayoutEffect`/`useEffect` when `hoverEl`, `w`, `h` change.
- Attach passive `scroll` and `resize` listeners to recompute.
- Apply `style={{ top, left }}` and keep `position: fixed`.
- Keep `pointer-events-none` to avoid intercepting input.
- Add a subtle transition: `transition: transform 120ms ease, opacity 120ms ease;` with `opacity: 1` when visible.

## Pseudocode (Tooltip positioning)
```tsx
const [size, setSize] = useState({ w: 0, h: 0 });
const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
const ref = useRef<HTMLDivElement | null>(null);
const { hover, hoverEl } = useTreemapStore();

useEffect(() => {
  if (!ref.current) return;
  const ro = new ResizeObserver((entries) => {
    const r = entries[0].contentRect;
    setSize({ w: Math.round(r.width), h: Math.round(r.height) });
  });
  ro.observe(ref.current);
  return () => ro.disconnect();
}, []);

useEffect(() => {
  if (!hoverEl || !size.w || !size.h) return;

  const recompute = () => {
    const r = hoverEl.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    const gap = 8, margin = 8;

    const candidates = [
      { side: 'right',  left: r.right + gap,  top: r.top },
      { side: 'left',   left: r.left - size.w - gap, top: r.top },
      { side: 'top',    left: r.left, top: r.top - size.h - gap },
      { side: 'bottom', left: r.left, top: r.bottom + gap },
    ];

    const fits = (c: typeof candidates[number]) =>
      c.left >= margin && c.top >= margin &&
      c.left + size.w <= vw - margin && c.top + size.h <= vh - margin;

    let chosen = candidates.find(fits) || candidates[0]; // fallback

    // Clamp within viewport margins
    const left = Math.min(Math.max(chosen.left, margin), vw - size.w - margin);
    const top  = Math.min(Math.max(chosen.top,  margin), vh - size.h - margin);

    setPos({ left, top });
  };

  recompute();
  window.addEventListener('resize', recompute, { passive: true });
  window.addEventListener('scroll', recompute, { passive: true });
  return () => {
    window.removeEventListener('resize', recompute);
    window.removeEventListener('scroll', recompute);
  };
}, [hoverEl, size.w, size.h]);

// Render
return hover ? (
  <div ref={ref} style={{ position: 'fixed', top: pos.top, left: pos.left }}
       className="pointer-events-none ...">
    {/* content */}
  </div>
) : null;
```

## Edge Cases & Behaviors
- Tiles near right edge → flip to the left.
- Tiles near top/bottom → shift/clamp vertically; fallback to top/bottom if both sides are blocked.
- Very small tiles → prefer side placement to keep tile visible; avoid overlapping center.
- Scrolling/Resizing → tooltip follows because we recompute from `hoverEl` rect on events.
- Long names → keep `max-w` with ellipsis. Tooltip width stays ~300px.
- Performance → Rect reads happen on scroll/resize only; `ResizeObserver` avoids polling.

## Accessibility
- Tooltip is purely hover-driven and `pointer-events-none`; screen readers won’t rely on it.
- Consider exposing the same info in a details panel on focus (keyboard nav) in a later iteration.

## Future Enhancements (Optional)
- Arrow connector that points to the tile (CSS ::after positioned via chosen side).
- Use Floating UI for robust middleware (flip, shift, size) if complexity grows.
- Touch support: tap to pin tooltip with close button; tap outside to dismiss.
- Persist last placement side to reduce flips when hovering adjacent tiles.

## Implementation Steps (Checklist)
1. Add `hoverEl` and setter to `store/useTreemapStore.ts`.
2. Update `components/Treemap.tsx` to set/clear `hover` + `hoverEl` on enter/leave.
3. Refactor `components/Tooltip.tsx` to fixed-position with measurement and smart placement.
4. Add scroll/resize listeners and `ResizeObserver`.
5. Add transition classes and maintain `pointer-events-none`.
6. Validate behavior on all edges and with small tiles.
7. Polish: clamp margins, content truncation, minor motion tuning.

## Acceptance Criteria
- Tooltip anchors to the hovered tile and flips/shift to remain fully visible.
- Sector context remains visible; tooltip does not cover large portions of the treemap unnecessarily.
- No noticeable jitter during hover; reposition feels smooth.
- Works when scrolling and resizing the window.
