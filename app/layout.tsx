import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'NASDAQ‑100 Treemap',
  description: 'Finviz‑style treemap with d3-hierarchy',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-900 min-h-screen text-white">{children}</body>
    </html>
  );
}
