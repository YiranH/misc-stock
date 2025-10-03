'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTreemapStore } from '@/store/useTreemapStore';
import Spark from './Spark';

function formatNumber(value: number | null, options?: Intl.NumberFormatOptions) {
  if (value == null || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('en-US', options).format(value);
}

function formatPercent(value: number | null) {
  if (value == null || Number.isNaN(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

const GAP = 8;
const VIEWPORT_MARGIN = 8;

export default function Tooltip() {
  const { hover, hoverEl } = useTreemapStore();
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [position, setPosition] = useState({ top: -9999, left: -9999 });
  const [isPositioned, setIsPositioned] = useState(false);

  useEffect(() => {
    if (!hover) {
      setIsPositioned(false);
      setPosition({ top: -9999, left: -9999 });
    }
  }, [hover]);

  useEffect(() => {
    const node = tooltipRef.current;
    if (!node) return;

    if (typeof ResizeObserver === 'undefined') {
      const rect = node.getBoundingClientRect();
      setSize({ width: Math.round(rect.width), height: Math.round(rect.height) });
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const next = {
        width: Math.round(entry.contentRect.width),
        height: Math.round(entry.contentRect.height),
      };
      setSize((prev) => (prev.width === next.width && prev.height === next.height ? prev : next));
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, [hover]);

  const computePosition = useCallback(() => {
    if (!hoverEl) return;

    const rect = hoverEl.getBoundingClientRect();
    let width = size.width;
    let height = size.height;

    if ((!width || !height) && tooltipRef.current) {
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      width = Math.round(tooltipRect.width);
      height = Math.round(tooltipRect.height);
      if (width && height) {
        setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
      }
    }

    if (!width || !height) return;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const placements = [
      { side: 'right' as const, left: rect.right + GAP, top: rect.top },
      { side: 'left' as const, left: rect.left - width - GAP, top: rect.top },
      { side: 'top' as const, left: rect.left, top: rect.top - height - GAP },
      { side: 'bottom' as const, left: rect.left, top: rect.bottom + GAP },
    ];

    const fits = (candidate: typeof placements[number]) =>
      candidate.left >= VIEWPORT_MARGIN &&
      candidate.top >= VIEWPORT_MARGIN &&
      candidate.left + width <= vw - VIEWPORT_MARGIN &&
      candidate.top + height <= vh - VIEWPORT_MARGIN;

    let chosen = placements.find(fits);

    if (!chosen) {
      let maxVisible = -Infinity;
      for (const candidate of placements) {
        const visibleWidth = Math.min(candidate.left + width, vw - VIEWPORT_MARGIN) - Math.max(candidate.left, VIEWPORT_MARGIN);
        const visibleHeight = Math.min(candidate.top + height, vh - VIEWPORT_MARGIN) - Math.max(candidate.top, VIEWPORT_MARGIN);
        const visibleArea = Math.max(0, visibleWidth) * Math.max(0, visibleHeight);
        if (visibleArea > maxVisible) {
          maxVisible = visibleArea;
          chosen = candidate;
        }
      }
      chosen ||= placements[0];
    }

    const clampedLeft = Math.min(
      Math.max(chosen.left, VIEWPORT_MARGIN),
      Math.max(VIEWPORT_MARGIN, vw - width - VIEWPORT_MARGIN)
    );
    const clampedTop = Math.min(
      Math.max(chosen.top, VIEWPORT_MARGIN),
      Math.max(VIEWPORT_MARGIN, vh - height - VIEWPORT_MARGIN)
    );

    setPosition({ left: Math.round(clampedLeft), top: Math.round(clampedTop) });
    setIsPositioned(true);
  }, [hoverEl, size.height, size.width]);

  useEffect(() => {
    if (!hover || !hoverEl) return;

    setIsPositioned(false);

    let rafId: number | null = null;

    const schedule = () => {
      rafId = requestAnimationFrame(() => {
        computePosition();
        rafId = null;
      });
    };

    schedule();
    window.addEventListener('resize', computePosition, { passive: true });
    window.addEventListener('scroll', computePosition, { passive: true });

    return () => {
      if (rafId != null) {
        cancelAnimationFrame(rafId);
      }
      window.removeEventListener('resize', computePosition);
      window.removeEventListener('scroll', computePosition);
    };
  }, [hover, hoverEl, computePosition]);

  if (!hover) return null;

  return (
    <div
      ref={tooltipRef}
      style={{
        top: position.top,
        left: position.left,
        opacity: isPositioned ? 1 : 0,
        transform: isPositioned ? 'translateY(0)' : 'translateY(4px)',
      }}
      className="pointer-events-none fixed z-50 w-[300px] max-w-[320px] rounded-xl bg-slate-800/95 p-4 text-white shadow-xl transition duration-150 ease-out"
    >
      <div className="text-xs opacity-70">{hover.sector} · {hover.industry}</div>
      <div className="text-lg font-semibold">
        {hover.symbol}
        <span className="ml-2 text-sm">{formatNumber(hover.last, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      </div>
      <div className="mb-2 truncate text-sm">{hover.name}</div>
      <Spark spark={hover.spark} />
      <div className="mt-2 flex items-center justify-between text-sm">
        <span>{formatPercent(hover.changePct)}</span>
        <span className="text-xs text-white/60">Updated {hover.fetchedAt ? new Date(hover.fetchedAt).toLocaleTimeString() : '—'}</span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-white/80">
        <span>Market Cap</span>
        <span className="text-right">{hover.marketCap ? `${formatNumber(hover.marketCap / 1e9, { maximumFractionDigits: 1 })}B` : '—'}</span>
        <span>P/E Ratio</span>
        <span className="text-right">{hover.peRatio != null ? hover.peRatio.toFixed(2) : '—'}</span>
        <span>52w Range</span>
        <span className="text-right">{formatNumber(hover.fiftyTwoWeekLow, { maximumFractionDigits: 2 })} → {formatNumber(hover.fiftyTwoWeekHigh, { maximumFractionDigits: 2 })}</span>
        <span>Avg Vol (30d)</span>
        <span className="text-right">{formatNumber(hover.averageVolume30Day)}</span>
      </div>
    </div>
  );
}
