#!/usr/bin/env node
/**
 * Deterministic RTL / bidi audit of a rendered PDF.
 *
 *   node scripts/audit-pdf-rtl.js <file.pdf> [probes.json]
 *
 * WHY THIS EXISTS: you cannot audit Hebrew glyph order by looking at a rendered
 * page — transcribing right-to-left text from an image is unreliable, and a
 * wrong reading sends you fixing things that were never broken. This measures
 * instead.
 *
 * HOW IT WORKS: react-pdf reorders glyphs itself before drawing, so poppler's
 * word coordinates ARE the visual order (each RTL word comes out letter-
 * reversed, words positioned left-to-right by x). For every logical string we
 * know is on the page, bidi-js computes the visual order it SHOULD have under
 * an RTL base direction and under an LTR one. Whichever the PDF matches tells
 * us the base direction that Text actually rendered with.
 *
 * The expected base direction comes from content, not assumption: a string with
 * Hebrew in it wants RTL; a pure date/number/Latin string wants LTR (forcing
 * RTL on "17.08.2026, 10:21" would move the comma and read worse). Strings
 * whose two forms are identical are reported `direction-agnostic` — no bug is
 * possible there, which is most of this document.
 *
 * REQUIRES: Docker (pulls minidocks/poppler for pdftotext) and bidi-js, which
 * ships as part of the @react-pdf dependency tree.
 *
 * To get a PDF to audit: generate one from the app (Client card → bank summary)
 * and save it, or render a fixture with renderToBuffer in a scratch test.
 */
const { execFileSync } = require('node:child_process');
const { readFileSync, existsSync } = require('node:fs');
const path = require('node:path');

let bidiFactory;
try {
  bidiFactory = require('bidi-js');
} catch {
  console.error('bidi-js not resolvable — run npm install first.');
  process.exit(1);
}
const bidi = bidiFactory();
const HAS_RTL = /[֐-׿؀-ۿ]/;

function visualForm(text, baseDirection) {
  const levels = bidi.getEmbeddingLevels(text, baseDirection);
  return bidi.getReorderedString(text, levels, 0, text.length);
}

/** Words grouped into visual lines, each in ascending-x (visual) order. */
function extractLines(pdfPath) {
  const abs = path.resolve(pdfPath);
  const dir = path.dirname(abs);
  const file = path.basename(abs);
  const tsvName = `${file}.rtl-audit.tsv`;
  execFileSync(
    'docker',
    ['run', '--rm', '-v', `${dir}:/w`, '-w', '/w', 'minidocks/poppler',
     'pdftotext', '-tsv', '-enc', 'UTF-8', file, tsvName],
    { encoding: 'utf8', env: { ...process.env, MSYS_NO_PATHCONV: '1' } },
  );
  const tsv = readFileSync(path.join(dir, tsvName), 'utf8');

  // Group by page + baseline y: poppler's line_num is 0 for every row in this
  // output, so only `top` can identify a line.
  const lines = new Map();
  for (const row of tsv.split(/\r?\n/)) {
    const c = row.split('\t');
    if (c[0] !== '5') continue; // level 5 = word
    if (!c[11]) continue;
    const key = `${c[1]}:${Math.round(Number(c[7]))}`;
    if (!lines.has(key)) lines.set(key, { page: Number(c[1]), top: Math.round(Number(c[7])), words: [] });
    lines.get(key).words.push({ left: Number(c[6]), text: c[11] });
  }
  return [...lines.values()].map((l) => ({
    page: l.page,
    top: l.top,
    words: l.words.sort((a, b) => a.left - b.left).map((w) => w.text),
  }));
}

const norm = (s) => s.replace(/\s+/g, ' ').trim();
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Whitespace-insensitive between glyphs (poppler splits a label off from its
 * trailing colon, and breaks some Latin words at glyphs it can't map), but the
 * match must start and end on a token boundary — otherwise ":קית רפסמ" matches
 * by borrowing the colon off the PREVIOUS label and a real defect passes.
 */
const needleRe = (visual) => {
  const chars = [...norm(visual).replace(/\s/g, '')].map(escapeRe);
  return new RegExp(`(?<=^|\\s)${chars.join('\\s*')}(?=\\s|$)`);
};

function audit(pdfPath, probes) {
  const lines = extractLines(pdfPath);
  const streams = lines.map((l) => ({ page: l.page, stream: norm(l.words.join(' ')) }));
  const results = [];

  for (const { name, logical } of probes) {
    const wantBase = HAS_RTL.test(logical) ? 'rtl' : 'ltr';
    const vRtl = norm(visualForm(logical, 'rtl'));
    const vLtr = norm(visualForm(logical, 'ltr'));
    const hitRtl = streams.find((l) => needleRe(vRtl).test(l.stream));
    const hitLtr = streams.find((l) => needleRe(vLtr).test(l.stream));

    let verdict;
    let page;
    if (!hitRtl && !hitLtr) verdict = 'NOT FOUND';
    else if (vRtl === vLtr) { verdict = 'direction-agnostic'; page = (hitRtl ?? hitLtr).page; }
    else if (hitRtl && wantBase === 'rtl') { verdict = 'OK (rtl)'; page = hitRtl.page; }
    else if (hitLtr && wantBase === 'ltr') { verdict = 'OK (ltr)'; page = hitLtr.page; }
    else if (hitLtr && wantBase === 'rtl') { verdict = 'DEFECT — rendered LTR-base'; page = hitLtr.page; }
    else { verdict = 'DEFECT — rendered RTL-base'; page = hitRtl.page; }

    results.push({ name, verdict, page, wantBase, vRtl, vLtr });
  }
  return { results, lineCount: lines.length };
}

module.exports = { audit, extractLines, visualForm };

if (require.main === module) {
  const pdf = process.argv[2];
  const probesArg = process.argv[3] ?? path.join(__dirname, 'audit-pdf-rtl.probes.json');
  if (!pdf || !existsSync(pdf)) {
    console.error('usage: node scripts/audit-pdf-rtl.js <file.pdf> [probes.json]');
    process.exit(1);
  }
  const probes = JSON.parse(readFileSync(probesArg, 'utf8'));
  const { results, lineCount } = audit(pdf, probes);
  console.log(`${lineCount} visual lines in ${path.basename(pdf)}\n`);
  for (const r of results) {
    const tag = r.verdict.startsWith('DEFECT') ? 'x' : r.verdict === 'NOT FOUND' ? '?' : 'v';
    console.log(`${tag} [${r.verdict}] ${r.name}${r.page ? ` p${r.page}` : ''}`);
    if (r.verdict.startsWith('DEFECT')) {
      console.log(`      want ${r.wantBase}: "${r.wantBase === 'rtl' ? r.vRtl : r.vLtr}"`);
      console.log(`      got:       "${r.wantBase === 'rtl' ? r.vLtr : r.vRtl}"`);
    }
  }
  const defects = results.filter((r) => r.verdict.startsWith('DEFECT')).length;
  const missing = results.filter((r) => r.verdict === 'NOT FOUND').length;
  console.log(`\n${defects} defect(s), ${missing} not found, ${results.length} probes`);
  process.exitCode = defects > 0 ? 1 : 0;
}
