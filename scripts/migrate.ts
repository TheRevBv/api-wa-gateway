import "dotenv/config";

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { Pool } from "pg";

import { loadEnvironment } from "../src/config/env";

const run = async (): Promise<void> => {
  const env = loadEnvironment();
  const pool = new Pool({
    connectionString: env.DATABASE_URL
  });

  try {
    const migrationsDir = path.resolve(process.cwd(), "drizzle");
    const files = (await readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();

    for (const file of files) {
      const sql = await readFile(path.join(migrationsDir, file), "utf8");

      if (!sql.trim()) {
        continue;
      }

      await pool.query(sql);
      console.log(`Applied migration ${file}`);
    }
  } finally {
    await pool.end();
  }
};

void run();
