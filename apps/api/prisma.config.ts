import "dotenv/config";
import { defineConfig } from "prisma/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

// DATABASE_URL      — pooled connection (PgBouncer) for runtime queries
// DATABASE_DIRECT_URL — direct connection for migrations (bypasses pooler)
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_DIRECT_URL"] ?? process.env["DATABASE_URL"] ?? "",
    adapter: () => {
      const pool = new Pool({
        connectionString: process.env["DATABASE_DIRECT_URL"] ?? process.env["DATABASE_URL"],
      });
      return new PrismaPg(pool);
    },
  },
});
