import { NextResponse } from 'next/server';
import { selectHealthSummary } from '@/lib/queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const summary = await selectHealthSummary();
  return NextResponse.json(summary);
}
