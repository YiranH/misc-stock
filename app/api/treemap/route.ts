import { NextResponse } from 'next/server';
import { selectTreemapData } from '@/lib/queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const payload = await selectTreemapData();
  if (!payload.quotes.length) {
    return NextResponse.json({ error: 'No data available yet' }, { status: 503 });
  }
  return NextResponse.json(payload);
}
