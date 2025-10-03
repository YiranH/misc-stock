import type { Document } from 'mongodb';

export type QuoteSpark = {
  interval: string;
  timestamps: number[];
  closes: number[];
};

export type Quote = {
  symbol: string;
  name: string;
  sector: string;
  industry: string;
  weight: number | null;
  marketCap: number | null;
  changePct: number;
  last: number | null;
  previousClose: number | null;
  open: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  volume: number | null;
  averageVolume10Day: number | null;
  averageVolume30Day: number | null;
  peRatio: number | null;
  beta: number | null;
  eps: number | null;
  dividendYield: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  fiftyTwoWeekChange: number | null;
  fiftyTwoWeekChangePct: number | null;
  marketState: string | null;
  fetchedAt: string;
  spark: QuoteSpark | null;
};

export type NodeDatum = {
  name: string;
  children?: NodeDatum[];
  data?: Quote;
};

export type QuoteDocument = Document & {
  _id: string;
  fetchedAt: string;
  quote: Quote;
  rawQuote?: unknown;
  rawSummary?: unknown;
  rawSpark?: unknown;
};
