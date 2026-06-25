#!/usr/bin/env node
/**
 * apply-migration.cjs — apply one SQL migration directly against a Supabase
 * Postgres DB via `pg`. This is the canonical way to ship migrations in this
 * project. Do NOT use `supabase db push` / `supabase migration up`: the deploy
 * environments have no Supabase CLI and no SUPABASE_DB_PASSWORD, so the CLI path
 * always fails. We connect straight to the DB with the connection string in the
 * env file instead.
 *
 *   node scripts/apply-migration.cjs <file.sql> <envfile>
 *
 * Example:
 *   node scripts/apply-migration.cjs supabase/migrations/206_collections.sql .env.local
 *
 * Env files (each holds a DATABASE_URL=...):
 *   .env.local         → Vultr staging   (Supabase ref eyujzasggzjocsxakkoi)
 *   .env.kaufman-prod  → Kaufman prod    (Supabase ref uknsayoyvffkxamofczy)
 *
 * GOTCHAS (do not "fix" these — they are load-bearing):
 *   - The DB password contains a RAW `%`. Do NOT decodeURIComponent the URL —
 *     parse the components by hand (the regex below) and pass them verbatim.
 *   - .env.kaufman-prod has a trailing comment on the DATABASE_URL line — take
 *     only the first whitespace-delimited token (`split(/\s/)[0]`).
 *   - SSL is required (ssl.rejectUnauthorized = false for the Supabase cert).
 *   - Never print the DATABASE_URL / password to the console.
 *
 * DEPLOY RULES:
 *   1. Every migration self-registers its version at the end:
 *        INSERT INTO public.schema_version (version) VALUES (N) ON CONFLICT DO NOTHING;
 *      Otherwise the /api/health gate (schema.applied >= schema.expected) blocks
 *      the deploy.
 *   2. Apply to BOTH databases (staging + prod) BEFORE pushing code, so a
 *      zero-downtime rollout always has applied >= expected.
 *   3. Deploy the code afterward with SKIP_MIGRATIONS=1.
 *   4. A migration that uses CREATE INDEX CONCURRENTLY must live in its own file
 *      containing only that statement (it cannot run inside a transaction).
 *   5. Verify with: GET /api/health?deep=1  (Authorization: Bearer <CRON_SECRET>)
 *      → schema.applied === schema.expected.
 *
 * If pg is not installed in the environment:  npm install pg --no-save
 */

const fs = require('fs');

let Client;
try {
  ({ Client } = require('pg'));
} catch {
  console.error('pg is not installed. Run:  npm install pg --no-save');
  process.exit(1);
}

const [sqlPath, envFile] = process.argv.slice(2);
if (!sqlPath || !envFile) {
  console.error('usage: node scripts/apply-migration.cjs <file.sql> <envfile>');
  process.exit(1);
}

for (const p of [sqlPath, envFile]) {
  if (!fs.existsSync(p)) {
    console.error(`file not found: ${p}`);
    process.exit(1);
  }
}

const line = fs
  .readFileSync(envFile, 'utf8')
  .split(/\r?\n/)
  .find((l) => /^DATABASE_URL=/.test(l));
if (!line) {
  console.error(`no DATABASE_URL in ${envFile}`);
  process.exit(1);
}

// Strip the key, then drop any trailing comment (`split` on whitespace — a
// postgres URL never contains a raw space), then strip surrounding quotes. Order
// matters: splitting BEFORE unquoting handles a line that is both quoted AND
// commented. The password may contain a raw `%`, so we parse the components by
// hand below — do NOT url-decode.
const url = line
  .replace(/^DATABASE_URL=/, '')
  .trim()
  .split(/\s+/)[0]
  .replace(/^["']|["']$/g, '');

const m = url.match(/^postgres(?:ql)?:\/\/([^:]+):(.*)@([^@:/]+):(\d+)\/([^?]+)/);
if (!m) {
  console.error('could not parse DATABASE_URL (unexpected shape)');
  process.exit(1);
}
const [, user, password, host, port, database] = m;

(async () => {
  const client = new Client({
    host,
    port: Number(port),
    user,
    password,
    database,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const before = await client.query(
    'select coalesce(max(version), 0) v from public.schema_version',
  );
  // The migration file self-registers its schema_version row (deploy rule #1).
  await client.query(fs.readFileSync(sqlPath, 'utf8'));
  const after = await client.query('select max(version) v from public.schema_version');

  console.log(
    `applied ${sqlPath} → ${host} / ${database} | schema_version ${before.rows[0].v} -> ${after.rows[0].v}`,
  );
  await client.end();
})().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
