import { NextResponse } from 'next/server';
import { loadQuotes } from '@/lib/services/refreshQuotes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_AGE_MS = 15 * 60 * 1000;

export async function GET() {
  try {
    const result = await loadQuotes({ maxAgeMs: MAX_AGE_MS });
    if (!result.quotes.length) {
      return NextResponse.json({ error: 'Quotes unavailable' }, { status: 503 });
    }
    const response = NextResponse.json({
      quotes: result.quotes,
      fetchedAt: result.fetchedAt,
      source: result.source,
      refreshed: result.refreshed,
    });
    response.headers.set('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return response;
  } catch (err) {
    console.error('[api/ndx] GET failed', err);
    return NextResponse.json({ error: 'Failed to load quotes' }, { status: 500 });
  }
}
