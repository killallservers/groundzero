import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { db } from ".";

migrate(db, {
  migrationsFolder: new URL("../../../drizzle", import.meta.url).pathname,
});
