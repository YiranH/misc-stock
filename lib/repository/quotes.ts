import { Collection, BulkWriteOperation } from 'mongodb';
import { Quote, QuoteDocument } from '@/types';
import { getCollection } from '@/lib/db/mongo';

export type QuoteLatestDoc = QuoteDocument;

export type QuoteDailyDoc = {
  symbol: string;
  asOf: string;
  quote: Quote;
  fetchedAt: string;
};

export type SyncRunDoc = {
  type: 'refresh';
  createdAt: string;
  finishedAt?: string;
  status: 'success' | 'skipped' | 'error';
  durationMs?: number;
  refreshedSymbols?: string[];
  skippedSymbols?: string[];
  error?: string;
};

async function getLatestCollection(): Promise<Collection<QuoteLatestDoc>> {
  return getCollection<QuoteLatestDoc>('quotes_latest');
}

async function getDailyCollection(): Promise<Collection<QuoteDailyDoc>> {
  return getCollection<QuoteDailyDoc>('quotes_daily');
}

async function getSyncRunsCollection(): Promise<Collection<SyncRunDoc>> {
  return getCollection<SyncRunDoc>('sync_runs');
}

export async function getLatestQuotes(): Promise<QuoteLatestDoc[]> {
  const col = await getLatestCollection();
  const docs = await col
    .find()
    .sort({ _id: 1 })
    .toArray();
  return docs;
}

export async function getLatestQuotesMetadata(): Promise<{ count: number; newestFetchedAt: string | null }>{
  const col = await getLatestCollection();
  const [count, newest] = await Promise.all([
    col.estimatedDocumentCount(),
    col.find().sort({ fetchedAt: -1 }).limit(1).next(),
  ]);
  return { count, newestFetchedAt: newest?.fetchedAt ?? null };
}

export async function upsertLatestQuotes(docs: QuoteLatestDoc[]): Promise<void> {
  if (!docs.length) return;
  const col = await getLatestCollection();
  const ops: BulkWriteOperation<QuoteLatestDoc>[] = docs.map((doc) => ({
    updateOne: {
      filter: { _id: doc._id },
      update: { $set: doc },
      upsert: true,
    },
  }));
  await col.bulkWrite(ops, { ordered: false });
}

export async function recordDailySnapshots(docs: QuoteLatestDoc[]): Promise<void> {
  if (!docs.length) return;
  const col = await getDailyCollection();
  const ops: BulkWriteOperation<QuoteDailyDoc>[] = docs.map((doc) => {
    const asOf = doc.quote.fetchedAt.split('T')[0];
    return {
      updateOne: {
        filter: { symbol: doc._id, asOf },
        update: {
          $setOnInsert: {
            symbol: doc._id,
            asOf,
            quote: doc.quote,
            fetchedAt: doc.fetchedAt,
          },
        },
        upsert: true,
      },
    };
  });
  await col.bulkWrite(ops, { ordered: false });
}

export async function recordSyncRun(doc: SyncRunDoc): Promise<void> {
  const col = await getSyncRunsCollection();
  await col.insertOne(doc);
}

export function mapQuoteDocsToQuotes(docs: QuoteLatestDoc[]): Quote[] {
  return docs.map((doc) => doc.quote);
}
