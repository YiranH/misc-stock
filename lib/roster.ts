import fs from 'node:fs';
import path from 'node:path';

export type RosterEntry = {
  symbol: string;
  name?: string;
  sector?: string;
  industry?: string;
  weight?: number;
};

function parseSymbols(rawSymbols: string[]): string[] {
  const seen = new Set<string>();
  const parsed: string[] = [];
  rawSymbols.forEach((symbol) => {
    const cleaned = symbol.trim().toUpperCase();
    if (!cleaned) return;
    if (seen.has(cleaned)) return;
    seen.add(cleaned);
    parsed.push(cleaned);
  });
  return parsed;
}

function loadSymbolsFromEnv(): string[] | null {
  const envValue = process.env.SYMBOLS;
  if (!envValue) return null;
  const parts = envValue.split(/[\s,]+/).filter(Boolean);
  const parsed = parseSymbols(parts);
  return parsed.length ? parsed : null;
}

function loadSymbolsFromFile(): string[] {
  const filePath = path.join(process.cwd(), 'data', 'nasdaq100_symbols.json');
  try {
    const file = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(file);
    if (Array.isArray(parsed)) {
      const asStrings = parsed.filter((item) => typeof item === 'string') as string[];
      return parseSymbols(asStrings);
    }
  } catch (err) {
    throw new Error(`Failed to read roster symbols from ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
  }
  return [];
}

const rosterSymbols: string[] = (() => {
  const fromEnv = loadSymbolsFromEnv();
  if (fromEnv && fromEnv.length) return fromEnv;
  const fromFile = loadSymbolsFromFile();
  if (fromFile.length) return fromFile;
  throw new Error('No roster symbols configured. Provide SYMBOLS env var or data/nasdaq100_symbols.json');
})();

const roster: RosterEntry[] = rosterSymbols.map((symbol) => ({
  symbol,
  name: symbol,
}));

const rosterMap = new Map<string, RosterEntry>(roster.map((entry) => [entry.symbol, entry]));

export function getRoster(): RosterEntry[] {
  return roster;
}

export function getRosterMap(): Map<string, RosterEntry> {
  return rosterMap;
}

export function getRosterSymbols(): string[] {
  return rosterSymbols;
}
