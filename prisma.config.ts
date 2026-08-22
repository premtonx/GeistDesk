import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7 reads the connection URL here (not from schema.prisma).
// Use process.env so `prisma generate` does not require env() to be set.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url:
      process.env.DATABASE_URL
      || "postgresql://geist_user:geist_password@127.0.0.1:5432/geistdesk_prod?schema=public",
  },
});
