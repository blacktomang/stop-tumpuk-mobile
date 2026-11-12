import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: {
    tsconfigRaw: {
      compilerOptions: {
        target: "ES2022",
        strict: true,
      },
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["reference/web/**", "node_modules/**"],
  },
});
