#!/usr/bin/env tsx
import { requireAlphaVantageKey } from '../lib/env';
import { loadRoster, RosterEntry } from '../lib/symbols';
import {
  ensureRoster,
  createSyncRun,
  updateSyncRun,
  updateSyncRunPending,
  getLatestSnapshot,
  insertSnapshot,
  updateCompanyOverview,
  getSymbolsNeedingOverview,
} from '../lib/repository';
import { fetchDailyAdjusted, fetchOverview, isRateLimitError, AlphaVantageError } from '../lib/alphavantage';

requireAlphaVantageKey();

type CliOptions = {
  symbols?: string[];
  skipOverview?: boolean;
  maxOverviewAgeDays: number;
  paceMs: number;
};

const DEFAULT_OPTIONS: CliOptions = {
  maxOverviewAgeDays: 7,
  skipOverview: false,
  paceMs: 12_500,
};

function parseCliArgs(): CliOptions {
  const args = process.argv.slice(2);
  const opts: CliOptions = { ...DEFAULT_OPTIONS };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg.startsWith('--symbols')) {
      const value = arg.includes('=') ? arg.split('=')[1] : args[i + 1];
      if (!value) throw new Error('Missing value for --symbols');
      if (!arg.includes('=')) i += 1;
      opts.symbols = value.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
    } else if (arg === '--skip-overview' || arg === '--no-overview') {
      opts.skipOverview = true;
    } else if (arg.startsWith('--overview-max-age')) {
      const value = arg.includes('=') ? arg.split('=')[1] : args[i + 1];
      if (!value) throw new Error('Missing value for --overview-max-age');
      if (!arg.includes('=')) i += 1;
      const num = Number(value);
      if (!Number.isFinite(num) || num <= 0) throw new Error('Invalid value for --overview-max-age');
      opts.maxOverviewAgeDays = num;
    } else if (arg.startsWith('--pace-ms')) {
      const value = arg.includes('=') ? arg.split('=')[1] : args[i + 1];
      if (!value) throw new Error('Missing value for --pace-ms');
      if (!arg.includes('=')) i += 1;
      const num = Number(value);
      if (!Number.isFinite(num) || num < 0) throw new Error('Invalid value for --pace-ms');
      opts.paceMs = num;
    }
  }
  return opts;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class RateLimiter {
  private lastRun = 0;
  constructor(private readonly paceMs: number) {}

  async schedule<T>(fn: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const elapsed = now - this.lastRun;
    if (elapsed < this.paceMs) {
      await sleep(this.paceMs - elapsed);
    }
    const result = await fn();
    this.lastRun = Date.now();
    return result;
  }
}

type SymbolResult = {
  symbol: string;
  inserted: number;
  latestDay: string | null;
  error?: unknown;
};

async function ingestSymbol(symbol: string, pace: RateLimiter): Promise<SymbolResult> {
  let attempts = 0;
  const maxAttempts = 3;
  while (attempts < maxAttempts) {
    try {
      const latestExisting = getLatestSnapshot(symbol);
      const existingLatestDay = latestExisting?.trading_day ?? null;
      const existingLatestClose = latestExisting?.adjusted_close ?? latestExisting?.close ?? null;

      const series = await pace.schedule(() => fetchDailyAdjusted(symbol));
      const newBars = existingLatestDay
        ? series.filter((bar) => bar.date > existingLatestDay)
        : series;

      let prevClose = existingLatestDay ? existingLatestClose : null;
      let inserted = 0;

      for (const bar of newBars) {
        const adjusted = Number.isFinite(bar.adjustedClose) ? bar.adjustedClose : null;
        const close = Number.isFinite(bar.close) ? bar.close : null;
        const pct = prevClose && adjusted
          ? ((adjusted - prevClose) / prevClose) * 100
          : null;
        insertSnapshot({
          symbol,
          trading_day: bar.date,
          open: Number.isFinite(bar.open) ? bar.open : null,
          high: Number.isFinite(bar.high) ? bar.high : null,
          low: Number.isFinite(bar.low) ? bar.low : null,
          close,
          adjusted_close: adjusted,
          volume: Number.isFinite(bar.volume) ? bar.volume : null,
          change_pct: pct,
          raw_json: JSON.stringify(bar.raw),
        });
        prevClose = adjusted ?? close ?? prevClose;
        inserted += 1;
      }

      if (!newBars.length && existingLatestDay && existingLatestClose == null && series.length) {
        // Backfill change_pct if previously stored without it.
        const [latest, prior] = [...series].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 2);
        if (latest && prior) {
          const adjusted = Number.isFinite(latest.adjustedClose) ? latest.adjustedClose : null;
          const priorAdj = Number.isFinite(prior.adjustedClose) ? prior.adjustedClose : null;
          const pct = adjusted && priorAdj ? ((adjusted - priorAdj) / priorAdj) * 100 : null;
          if (pct !== null) {
            insertSnapshot({
              symbol,
              trading_day: latest.date,
              open: Number.isFinite(latest.open) ? latest.open : null,
              high: Number.isFinite(latest.high) ? latest.high : null,
              low: Number.isFinite(latest.low) ? latest.low : null,
              close: Number.isFinite(latest.close) ? latest.close : null,
              adjusted_close: adjusted,
              volume: Number.isFinite(latest.volume) ? latest.volume : null,
              change_pct: pct,
              raw_json: JSON.stringify(latest.raw),
            });
          }
        }
      }

      const latestDay = newBars.length ? newBars[newBars.length - 1].date : existingLatestDay;
      return { symbol, inserted: newBars.length, latestDay: latestDay ?? null };
    } catch (err) {
      console.log("AlphaVantageError", err);
      attempts += 1;
      if (isRateLimitError(err)) {
        const delay = DEFAULT_OPTIONS.paceMs * 2 * attempts;
        console.warn(`[${symbol}] Rate limited; backing off for ${delay}ms`);
        await sleep(delay);
        continue;
      }
      if (err instanceof AlphaVantageError && attempts < maxAttempts) {
        const delay = 2000 * attempts;
        console.warn(`[${symbol}] Alpha Vantage error, retrying in ${delay}ms: ${err.message}`);
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }
  throw new Error(`Failed to ingest ${symbol} after ${maxAttempts} attempts`);
}

async function refreshOverview(symbol: string, pace: RateLimiter) {
  const data = await pace.schedule(() => fetchOverview(symbol));
  const marketCap = data.marketCapitalization ?? null;
  updateCompanyOverview(symbol, marketCap, JSON.stringify(data));
}

function selectSymbols(roster: RosterEntry[], requested?: string[]): string[] {
  if (!requested) return roster.map((r) => r.symbol);
  const rosterSet = new Set(roster.map((r) => r.symbol));
  const filtered = requested.filter((symbol) => rosterSet.has(symbol));
  const missing = requested.filter((symbol) => !rosterSet.has(symbol));
  if (missing.length) {
    console.warn(`Skipping ${missing.length} unknown symbols: ${missing.join(', ')}`);
  }
  return filtered;
}

async function main() {
  const options = parseCliArgs();
  const roster = loadRoster();
  ensureRoster(roster);
  const symbols = selectSymbols(roster, options.symbols);
  if (!symbols.length) {
    console.log('No symbols to process. Exiting.');
    return;
  }

  const run = createSyncRun('daily_prices');
  let pending = [...symbols];
  updateSyncRunPending(run.id, pending);

  const limiter = new RateLimiter(options.paceMs);
  const results: SymbolResult[] = [];
  const failures: SymbolResult[] = [];

  for (const symbol of symbols) {
    console.log(`[${symbol}] ingesting`);
    try {
      const result = await ingestSymbol(symbol, limiter);
      results.push(result);
      console.log(`[${symbol}] done (inserted ${result.inserted}, latest ${result.latestDay ?? 'n/a'})`);
    } catch (err) {
      console.error(`[${symbol}] failed: ${(err as Error).message}`);
      failures.push({ symbol, inserted: 0, latestDay: null, error: err });
    }
    pending = pending.filter((s) => s !== symbol);
    updateSyncRunPending(run.id, pending);
  }

  if (!options.skipOverview) {
    const dueOverview = getSymbolsNeedingOverview(options.maxOverviewAgeDays)
      .filter((symbol) => symbols.includes(symbol));
    for (const symbol of dueOverview) {
      try {
        console.log(`[${symbol}] refreshing overview`);
        await refreshOverview(symbol, limiter);
      } catch (err) {
        console.warn(`[${symbol}] failed to refresh overview: ${(err as Error).message}`);
      }
    }
  }

  const insertedTotal = results.reduce((sum, r) => sum + r.inserted, 0);
  const latestDays = results.map((r) => r.latestDay).filter(Boolean) as string[];
  const metadata = {
    processed: symbols.length,
    insertedSnapshots: insertedTotal,
    failures: failures.map((f) => f.symbol),
    latestTradingDay: latestDays.length ? latestDays.sort().at(-1) : null,
  };

  const status = failures.length ? 'partial' : 'success';
  const pendingSymbols = failures.map((f) => f.symbol);
  updateSyncRun(run.id, status, pendingSymbols, metadata);

  if (failures.length) {
    console.error(`Ingestion finished with ${failures.length} failures.`);
    process.exitCode = 1;
  } else {
    console.log('Ingestion completed successfully.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
