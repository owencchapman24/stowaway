import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { randomUUID } from 'node:crypto';
import { runDiagnostic, runSelected, type DiagnosticIO } from '../src/epub-spike/diagnostic';
import { CORPUS, replaceEntry } from '../src/epub-spike/corpus';
import { epubEntries, makeZip, xhtml } from '../src/epub-spike/fixtures';
import { serializeReport, type Report } from '../src/epub-spike/report';
import { diagnosticEligible } from '../src/epub-spike/policy';
import type { PerformanceCase } from '../src/epub-spike/corpus';

const metadata: Report['metadata'] = {appVersion:'host-test',audience:'internal-personal',diagnosticFlag:'enabled',runtime:`Node ${process.version}`,platform:process.platform,hermes:false,tier:'extended'};
function hostIO(root: string): DiagnosticIO {
  return {async create(bytes) {
    const name = path.join(root,randomUUID()+'.epub'); fs.writeFileSync(name,bytes,{flag:'wx'});
    const fd = fs.openSync(name,'r'), stats = {created:1,removed:0,handlesOpened:1,handlesClosed:0,failures:0}; let closed = false;
    return {stats,file:{size:bytes.length,async read(at,n){const b=Buffer.alloc(n);const read=fs.readSync(fd,b,0,n,at);return b.subarray(0,read);},close(){if(!closed){fs.closeSync(fd);closed=true;stats.handlesClosed++;}}},cleanup(){fs.unlinkSync(name);stats.removed++;}};
  }};
}
test('entire device runner against real host files, report, cleanup, no network', async () => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'stowaway-m1a-report-'));
  const network=jest.spyOn(globalThis,'fetch').mockImplementation(async()=>{throw new Error('Network forbidden');});
  try {
    const report=await runDiagnostic(hostIO(root),metadata);
    expect(report.summary.failed).toBe(0); expect(report.summary.total).toBe(CORPUS.length);
    expect(report.summary.cleanupFailures).toBe(0); expect(report.tests.every((t)=>t.cleanup.created===t.cleanup.removed && t.cleanup.handlesOpened===t.cleanup.handlesClosed)).toBe(true);
    expect(report.tests.filter((t)=>t.id.startsWith('cancel-')).every((t)=>typeof t.cancellationLatencyMs==='number')).toBe(true);
    expect(JSON.parse(serializeReport(report))).toEqual(report); expect(fs.readdirSync(root)).toEqual([]); expect(network).not.toHaveBeenCalled();
    // Optional local evidence artifact. Normal CI/check does not depend on or publish it.
    if(process.env.STOWAWAY_EPUB_REPORT){const dir=path.resolve('dist/m1a-reports');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'host.json'),serializeReport(report));}
  } finally {network.mockRestore(); for(const name of fs.readdirSync(root))fs.unlinkSync(path.join(root,name));fs.rmdirSync(root);}
},30000);
test('selected-file report cannot disclose content, metadata, member paths or provider URI', async () => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'stowaway-m1a-private-'));
  try {
    const bytes=makeZip(replaceEntry(epubEntries(),'Book/Text/main.xhtml',xhtml('<p>PRIVATE_BOOK_SENTINEL</p>')));
    const report=await runSelected(()=>hostIO(root).create(bytes),metadata);
    const json=serializeReport(report); expect(report.summary.passed).toBe(1);
    for(const secret of ['PRIVATE_BOOK_SENTINEL','Synthetic Café','Book/Text','synthetic-001','Stowaway Test Author',root])expect(json).not.toContain(secret);
    const again=await runSelected(()=>hostIO(root).create(bytes),metadata);expect(again.summary.passed).toBe(1);expect(fs.readdirSync(root)).toEqual([]);
  } finally {fs.rmdirSync(root);}
});
test('cancelled suite reports remaining cases as skipped',async()=>{
  const abort=new AbortController();abort.abort();const create=jest.fn();
  const report=await runDiagnostic({create}, {...metadata,tier:'quick'},abort.signal);
  expect(report.summary.verdict).toBe('cancelled');expect(report.summary.skipped).toBe(CORPUS.filter((t)=>t.tier==='quick').length);expect(create).not.toHaveBeenCalled();
});
test('cleanup failures prevent a successful result',async()=>{
  const bytes=makeZip(epubEntries());const close=jest.fn(),cleanup=jest.fn(()=>{throw new Error('no space');});
  const report=await runSelected(async()=>({file:{size:bytes.length,async read(at,n){return bytes.slice(at,at+n);},close},cleanup,stats:{created:1,removed:0,handlesOpened:1,handlesClosed:0,failures:0}}),metadata);
  expect(report.summary.verdict).toBe('fail');expect(report.summary.cleanupFailures).toBeGreaterThan(0);expect(cleanup).toHaveBeenCalledTimes(1);expect(close).toHaveBeenCalled();
});
test('report schema rejects extra fields and nonfinite measurements',async()=>{
  const abort=new AbortController();abort.abort();const report=await runDiagnostic({create:jest.fn()},metadata,abort.signal);
  expect(()=>serializeReport({...report,privateProse:'secret'} as Report)).toThrow('Unexpected diagnostic fields');
  expect(()=>serializeReport({...report,summary:{...report.summary,longestStallMs:Infinity}})).toThrow('Invalid diagnostic measurement');
});
test.each(['public','unconfigured',undefined,'internal-personal'])('strict diagnostic permission for %s', (audience)=>{
  for(const flag of [undefined,'','true','1','ENABLED',' enabled ','enabled'])expect(diagnosticEligible(audience,flag)).toBe(audience==='internal-personal' && flag==='enabled');
});
test('fixture preparation stall is disclosed separately; actual acquisition stalls still fail',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'stowaway-m1a-scope-'));
  const test=CORPUS.find((c)=>c.id==='ratio')!,original=test.bytes;
  const delay=()=>{const end=performance.now()+320;while(performance.now()<end){ /* Deliberate synthetic stall. */ }};
  const spy=jest.spyOn(test,'bytes').mockImplementation(()=>{delay();return original();});
  try {
    const io=hostIO(root),single={...metadata,tier:'single' as const};
    const prepared=await runDiagnostic(io,single,undefined,undefined,'ratio');
    expect(prepared.tests[0]!.preparation.longestStallMs).toBeGreaterThan(250);
    expect(prepared.tests[0]!.actual).toBe('budget');expect(prepared.summary.verdict).toBe('pass');
    spy.mockRestore();
    const acquired=await runDiagnostic({async create(bytes){delay();return io.create(bytes);}},single,undefined,undefined,'ratio');
    expect(acquired.tests[0]!.counters.timings.acquire).toBeGreaterThan(300);
    expect(acquired.summary.longestStallMs).toBeGreaterThan(250);expect(acquired.summary.verdict).toBe('fail');
    expect(()=>serializeReport(acquired)).not.toThrow();expect(fs.readdirSync(root)).toEqual([]);
  } finally {spy.mockRestore();fs.rmdirSync(root);}
});
test('single-case selection is restricted and cannot masquerade as a full suite',async()=>{
  const create=jest.fn();
  await expect(runDiagnostic({create},metadata,undefined,undefined,'ratio')).rejects.toMatchObject({code:'policy'});
  await expect(runDiagnostic({create},{...metadata,tier:'single'},undefined,undefined,'selected-file' as PerformanceCase)).rejects.toMatchObject({code:'policy'});
  expect(create).not.toHaveBeenCalled();
});
