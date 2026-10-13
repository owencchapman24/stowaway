/* global __dirname */
// Explicit host-only audit reproduction. Never part of the mobile suite or normal CI.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
require.extensions['.ts'] = (module, filename) => {
  if (!filename.startsWith(path.join(root, 'src') + path.sep)) throw new Error('Unexpected TypeScript module.');
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, filename);
};
const { strictXml } = require('../src/epub-spike/xml.ts');
const { context } = require('../src/epub-spike/limits.ts');
const { processEpub } = require('../src/epub-spike/package.ts');
const { epubEntries, makeZip, xhtml } = require('../src/epub-spike/fixtures.ts');
const { replaceEntry } = require('../src/epub-spike/corpus.ts');
async function measure(work) {
  let last = performance.now(), stall = 0;
  const timer = setInterval(() => { const now = performance.now(); stall = Math.max(stall, now - last - 10); last = now; }, 10);
  const start = performance.now(); let details, elapsed;
  try { details = await work(); elapsed = performance.now() - start; } finally { await new Promise((r) => setTimeout(r, 15)); clearInterval(timer); }
  return { totalMs: elapsed, longestStallMs: Math.max(0, stall), ...details };
}
async function main() {
  const sourceHash=createHash('sha256').update(fs.readFileSync(path.join(root,'src/epub-spike/xml.ts'))).digest('hex');
  if(process.argv.includes('--before') && sourceHash!=='d33d64601068f97aa2ff06501fc98cbd7adc5e562df70df049fe9f124dccc6fd') throw new Error('Original pre-remediation source required for the before label.');
  const rows = [];
  for (const units of [100000, 200000, 400000]) {
    const source = xhtml('<p>' + 'x\r'.repeat(units / 2) + '</p>');
    rows.push({ kind: 'strict-xml', inputUnits: source.length, ...await measure(async () => {
      const ctx = context(), xml = await strictXml(new TextEncoder().encode(source), ctx);
      return { parserMs: ctx.timings.xmlParse, xmlMs: ctx.timings.xml, correct: xml.text === 'Section title' + 'x\n'.repeat(units / 2) };
    }) });
  }
  const bytes = makeZip(replaceEntry(epubEntries(), 'Book/Text/main.xhtml', xhtml('<p>' + 'x\r'.repeat(200000) + '</p>')));
  rows.push({ kind: 'complete-epub', inputBytes: bytes.length, ...await measure(async () => {
    const ctx = context(); let count = 0, correct = false;
    const result = await processEpub({ size: bytes.length, async read(at,n) { return bytes.slice(at,at+n); }, close() {} }, ctx, { onChapter(c,s) { count++; if (s.ordinal === 1) correct = c.html.includes('x\n'.repeat(200000)); } });
    return { parserMs: ctx.timings.xmlParse, xmlMs: ctx.timings.xml, outputBytes: ctx.output, maxInput: ctx.maxInput, maxOutput: ctx.maxOutput, correct: correct && count === 3 && result.chapters.length === 3 };
  }) });
  const report = { runtime: process.version, xmlSourceSha256: sourceHash, rows };
  const dir = path.join(root,'dist','m1a-reports'); fs.mkdirSync(dir,{recursive:true});
  // Fixed choices prevent command-line paths from becoming destinations.
  const name = process.argv.includes('--before') ? 'xml-before.json' : 'xml-after.json';
  fs.writeFileSync(path.join(dir,name),JSON.stringify(report,null,2)); console.log(JSON.stringify(report));
  if (rows.some((row)=>!row.correct)) process.exitCode=1;
}
main().catch(()=>{console.error('XML audit benchmark failed.');process.exitCode=1;});
