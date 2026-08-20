#!/usr/bin/env node
/**
 * Local pre-merge gate — run this instead of GitHub Actions.
 *
 * The `verify` job in .github/workflows/ci.yml is a required status check on
 * `main`, but the Actions budget is exhausted, so it can no longer run. Rather
 * than merge unchecked, run the same steps here before pushing to `main`.
 *
 *   npm run verify
 *
 * Mirrors CI's `verify` job (typecheck / lint / test) and its informational
 * `audit` job, and adds one step CI never had:
 *
 *   npm run build — a production build. `tsc --noEmit` does NOT catch
 *   everything: a client file importing a *value* from a module that pulls in
 *   server-only code typechecks fine and then fails the Turbopack build. That
 *   class of break has reached this repo before, and CI never guarded it.
 *
 * Exits non-zero if any blocking step fails, so it can be chained:
 *   npm run verify && git push origin HEAD:main
 */
const { spawnSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const { join } = require('node:path');

const ROOT = join(__dirname, '..');

/** @type {{name: string, cmd: string, blocking: boolean, note?: string}[]} */
const STEPS = [
  { name: 'Typecheck', cmd: 'npx tsc --noEmit', blocking: true },
  { name: 'Lint', cmd: 'npm run lint', blocking: true },
  { name: 'Test', cmd: 'npm test', blocking: true },
  {
    name: 'Build',
    cmd: 'npm run build',
    blocking: true,
    note: 'not in CI — catches Turbopack-only failures tsc cannot see',
  },
  {
    name: 'Audit (high)',
    cmd: 'npm audit --audit-level=high',
    blocking: false,
    note: 'informational, mirrors CI continue-on-error',
  },
];

function line(char = '─') {
  return char.repeat(64);
}

function run(step) {
  process.stdout.write(`\n${line()}\n▶ ${step.name}${step.note ? `  (${step.note})` : ''}\n${line()}\n`);
  const started = Date.now();
  const res = spawnSync(step.cmd, { cwd: ROOT, stdio: 'inherit', shell: true });
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  const ok = res.status === 0;
  return { ...step, ok, secs };
}

function main() {
  // A production build reads env through @t3-oss/env-nextjs and dies on a
  // missing var. .env.local is gitignored, so a fresh worktree does not have
  // one — say so up front rather than letting Build fail for a non-code reason.
  if (!existsSync(join(ROOT, '.env.local'))) {
    process.stdout.write(
      '\n! .env.local is missing here (it is gitignored, so worktrees do not get one).\n' +
        '  The Build step will fail on env validation, NOT on your code.\n' +
        '  Copy it from the main checkout first, then re-run.\n',
    );
  }

  const results = STEPS.map(run);

  process.stdout.write(`\n${line('═')}\n  SUMMARY\n${line('═')}\n`);
  for (const r of results) {
    const mark = r.ok ? 'PASS' : r.blocking ? 'FAIL' : 'warn';
    process.stdout.write(`  ${mark.padEnd(5)} ${r.name.padEnd(14)} ${r.secs}s\n`);
  }

  const failed = results.filter((r) => !r.ok && r.blocking);
  if (failed.length > 0) {
    process.stdout.write(`\n  BLOCKED — do not push: ${failed.map((f) => f.name).join(', ')}\n\n`);
    process.exit(1);
  }
  const warned = results.filter((r) => !r.ok && !r.blocking);
  if (warned.length > 0) {
    process.stdout.write(`\n  (non-blocking warnings: ${warned.map((w) => w.name).join(', ')})\n`);
  }
  process.stdout.write('\n  All blocking checks passed — safe to push to main.\n\n');
}

main();
