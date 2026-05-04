
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL || "postgresql://admin_ujian:password_rahasia_123@localhost:5432/dcc_exam_db?schema=public",
  },
});
