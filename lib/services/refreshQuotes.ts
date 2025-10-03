import { Quote, QuoteDocument } from '@/types';
import { getRoster, RosterEntry } from '@/lib/roster';
import { fetchQuoteBundles, normalizeQuote } from '@/lib/yahoo/client';
import { clearQuotesCache, getCachedQuotes, setCachedQuotes } from '@/lib/cache/quotesCache';
import {
  getLatestQuotes,
  mapQuoteDocsToQuotes,
  recordDailySnapshots,
  recordSyncRun,
  upsertLatestQuotes,
} from '@/lib/repository/quotes';

export type RefreshOptions = {
  force?: boolean;
  maxAgeMs?: number;
  recordDaily?: boolean;
};

export type RefreshResult = {
  quotes: Quote[];
  refreshed: boolean;
  source: 'refresh' | 'database' | 'memory';
  fetchedAt: string | null;
  refreshedSymbols: string[];
  skippedSymbols: string[];
};

type LoadOptions = {
  maxAgeMs: number;
  force?: boolean;
};

function computeNewestFetchedAt(quotes: Quote[]): string | null {
  if (!quotes.length) return null;
  return quotes.reduce((latest, quote) => {
    if (!quote.fetchedAt) return latest;
    return latest && latest > quote.fetchedAt ? latest : quote.fetchedAt;
  }, quotes[0].fetchedAt ?? null);
}

function computeAgeMs(timestamp: string | null): number | null {
  if (!timestamp) return null;
  const ts = Date.parse(timestamp);
  if (Number.isNaN(ts)) return null;
  return Date.now() - ts;
}

function applyMarketCapWeights(quotes: Quote[]): void {
  if (!quotes.length) return;
  const eligibleCaps = quotes
    .map((quote) => (typeof quote.marketCap === 'number' && quote.marketCap > 0 ? quote.marketCap : null))
    .filter((cap): cap is number => cap !== null);
  const totalCap = eligibleCaps.reduce((sum, cap) => sum + cap, 0);
  if (totalCap <= 0) {
    quotes.forEach((quote) => {
      quote.weight = null;
    });
    return;
  }
  quotes.forEach((quote) => {
    const cap = typeof quote.marketCap === 'number' && quote.marketCap > 0 ? quote.marketCap : null;
    quote.weight = cap ? Number(((cap / totalCap) * 100).toFixed(4)) : null;
  });
}

export async function loadQuotes(options: LoadOptions): Promise<RefreshResult> {
  const { maxAgeMs, force = false } = options;
  const cached = getCachedQuotes(maxAgeMs);
  if (cached && !force) {
    return {
      quotes: cached,
      refreshed: false,
      source: 'memory',
      fetchedAt: computeNewestFetchedAt(cached),
      refreshedSymbols: [],
      skippedSymbols: [],
    };
  }

  const existingDocs = await getLatestQuotes();
  const existingQuotes = mapQuoteDocsToQuotes(existingDocs);
  const newestFetchedAt = computeNewestFetchedAt(existingQuotes);
  const ageMs = computeAgeMs(newestFetchedAt);

  if (!force && existingQuotes.length && ageMs !== null && ageMs <= maxAgeMs) {
    setCachedQuotes(existingQuotes);
    return {
      quotes: existingQuotes,
      refreshed: false,
      source: 'database',
      fetchedAt: newestFetchedAt,
      refreshedSymbols: [],
      skippedSymbols: [],
    };
  }

  const refreshResult = await refreshQuotes({ maxAgeMs, force: true });
  return refreshResult;
}

export async function refreshQuotes(options: RefreshOptions = {}): Promise<RefreshResult> {
  const startedAt = Date.now();
  const { maxAgeMs, recordDaily = true } = options;
  const roster = getRoster();
  const existingDocs = await getLatestQuotes();
  const existingMap = new Map(existingDocs.map((doc) => [doc._id, doc]));

  const symbols = roster.map((entry) => entry.symbol);
  const bundles = await fetchQuoteBundles(symbols);
  const fetchedAtIso = new Date().toISOString();

  const refreshedSymbols: string[] = [];
  const skippedSymbols: string[] = [];
  const finalQuotes: Quote[] = [];
  const toPersist: QuoteDocument[] = [];

  function pushFinalQuote(quote: Quote) {
    finalQuotes.push(quote);
  }

  try {
    roster.forEach((entry: RosterEntry) => {
      const bundle = bundles.get(entry.symbol);
      if (bundle && bundle.quote) {
        const normalized = normalizeQuote(entry, bundle, fetchedAtIso);
        toPersist.push({
          _id: entry.symbol,
          fetchedAt: fetchedAtIso,
          quote: normalized.quote,
          rawQuote: normalized.rawQuote,
          rawSummary: normalized.rawSummary,
          rawSpark: normalized.rawSpark,
        });
        refreshedSymbols.push(entry.symbol);
        pushFinalQuote(normalized.quote);
      } else {
        const existing = existingMap.get(entry.symbol);
        if (existing) {
          skippedSymbols.push(entry.symbol);
          pushFinalQuote(existing.quote);
        }
      }
    });

    if (!finalQuotes.length) {
      throw new Error('Failed to load any quotes from Yahoo Finance');
    }

    applyMarketCapWeights(finalQuotes);

    await upsertLatestQuotes(toPersist);
    if (recordDaily && toPersist.length) {
      await recordDailySnapshots(toPersist).catch(() => undefined);
    }
    setCachedQuotes(finalQuotes);

    const newestFetchedAt = computeNewestFetchedAt(finalQuotes);
    await recordSyncRun({
      type: 'refresh',
      createdAt: new Date(startedAt).toISOString(),
      finishedAt: new Date().toISOString(),
      status: 'success',
      durationMs: Date.now() - startedAt,
      refreshedSymbols,
      skippedSymbols,
    }).catch(() => undefined);

    return {
      quotes: finalQuotes,
      refreshed: refreshedSymbols.length > 0,
      source: 'refresh',
      fetchedAt: newestFetchedAt,
      refreshedSymbols,
      skippedSymbols,
    };
  } catch (err) {
    await recordSyncRun({
      type: 'refresh',
      createdAt: new Date(startedAt).toISOString(),
      finishedAt: new Date().toISOString(),
      status: 'error',
      durationMs: Date.now() - startedAt,
      refreshedSymbols,
      skippedSymbols,
      error: err instanceof Error ? err.message : String(err),
    }).catch(() => undefined);
    throw err;
  }
}

export function invalidateQuotesCache(): void {
  clearQuotesCache();
}
