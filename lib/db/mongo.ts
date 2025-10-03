import { MongoClient, Db, Collection } from 'mongodb';
import { getMongoDbName, getMongoUri } from '@/lib/env';

let clientPromise: Promise<MongoClient> | null = null;
let dbPromise: Promise<Db> | null = null;
let indexesEnsured = false;

async function createMongoClient(): Promise<MongoClient> {
  const uri = getMongoUri();
  const client = new MongoClient(uri, {
    maxPoolSize: 10,
  });
  await client.connect();
  return client;
}

export function getMongoClient(): Promise<MongoClient> {
  if (!clientPromise) {
    clientPromise = createMongoClient().catch((err) => {
      clientPromise = null;
      throw err;
    });
  }
  return clientPromise;
}

async function createDb(): Promise<Db> {
  const client = await getMongoClient();
  const dbName = getMongoDbName();
  const db = client.db(dbName);
  await ensureIndexes(db);
  return db;
}

export function getDb(): Promise<Db> {
  if (!dbPromise) {
    dbPromise = createDb().catch((err) => {
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}

async function ensureIndexes(db: Db): Promise<void> {
  if (indexesEnsured) return;
  indexesEnsured = true;
  const latest = db.collection('quotes_latest');
  const daily = db.collection('quotes_daily');
  const runs = db.collection('sync_runs');
  await Promise.all([
    latest.createIndex({ _id: 1 }),
    daily.createIndex({ symbol: 1, asOf: -1 }, { unique: true }),
    runs.createIndex({ createdAt: -1 }, { expireAfterSeconds: 60 * 60 * 24 * 14 }).catch(() => undefined),
  ]);
}

export async function getCollection<T>(name: string): Promise<Collection<T>> {
  const db = await getDb();
  return db.collection<T>(name);
}
