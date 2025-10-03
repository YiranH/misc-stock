import rawSymbols from '@/data/nasdaq100_symbols.json';
import { Quote, QuoteSpark } from '@/types';

const SYMBOLS = (rawSymbols as string[]).map((symbol) => symbol.toUpperCase());

const SECTORS = [
  'Technology',
  'Consumer Discretionary',
  'Communication Services',
  'Healthcare',
  'Financials',
  'Industrials',
];

const INDUSTRIES = [
  'Software',
  'Semiconductors',
  'Internet Retail',
  'Entertainment',
  'Hardware',
  'Financial Services',
  'Biotechnology',
];

function buildMockSpark(base: number): QuoteSpark {
  const points = 48;
  const intervalMinutes = 5;
  const closes: number[] = [];
  const timestamps: number[] = [];
  const start = Date.now() - (points - 1) * intervalMinutes * 60 * 1000;
  for (let i = 0; i < points; i += 1) {
    const t = start + i * intervalMinutes * 60 * 1000;
    const noise = (Math.random() - 0.5) * 2.5;
    const trend = Math.sin(i / 6) * 1.5;
    const close = Math.max(1, base + trend + noise);
    closes.push(Number(close.toFixed(2)));
    timestamps.push(t);
  }
  return {
    interval: `${intervalMinutes}m`,
    timestamps,
    closes,
  };
}

export function mockQuotes(): Quote[] {
  const fetchedAt = new Date().toISOString();
  const quotes = SYMBOLS.map((symbol, index) => {
    const spark = buildMockSpark(75 + Math.random() * 150);
    const last = spark.closes[spark.closes.length - 1];
    const first = spark.closes[0];
    const changePct = Number((((last - first) / first) * 100).toFixed(2));
    const previousClose = Number((last / (1 + changePct / 100)).toFixed(2));
    const sector = SECTORS[index % SECTORS.length];
    const industry = INDUSTRIES[index % INDUSTRIES.length];
    const marketCap = Math.round((100 + index * 3 + Math.random() * 20) * 1e9);
    return {
      symbol,
      name: `${symbol} Corp.`,
      sector,
      industry,
      weight: null,
      marketCap,
      changePct,
      last,
      previousClose,
      open: Number((previousClose * (1 + (Math.random() - 0.5) * 0.02)).toFixed(2)),
      dayHigh: Number((Math.max(last, previousClose) * (1 + Math.random() * 0.01)).toFixed(2)),
      dayLow: Number((Math.min(last, previousClose) * (1 - Math.random() * 0.01)).toFixed(2)),
      volume: Math.round(5_000_000 + Math.random() * 20_000_000),
      averageVolume10Day: Math.round(4_800_000 + Math.random() * 15_000_000),
      averageVolume30Day: Math.round(4_500_000 + Math.random() * 12_000_000),
      peRatio: Number((10 + Math.random() * 25).toFixed(2)),
      beta: Number((0.5 + Math.random()).toFixed(2)),
      eps: Number((2 + Math.random() * 8).toFixed(2)),
      dividendYield: Number((Math.random()).toFixed(2)),
      fiftyTwoWeekHigh: Number((last * 1.2).toFixed(2)),
      fiftyTwoWeekLow: Number((last * 0.8).toFixed(2)),
      fiftyTwoWeekChange: Number(((last - last * 0.9)).toFixed(2)),
      fiftyTwoWeekChangePct: Number(((last - last * 0.9) / (last * 0.9) * 100).toFixed(2)),
      marketState: 'REGULAR',
      fetchedAt,
      spark,
    };
  });

  const totalCap = quotes.reduce((sum, quote) => sum + (quote.marketCap ?? 0), 0);
  if (totalCap > 0) {
    quotes.forEach((quote) => {
      if (quote.marketCap && quote.marketCap > 0) {
        quote.weight = Number(((quote.marketCap / totalCap) * 100).toFixed(2));
      } else {
        quote.weight = null;
      }
    });
  }

  return quotes;
}

export { buildHierarchy } from './transform';
