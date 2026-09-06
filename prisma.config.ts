import "dotenv/config";
import { defineConfig } from "@prisma/config";

declare const process: {
  env: {
    [key: string]: string | undefined;
  };
};

const databaseUrl =
  process.env.DATABASE_URL ||
  "postgresql://ceres_user:N1kMQd@aPukLR*q@db:5432/ceres?schema=public";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});