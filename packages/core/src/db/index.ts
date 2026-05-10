import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";

const sqlite = new Database(
  Bun.env.DATABASE_PATH ??
    new URL("../../groundzero.db", import.meta.url).pathname,
);
sqlite.exec("PRAGMA journal_mode = WAL");

export const db = drizzle(sqlite, { schema });
