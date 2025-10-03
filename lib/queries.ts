import { Quote } from '@/types';
import { loadQuotes } from '@/lib/services/refreshQuotes';
import { getLatestQuotesMetadata } from '@/lib/repository/quotes';

const API_MAX_AGE_MS = 15 * 60 * 1000; // 15 minutes

export type TreemapPayload = {
  quotes: Quote[];
  fetchedAt: string | null;
  source: 'memory' | 'database' | 'refresh';
  refreshed: boolean;
};

export async function selectTreemapData(force = false): Promise<TreemapPayload> {
  const result = await loadQuotes({ maxAgeMs: API_MAX_AGE_MS, force });
  return {
    quotes: result.quotes,
    fetchedAt: result.fetchedAt,
    source: result.source,
    refreshed: result.refreshed,
  };
}

export async function selectHealthSummary() {
  const { count, newestFetchedAt } = await getLatestQuotesMetadata();
  const ageMs = newestFetchedAt ? Date.now() - Date.parse(newestFetchedAt) : null;
  return {
    count,
    newestFetchedAt,
    ageMs,
    maxAgeMs: API_MAX_AGE_MS,
  };
}
