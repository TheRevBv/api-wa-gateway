import { Pool } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";

import { schema } from "./schema";

export type DatabaseClient = NodePgDatabase<typeof schema>;

export interface DatabaseConnection {
  pool: Pool;
  db: DatabaseClient;
}

export const createDatabaseConnection = (databaseUrl: string): DatabaseConnection => {
  const pool = new Pool({
    connectionString: databaseUrl
  });

  return {
    pool,
    db: drizzle(pool, { schema })
  };
};
