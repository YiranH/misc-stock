#!/usr/bin/env tsx
import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());

const USAGE = `Usage: pnpm tsx scripts/refreshNdx.ts [--force] [--since <minutes>]

Options:
  --force          Force a refresh regardless of recency
  --since <min>    Skip refresh when data newer than <min> minutes
`;

type CliOptions = {
  force: boolean;
  sinceMinutes: number | null;
};

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = { force: false, sinceMinutes: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--force') {
      opts.force = true;
    } else if (arg === '--since') {
      const value = argv[i + 1];
      if (!value) {
        console.error('Missing value for --since');
        console.log(USAGE);
        process.exit(1);
      }
      i += 1;
      const minutes = Number(value);
      if (!Number.isFinite(minutes) || minutes < 0) {
        console.error('Invalid value for --since');
        process.exit(1);
      }
      opts.sinceMinutes = minutes;
    } else if (arg === '--help' || arg === '-h') {
      console.log(USAGE);
      process.exit(0);
    } else {
      console.error(`Unknown option: ${arg}`);
      console.log(USAGE);
      process.exit(1);
    }
  }
  return opts;
}

async function main() {
  const { loadQuotes, refreshQuotes } = await import('@/lib/services/refreshQuotes');
  const opts = parseArgs(process.argv.slice(2));
  try {
    if (!opts.force && opts.sinceMinutes != null) {
      const maxAgeMs = opts.sinceMinutes * 60_000;
      const existing = await loadQuotes({ maxAgeMs, force: false });
      if (existing.quotes.length && existing.fetchedAt) {
        const ageMs = Date.now() - Date.parse(existing.fetchedAt);
        if (Number.isFinite(ageMs) && ageMs <= maxAgeMs) {
          console.log(`Quotes are fresh (${Math.round(ageMs / 1000)}s old). Skipping refresh.`);
          process.exit(0);
        }
      }
    }

    const result = await refreshQuotes({ force: true });
    console.log(`Refreshed ${result.refreshedSymbols.length} symbols (${result.skippedSymbols.length} skipped).`);
    if (result.fetchedAt) {
      console.log(`Fetched at ${result.fetchedAt}`);
    }
    process.exit(result.refreshed ? 0 : 0);
  } catch (err) {
    console.error('Refresh failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
