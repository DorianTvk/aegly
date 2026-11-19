/**
 * Andmebaasi migratsioonid (Verceli build). Erinevalt `drizzle-kit migrate`-ist
 * prindib see vea korral täpse põhjuse logisse.
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("[migrate] DATABASE_URL puudub");
  process.exit(1);
}
const pool = new Pool({ connectionString: url, max: 1 });
try {
  await migrate(drizzle(pool), { migrationsFolder: "drizzle" });
  console.log("[migrate] OK");
} catch (e) {
  const err = e as Error & { cause?: { message?: string; detail?: string; code?: string } };
  console.error("[migrate] VIGA:", err.message);
  if (err.cause) console.error("[migrate] põhjus:", err.cause.code, err.cause.message, err.cause.detail ?? "");
  process.exitCode = 1;
} finally {
  await pool.end();
}
