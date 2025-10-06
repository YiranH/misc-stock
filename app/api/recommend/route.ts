import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateObject } from 'ai';
import type { LanguageModel } from 'ai';
import { NextRequest, NextResponse } from 'next/server';

import { RecommendBody, Recommendation } from '@/lib/recommendation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key');
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = RecommendBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid body', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return NextResponse.json({ error: 'Missing LLM credentials' }, { status: 500 });
  }

  try {
    const googleProvider = createGoogleGenerativeAI({
      apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    });
    const model = googleProvider('gemini-2.5-flash') as unknown as LanguageModel;

    const { object } = await generateObject({
      model,
      schema: Recommendation,
      system:
        'You are a portfolio recommender. Output a diversified portfolio whose weights sum to 100. Prefer liquid, low-fee ETFs unless the user insists on single stocks.',
      prompt: `Objective: ${parsed.data.objective}\nRisk: ${parsed.data.risk_tolerance}\nHorizon (years): ${parsed.data.horizon_years}\nConstraints: ${JSON.stringify(parsed.data.constraints || {})}`,
    });

    return NextResponse.json(object);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown error from LLM';
    return NextResponse.json(
      { error: 'Failed to generate recommendation', message },
      { status: 502 },
    );
  }
}
