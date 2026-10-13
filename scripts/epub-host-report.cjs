/* global __dirname */
// Host-only performance driver: the same corpus/runner as iPhone, without Jest's VM.
// TypeScript is already a dev dependency. This loader never enters the mobile bundle.
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { Buffer } = require('node:buffer');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
require('./epub-patch-parser.cjs').apply(true);
require.extensions['.ts'] = (module, filename) => {
  if (!filename.startsWith(path.join(root, 'src') + path.sep)) throw new Error('Unexpected TypeScript module.');
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } });
  module._compile(compiled.outputText, filename);
};
const { CORPUS } = require('../src/epub-spike/corpus.ts');
const { runDiagnostic } = require('../src/epub-spike/diagnostic.ts');
const { serializeReport } = require('../src/epub-spike/report.ts');
async function main() {
  const destination = path.join(root, 'dist', 'm1a-reports'); fs.mkdirSync(destination, { recursive: true });
  if (process.argv.includes('--fixtures')) {
    const fixtures = path.join(root, 'dist', 'm1a-fixtures'); fs.mkdirSync(fixtures, { recursive: true });
    for (const test of CORPUS) fs.writeFileSync(path.join(fixtures, test.id + '.epub'), test.bytes());
    fs.writeFileSync(path.join(fixtures, 'manifest.json'), JSON.stringify(CORPUS.map(({id,expected,tier})=>({id,expected,tier})), null, 2));
    console.log(`Generated ${CORPUS.length} original synthetic fixtures in dist/m1a-fixtures.`); return;
  }
  // A failed current run must not leave a prior successful report at this path.
  const reportPath = path.join(destination, 'host-direct.json'); fs.rmSync(reportPath, {force:true});
  const scratch = fs.mkdtempSync(path.join(destination, 'scratch-'));
  // Any accidental future acquisition makes the run fail, even on a connected host.
  globalThis.fetch = async () => { throw new Error('Network forbidden in EPUB diagnostic.'); };
  try {
    const report = await runDiagnostic({ async create(bytes) {
      const name = path.join(scratch, randomUUID() + '.epub'); fs.writeFileSync(name, bytes, {flag:'wx'});
      const fd = fs.openSync(name,'r'), stats = {created:1,removed:0,handlesOpened:1,handlesClosed:0,failures:0}; let closed=false;
      return {stats,file:{size:bytes.length,async read(at,n){const b=Buffer.alloc(n),read=fs.readSync(fd,b,0,n,at);return b.subarray(0,read);},close(){if(!closed){fs.closeSync(fd);closed=true;stats.handlesClosed++;}}},cleanup(){fs.unlinkSync(name);stats.removed++;}};
    }}, {appVersion:'0.1.0',audience:'internal-personal',diagnosticFlag:'enabled',runtime:`Node ${process.version}`,platform:process.platform,hermes:false,tier:'extended'});
    if (report.metadata.tier !== 'extended' || report.tests.length !== CORPUS.length ||
      report.tests.some((test,i)=>test.id!==CORPUS[i].id || test.expected!==CORPUS[i].expected)) throw new Error('Incomplete host corpus.');
    fs.writeFileSync(reportPath, serializeReport(report));
    console.log(JSON.stringify(report.summary)); console.log('Report: dist/m1a-reports/host-direct.json');
    if (report.summary.verdict !== 'pass') process.exitCode = 1;
  } finally {
    // Only this generated directory's immediate files. Never recurse over app/storage paths.
    for (const name of fs.readdirSync(scratch)) fs.unlinkSync(path.join(scratch,name)); fs.rmdirSync(scratch);
  }
}
main().catch(() => { console.error('Host EPUB diagnostic failed.'); process.exitCode = 1; });
