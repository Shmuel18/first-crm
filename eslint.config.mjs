import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Claude Code worktrees keep their own .next/ and node_modules artifacts.
    // Linting through them blows the rule set up on build output.
    ".claude/**",
    // Standalone Node CommonJS tools (run via `node scripts/x.cjs`), not part of
    // the Next app graph — require() is correct there, so don't apply the app
    // rules (no-require-imports) to them.
    "scripts/**/*.cjs",
  ]),
]);

export default eslintConfig;
