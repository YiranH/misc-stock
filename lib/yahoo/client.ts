import yahooFinance from 'yahoo-finance2';
import { Quote, QuoteSpark } from '@/types';
import { RosterEntry } from '@/lib/roster';

const QUOTE_BATCH_SIZE = 20;
const SPARK_BATCH_SIZE = 20;
const SPARK_OPTIONS = {
  range: '1d' as const,
  interval: '5m' as const,
};
const SUMMARY_MODULES = ['summaryDetail', 'defaultKeyStatistics', 'price', 'assetProfile'] as const;

type YahooQuoteResponse = Awaited<ReturnType<typeof yahooFinance.quote>>;
type YahooQuote = YahooQuoteResponse extends (infer U)[] ? U : never;
type YahooSummary = Awaited<ReturnType<typeof yahooFinance.quoteSummary>>;
type YahooSparkResponse = Awaited<ReturnType<typeof yahooFinance.spark>>;
type YahooSpark = YahooSparkResponse extends (infer U)[] ? U : never;

type QuoteBundle = {
  quote: YahooQuote | null;
  summary: YahooSummary | null;
  spark: YahooSpark | null;
  errors: string[];
};

let fetchReady: Promise<void> | null = null;

async function ensureFetch(): Promise<void> {
  if (typeof globalThis.fetch === 'function') return;
  if (!fetchReady) {
    fetchReady = import('node-fetch')
      .then(({ default: fetch }) => {
        (globalThis as any).fetch = fetch as unknown as typeof globalThis.fetch;
      })
      .catch((err) => {
        fetchReady = null;
        throw err;
      });
  }
  await fetchReady;
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

function ensureNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }
  return null;
}

function normalizeSpark(raw: YahooSpark | null | undefined): QuoteSpark | null {
  if (!raw || !raw.response || raw.response.length === 0) return null;
  const resp = raw.response[0];
  const timestamps = Array.isArray(resp.timestamp) ? resp.timestamp : [];
  const closes = Array.isArray(resp.close) ? resp.close : [];
  if (!timestamps.length || !closes.length) return null;
  const normalizedTimestamps: number[] = [];
  const normalizedCloses: number[] = [];
  for (let i = 0; i < timestamps.length && i < closes.length; i += 1) {
    const ts = ensureNumber(timestamps[i]);
    const close = ensureNumber(closes[i]);
    if (ts === null || close === null) continue;
    normalizedTimestamps.push(ts * 1000);
    normalizedCloses.push(close);
  }
  if (!normalizedTimestamps.length || !normalizedCloses.length) return null;
  return {
    interval: resp.interval ?? resp.dataGranularity ?? SPARK_OPTIONS.interval,
    timestamps: normalizedTimestamps,
    closes: normalizedCloses,
  };
}

function deriveChangePct(rawChangePct: number | null, last: number | null, previousClose: number | null): number {
  if (rawChangePct !== null) return Number(rawChangePct.toFixed(2));
  if (last !== null && previousClose !== null && previousClose !== 0) {
    return Number((((last - previousClose) / previousClose) * 100).toFixed(2));
  }
  return 0;
}

function pickName(entry: RosterEntry, quote: YahooQuote | null, summary: any): string {
  const summaryPrice = summary?.price;
  if (summaryPrice?.longName) return summaryPrice.longName;
  if (summaryPrice?.shortName) return summaryPrice.shortName;
  if (quote?.longName) return quote.longName;
  if (quote?.shortName) return quote.shortName;
  if (quote?.displayName) return quote.displayName;
  return entry.name ?? entry.symbol;
}

export async function fetchQuoteBundles(symbols: string[]): Promise<Map<string, QuoteBundle>> {
  await ensureFetch();
  const bundles = new Map<string, QuoteBundle>();
  symbols.forEach((symbol) => {
    bundles.set(symbol, { quote: null, summary: null, spark: null, errors: [] });
  });

  for (const slice of chunk(symbols, QUOTE_BATCH_SIZE)) {
    try {
      const quotes = await yahooFinance.quote(slice);
      quotes.forEach((q) => {
        const target = bundles.get(q.symbol);
        if (target) {
          target.quote = q;
        }
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      slice.forEach((symbol) => {
        const target = bundles.get(symbol);
        if (target) target.errors.push(`quote: ${msg}`);
      });
    }
  }

  for (const symbol of symbols) {
    try {
      const summary = await yahooFinance.quoteSummary(symbol, { modules: SUMMARY_MODULES as unknown as any });
      const target = bundles.get(symbol);
      if (target) target.summary = summary;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const target = bundles.get(symbol);
      if (target) target.errors.push(`summary: ${msg}`);
    }
  }

  for (const slice of chunk(symbols, SPARK_BATCH_SIZE)) {
    try {
      const sparks = await yahooFinance.spark(slice, SPARK_OPTIONS);
      sparks.forEach((entry) => {
        const target = bundles.get(entry.symbol);
        if (target) target.spark = entry;
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      slice.forEach((symbol) => {
        const target = bundles.get(symbol);
        if (target) target.errors.push(`spark: ${msg}`);
      });
    }
  }

  return bundles;
}

export function normalizeQuote(entry: RosterEntry, bundle: QuoteBundle, fetchedAt: string): { quote: Quote; rawQuote: unknown; rawSummary: unknown; rawSpark: unknown; errors: string[] } {
  const quote = bundle.quote;
  const summary = bundle.summary as any;
  const spark = bundle.spark;
  const assetProfile = summary?.assetProfile ?? null;

  const marketCap = ensureNumber(quote?.marketCap) ?? ensureNumber(summary?.summaryDetail?.marketCap?.raw);
  const peRatio = ensureNumber(quote?.trailingPE) ?? ensureNumber(summary?.summaryDetail?.trailingPE) ?? ensureNumber(summary?.defaultKeyStatistics?.trailingPE);
  const beta = ensureNumber(quote?.beta) ?? ensureNumber(summary?.defaultKeyStatistics?.beta);
  const eps = ensureNumber(quote?.epsTrailingTwelveMonths) ?? ensureNumber(summary?.defaultKeyStatistics?.trailingEps);
  const dividendYield = ensureNumber(summary?.summaryDetail?.dividendYield) ?? ensureNumber(quote?.trailingAnnualDividendYield);
  const fiftyTwoWeekHigh = ensureNumber(quote?.fiftyTwoWeekHigh) ?? ensureNumber(summary?.summaryDetail?.fiftyTwoWeekHigh?.raw);
  const fiftyTwoWeekLow = ensureNumber(quote?.fiftyTwoWeekLow) ?? ensureNumber(summary?.summaryDetail?.fiftyTwoWeekLow?.raw);
  const fiftyTwoWeekChange = ensureNumber(quote?.fiftyTwoWeekChange);
  const fiftyTwoWeekChangePct = ensureNumber(quote?.fiftyTwoWeekChangePercent);
  const averageVolume10Day = ensureNumber(quote?.averageDailyVolume10Day);
  const averageVolume30Day = ensureNumber(quote?.averageDailyVolume3Month);
  const volume = ensureNumber(quote?.regularMarketVolume);
  const previousClose = ensureNumber(quote?.regularMarketPreviousClose);
  const open = ensureNumber(quote?.regularMarketOpen);
  const dayHigh = ensureNumber(quote?.regularMarketDayHigh);
  const dayLow = ensureNumber(quote?.regularMarketDayLow);
  const last = ensureNumber(quote?.regularMarketPrice);
  const changePct = deriveChangePct(ensureNumber(quote?.regularMarketChangePercent), last, previousClose);

  const normalized: Quote = {
    symbol: entry.symbol,
    name: pickName(entry, quote ?? null, summary),
    sector: assetProfile?.sector ?? entry.sector ?? null,
    industry: assetProfile?.industry ?? entry.industry ?? null,
    weight: null,
    marketCap,
    changePct,
    last,
    previousClose,
    open,
    dayHigh,
    dayLow,
    volume,
    averageVolume10Day,
    averageVolume30Day,
    peRatio,
    beta,
    eps,
    dividendYield,
    fiftyTwoWeekHigh,
    fiftyTwoWeekLow,
    fiftyTwoWeekChange,
    fiftyTwoWeekChangePct,
    marketState: quote?.marketState ?? null,
    fetchedAt,
    spark: normalizeSpark(spark),
  };

  return {
    quote: normalized,
    rawQuote: quote ?? null,
    rawSummary: summary ?? null,
    rawSpark: spark ?? null,
    errors: bundle.errors,
  };
}
