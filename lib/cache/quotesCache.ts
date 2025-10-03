import { Quote } from '@/types';

type QuotesCache = {
  quotes: Quote[];
  fetchedAt: number;
};

let cache: QuotesCache | null = null;

export function getCachedQuotes(maxAgeMs: number): Quote[] | null {
  if (!cache) return null;
  if (Date.now() - cache.fetchedAt > maxAgeMs) return null;
  return cache.quotes.map((q) => ({ ...q, spark: q.spark ? { ...q.spark, timestamps: [...q.spark.timestamps], closes: [...q.spark.closes] } : null }));
}

export function setCachedQuotes(quotes: Quote[]): void {
  cache = {
    quotes: quotes.map((q) => ({ ...q, spark: q.spark ? { ...q.spark, timestamps: [...q.spark.timestamps], closes: [...q.spark.closes] } : null })),
    fetchedAt: Date.now(),
  };
}

export function clearQuotesCache(): void {
  cache = null;
}
