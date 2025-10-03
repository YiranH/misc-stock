import { create } from 'zustand';
import { Quote } from '@/types';

type S = {
  hover: Quote | null; setHover: (q: Quote | null) => void;
  hoverEl: Element | null; setHoverEl: (el: Element | null) => void;
  search: string; setSearch: (s: string) => void;
  sector: string | 'ALL'; setSector: (s: string | 'ALL') => void;
  minAbsChange: number; setMinAbsChange: (n: number) => void;
  zoomPath: string[]; setZoomPath: (path: string[]) => void;
};

export const useTreemapStore = create<S>((set) => ({
  hover: null, setHover: (hover) => set({ hover }),
  hoverEl: null, setHoverEl: (hoverEl) => set({ hoverEl }),
  search: '', setSearch: (search) => set({ search }),
  sector: 'ALL', setSector: (sector) => set({ sector }),
  minAbsChange: 0, setMinAbsChange: (minAbsChange) => set({ minAbsChange }),
  zoomPath: [], setZoomPath: (zoomPath) => set({ zoomPath }),
}));
