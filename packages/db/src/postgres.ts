import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

export async function migrate(url = process.env.DATABASE_URL): Promise<void> {
  if (!url) return;
  const pool = new pg.Pool({ connectionString: url });
  const sql = readFileSync(resolve(root, "migrations/001_init.sql"), "utf8");
  await pool.query(sql);
  await pool.end();
}

export { pg };
