import rosterJson from '@/data/nasdaq100.json';

export type RosterEntry = {
  symbol: string;
  name: string;
  sector: string;
  industry: string;
  weight?: number;
};

const roster: RosterEntry[] = (rosterJson as RosterEntry[]).map((entry) => ({
  ...entry,
  weight: typeof entry.weight === 'number' ? entry.weight : Number(entry.weight ?? 0),
}));

const rosterMap = new Map<string, RosterEntry>(roster.map((entry) => [entry.symbol, entry]));

export function getRoster(): RosterEntry[] {
  return roster;
}

export function getRosterMap(): Map<string, RosterEntry> {
  return rosterMap;
}

export function getRosterSymbols(): string[] {
  return roster.map((entry) => entry.symbol);
}
