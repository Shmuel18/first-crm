// Node.js-only side effects, loaded dynamically from instrumentation.ts so the
// Edge-runtime static analyzer never sees these `process` references.
const cap = 50;
process.setMaxListeners(cap);
process.stdout.setMaxListeners(cap);
process.stderr.setMaxListeners(cap);

// Empty export turns this side-effect-only file into a proper ES module
// (without it `tsc` flags it as "not a module" when imported).
export {};
