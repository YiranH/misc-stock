import { NextResponse } from 'next/server';
import { selectCompanyDetail } from '@/lib/queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: { symbol: string } };

export async function GET(_req: Request, { params }: Params) {
  const symbol = params.symbol.toUpperCase();
  const detail = await selectCompanyDetail(symbol);
  if (!detail) {
    return NextResponse.json({ error: `Unknown symbol ${symbol}` }, { status: 404 });
  }
  return NextResponse.json(detail);
}
