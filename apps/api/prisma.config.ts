import "dotenv/config";
import { defineConfig } from "prisma/config";

// DATABASE_URL must be set in .env without quotes (bare value, not "quoted")
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
