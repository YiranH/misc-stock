import { NextResponse } from 'next/server';
import { refreshQuotes } from '@/lib/services/refreshQuotes';
import { getRefreshToken } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const expectedToken = getRefreshToken();
  if (!expectedToken) {
    return NextResponse.json({ error: 'Refresh token not configured' }, { status: 503 });
  }
  const provided = request.headers.get('x-refresh-token') ?? '';
  if (!provided || provided !== expectedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: any = null;
  try {
    body = await request.json();
  } catch (err) {
    body = null;
  }

  try {
    const result = await refreshQuotes({
      force: true,
      maxAgeMs: typeof body?.maxAgeMs === 'number' ? body.maxAgeMs : undefined,
    });

    return NextResponse.json({
      refreshed: result.refreshed,
      fetchedAt: result.fetchedAt,
      refreshedSymbols: result.refreshedSymbols,
      skippedSymbols: result.skippedSymbols,
      count: result.quotes.length,
    });
  } catch (err) {
    console.error('[api/ndx/refresh] POST failed', err);
    return NextResponse.json({ error: 'Refresh failed' }, { status: 500 });
  }
}
