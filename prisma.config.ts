import { defineConfig } from "prisma/config";
import { config } from "dotenv";

// Varsayılan `.env` → `.env.dev` sembolik bağı (geliştirme, localhost:5433).
// Canlı için `*:prod` komutları ENV_FILE=.env.prod verir; böylece geliştirme
// dosyasındaki değişkenler canlı çalıştırmaya karışmaz.
config({ path: process.env.ENV_FILE ?? ".env" });

export default defineConfig({
  schema: "./prisma/schema.prisma",
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
  },
});
