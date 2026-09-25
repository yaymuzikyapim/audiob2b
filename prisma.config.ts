import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "./prisma/schema.prisma",
  migrate: {
    adapter: async () => {
      const { PrismaPg } = await import("@prisma/adapter-pg");
      const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL!;
      return new PrismaPg({ connectionString: url });
    },
  },
});
