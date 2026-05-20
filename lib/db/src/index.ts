import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgres://user:pass@127.0.0.1:65432/connectsphere_dev";
  process.env.CONNECTSPHERE_LOCAL_DB_FALLBACK = "1";
}
process.env.PGCONNECT_TIMEOUT ??= "1";

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

export * from "./schema";
