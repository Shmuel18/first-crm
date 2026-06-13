import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';

const REVIEWABLE_EXTENSIONS = new Set([
  '',
  '.css',
  '.html',
  '.js',
  '.json',
  '.md',
  '.mjs',
  '.sh',
  '.sql',
  '.toml',
  '.ts',
  '.tsx',
  '.txt',
  '.yaml',
  '.yml',
]);

const FEATURE_ROUNDS = new Map([
  ['auth', 1],
  ['pwa', 2],
  ['settings', 3],
  ['team', 3],
  ['audit', 3],
  ['import', 3],
  ['leads', 4],
  ['intake', 4],
  ['borrowers', 8],
  ['incomes', 8],
  ['case-banks', 9],
  ['obligations', 9],
  ['case-expenses', 9],
  ['documents', 10],
  ['integrations', 11],
  ['backup', 11],
  ['templates', 12],
  ['notifications', 12],
  ['sla', 12],
  ['tasks', 13],
  ['case-comments', 14],
  ['case-activity', 14],
  ['statistics', 14],
]);

function normalize(path) {
  return path.replaceAll('\\', '/');
}

function classifyCaseFeature(path) {
  if (path.startsWith('src/features/cases/components/')) return 6;
  if (path.startsWith('src/features/cases/pdf/')) return 7;
  if (path.startsWith('src/features/cases/services/export/')) return 7;
  return 5;
}

function classifySimulatorFeature(path) {
  if (
    path.startsWith('src/features/simulators/components/') ||
    path.startsWith('src/features/simulators/hooks/') ||
    path.startsWith('src/features/simulators/pdf/')
  ) {
    return 16;
  }
  return 15;
}

function classifyApp(path) {
  if (path === 'src/app/globals.css') return 2;
  if (path.startsWith('src/app/(auth)/') || path.startsWith('src/app/auth/')) return 1;
  if (path.startsWith('src/app/(public)/check/')) return 4;

  if (path.startsWith('src/app/(app)/settings/backup/')) return 11;
  if (path.startsWith('src/app/(app)/settings/integrations/')) return 11;
  if (path.startsWith('src/app/(app)/settings/templates/')) return 12;
  if (path.startsWith('src/app/(app)/settings/notifications/')) return 12;
  if (path.startsWith('src/app/(app)/settings/simulators/')) return 16;
  if (path.startsWith('src/app/(app)/settings/')) return 3;

  if (path.startsWith('src/app/(app)/audit-log/')) return 3;
  if (path.startsWith('src/app/(app)/team/')) return 3;
  if (path.startsWith('src/app/(app)/dashboard/')) return 5;
  if (path.startsWith('src/app/(app)/tasks/')) return 13;
  if (path.startsWith('src/app/(app)/statistics/')) return 14;
  if (path.startsWith('src/app/(app)/simulators/')) return 16;
  if (path.startsWith('src/app/(app)/templates/')) return 12;

  if (path.startsWith('src/app/(app)/cases/[id]/documents/')) return 10;
  if (path.startsWith('src/app/(app)/cases/[id]/history/')) return 14;
  if (path.startsWith('src/app/(app)/cases/[id]/simulators/')) return 16;
  if (path.startsWith('src/app/(app)/cases/[id]/borrowers/')) return 8;
  if (path.startsWith('src/app/(app)/cases/[id]/banks/')) return 9;
  if (path.startsWith('src/app/(app)/cases/[id]/')) return 6;
  if (path.startsWith('src/app/(app)/cases/')) return 5;

  if (path.startsWith('src/app/api/auth/google/')) return 11;
  if (path.startsWith('src/app/api/cron/backup')) return 11;
  if (path.startsWith('src/app/api/cron/cleanup-orphaned-blobs/')) return 10;
  if (path.startsWith('src/app/api/cron/erasure-watchdog/')) return 10;
  if (path.startsWith('src/app/api/cron/status-sla-check/')) return 12;
  if (path.startsWith('src/app/api/cron/task-reminders/')) return 13;
  if (path.startsWith('src/app/api/push/')) return 12;
  if (path.startsWith('src/app/api/exports/cases/')) return 7;
  if (path.startsWith('src/app/api/health/')) return 20;
  if (path.startsWith('src/app/api/web-lead/')) return 4;
  if (path.startsWith('src/app/api/')) return null;

  if (path.startsWith('src/app/(app)/')) return 2;
  if (path.startsWith('src/app/')) return 1;
  return null;
}

function classify(path) {
  if (path.startsWith('src/features/cases/')) return classifyCaseFeature(path);
  if (path.startsWith('src/features/simulators/')) return classifySimulatorFeature(path);

  const featureMatch = path.match(/^src\/features\/([^/]+)\//);
  if (featureMatch) return FEATURE_ROUNDS.get(featureMatch[1]) ?? null;

  if (path.startsWith('src/app/')) return classifyApp(path);
  if (path === 'src/types/database.ts') return 19;
  if (
    path.startsWith('src/lib/') ||
    path.startsWith('src/types/') ||
    path.startsWith('src/instrumentation') ||
    path === 'src/proxy.ts'
  ) {
    return 1;
  }
  if (path.startsWith('src/components/') || path.startsWith('src/i18n/')) return 2;
  if (path.startsWith('src/')) return null;

  const migrationMatch = path.match(/^supabase\/migrations\/(\d+)_/);
  if (migrationMatch) {
    const migration = Number(migrationMatch[1]);
    if (migration <= 55) return 17;
    if (migration <= 110) return 18;
    return 19;
  }
  if (path.startsWith('supabase/')) return 19;

  if (path.startsWith('messages/')) return 2;
  if (path.startsWith('landing/')) return 4;
  if (path.startsWith('public/')) return 2;
  if (path.startsWith('docs/legal/')) return 4;
  if (path.startsWith('docs/mockups/')) return 2;

  if (
    path.startsWith('docs/') ||
    path.startsWith('scripts/') ||
    path.startsWith('.github/') ||
    path.startsWith('.claude/') ||
    !path.includes('/')
  ) {
    return 20;
  }

  if (path.startsWith('dev-fixtures/')) return 10;
  return null;
}

function countLines(path) {
  if (!REVIEWABLE_EXTENSIONS.has(extname(path))) return 0;
  try {
    return readFileSync(path, 'utf8').split(/\r?\n/).length;
  } catch {
    return 0;
  }
}

const output = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard'],
  { encoding: 'utf8' },
);

const files = output
  .split(/\r?\n/)
  .map(normalize)
  .filter(Boolean)
  .filter((path) => !path.startsWith('.next/') && !path.startsWith('node_modules/'));

const rounds = Array.from({ length: 20 }, (_, index) => ({
  round: index + 1,
  files: 0,
  lines: 0,
}));
const unknown = [];

for (const path of files) {
  const round = classify(path);
  if (round === null) {
    unknown.push(path);
    continue;
  }

  const bucket = rounds[round - 1];
  bucket.files += 1;
  bucket.lines += countLines(path);
}

console.table(rounds);

if (unknown.length > 0) {
  console.error('\nUnassigned files:');
  for (const path of unknown) console.error(`- ${path}`);
  process.exitCode = 1;
} else {
  console.log(`\nCoverage assignment complete: ${files.length} files, zero unassigned.`);
}
