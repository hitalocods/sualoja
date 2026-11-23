import { Pool } from "@neondatabase/serverless";
import { drizzle, NeonDatabase } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

export type Database = NeonDatabase<typeof schema>;
export type DbTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type DbExecutor = Database | DbTransaction;

type GlobalNeonCache = typeof globalThis & {
  __neonPool?: Pool;
  __neonDb?: Database;
};

const globalCache = globalThis as GlobalNeonCache;

export function getPool(): Pool {
  if (globalCache.__neonPool) {
    return globalCache.__neonPool;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL não configurada. Defina a variável de ambiente antes de consultar o banco Neon.",
    );
  }

  const pool = new Pool({ connectionString });
  if (process.env.NODE_ENV !== "production") {
    globalCache.__neonPool = pool;
  }
  return pool;
}

export function getDb(): Database {
  if (globalCache.__neonDb) {
    return globalCache.__neonDb;
  }

  const database = drizzle(getPool(), { schema });
  if (process.env.NODE_ENV !== "production") {
    globalCache.__neonDb = database;
  }
  return database;
}

export async function closeDb(): Promise<void> {
  if (globalCache.__neonPool) {
    await globalCache.__neonPool.end();
    globalCache.__neonPool = undefined;
    globalCache.__neonDb = undefined;
  }
}

export const db: Database = new Proxy({} as Database, {
  get(_target, prop, receiver) {
    const instance = getDb();
    const value = Reflect.get(instance, prop, receiver);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
