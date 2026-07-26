import path from "node:path";
import { config } from "dotenv";
import { defineConfig } from "vitest/config";

// Unlike `next dev` (auto-loads .env.local) and the tsx --env-file CLI scripts, vitest doesn't load
// any .env file on its own — without this, DATABASE_URL is undefined and postgres.js silently falls
// back to OS-user connection defaults instead of erroring clearly. Confirmed by hitting exactly that.
config({ path: ".env.local" });

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    projects: [
      {
        resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/**/*.test.ts"],
        },
      },
      {
        resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
        test: {
          name: "evals",
          environment: "node",
          include: ["evals/**/*.eval.ts"],
          testTimeout: 60_000,
          hookTimeout: 30_000,
          fileParallelism: false, // scenarios reset the DB between runs — must run serially, never concurrently
        },
      },
    ],
  },
});
