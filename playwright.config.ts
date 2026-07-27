import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  fullyParallel: false, // one spec, hits a real LLM — no reason to parallelize and every reason not to
  retries: 1, // real-LLM test: one retry for legitimate model non-determinism, same policy as the evals harness
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  webServer: {
    // Real build + real server, not `next dev` — matches tech-design.md §15's "runs against next start".
    command: "yarn build && yarn start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
