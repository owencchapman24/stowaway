import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { CORPUS } from '../src/epub-spike/corpus';
import { finishReport, serializeReport } from '../src/epub-spike/report';
import { passedResult, reportMetadata } from './fixtures/epub-report';

const root=path.resolve(__dirname,'..');
function hostReport() {return finishReport({...reportMetadata,tier:'extended'},new Date().toISOString(),CORPUS.map((c)=>passedResult(c.id,c.expected)));}
test('normal CI runs the host verdict serially after checks and before exports',()=>{
  const workflow=fs.readFileSync(path.join(root,'.github/workflows/check.yml'),'utf8');
  const step=workflow.indexOf('- run: npm run epub:host-report');
  expect(step).toBeGreaterThan(workflow.indexOf('- run: npm run check'));
  expect(step).toBeLessThan(workflow.indexOf('- run: npx expo export'));
  expect(workflow).not.toMatch(/continue-on-error:\s*true/);
});
test.each(['pass','performance','security','cleanup','invalid','summary','skip','cancel','exception'] as const)('real host CLI exits correctly for injected %s report',kind=>{
  let report=hostReport();
  if(kind==='performance')report.tests[0]!.longestStallMs=251;
  if(kind==='security'){const test=report.tests.find((t)=>t.id==='crc')!;test.actual='accepted';test.status='fail';}
  if(kind==='cleanup'){report.tests[0]!.cleanup.failures=1;report.tests[0]!.cleanup.removed=0;report.tests[0]!.status='fail';}
  if(kind==='skip'){report.tests[0]!.status='skip';report.tests[0]!.actual='not-run';}
  report=finishReport(report.metadata,report.startedAt,report.tests,kind==='cancel');
  if(kind==='invalid')Object.assign(report,{privateProse:'must never be written'});
  if(kind==='summary')report.summary.passed++;
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'stowaway-m1a-cli-')),preload=path.join(dir,'fault.cjs');
  try {
    // Isolated child-process interception; no production bypass flag or threshold override.
    fs.writeFileSync(preload,`const Module=require('node:module');const original=Module._load;Module._load=function(request,parent,isMain){if(request==='../src/epub-spike/diagnostic.ts'&&parent.filename.endsWith('epub-host-report.cjs'))return{runDiagnostic:async()=>{${kind==='exception'?'throw new Error("injected")':'return '+JSON.stringify(report)}}};return original.call(this,request,parent,isMain);};`);
    const result=spawnSync(process.execPath,['--require',preload,path.join(root,'scripts/epub-host-report.cjs')],{cwd:root,encoding:'utf8',timeout:20000});
    expect(result.error).toBeUndefined();expect(result.status).toBe(kind==='pass'?0:1);
    if(kind==='invalid'||kind==='summary'||kind==='exception')expect(fs.existsSync(path.join(root,'dist/m1a-reports/host-direct.json'))).toBe(false);
  } finally {fs.unlinkSync(preload);fs.rmdirSync(dir);}
},25000);
test('report validation rejects contradictory success and keeps attempt IDs distinct',()=>{
  const first=hostReport(),second=hostReport();expect(first.attemptId).not.toBe(second.attemptId);
  first.tests[0]!.actual='assertion';expect(()=>serializeReport(first)).toThrow('Invalid diagnostic success');
  const skip=passedResult();skip.status='skip';skip.actual='not-run';
  expect(finishReport(reportMetadata,new Date().toISOString(),[skip]).summary.verdict).toBe('fail');
  expect(finishReport(reportMetadata,new Date().toISOString(),[]).summary.verdict).toBe('fail');
});
test('every fixture regenerates byte-identically, with unique IDs and mandatory accepted-output expectations',()=>{
  expect(new Set(CORPUS.map((c)=>c.id)).size).toBe(CORPUS.length);
  for(const test of CORPUS){
    const hash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
    expect(hash(test.bytes())).toBe(hash(test.bytes()));
    if(test.expected==='accepted'){expect(test.output.chapterCount).toBe(3);expect(typeof test.output.chapter).toBe('function');}
  }
});

test('real Extended host/CI runner fails one matching-category acquisition fault, rather than reporting 64/64 PASS',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'stowaway-m1a-acquire-fault-')),preload=path.join(dir,'fault.cjs');
  try {
    // Keep the real runner, real corpus/oracles and host filesystem. Intercept only one acquisition.
    fs.writeFileSync(preload,`const Module=require('node:module'),original=Module._load;
      Module._load=function(request,parent,isMain){
        const loaded=original.call(this,request,parent,isMain);
        if(request!=='../src/epub-spike/diagnostic.ts'||!parent.filename.endsWith('epub-host-report.cjs'))return loaded;
        const {CORPUS}=original.call(this,'../src/epub-spike/corpus.ts',parent);
        const {EpubFailure}=original.call(this,'../src/epub-spike/limits.ts',parent);
        return {...loaded,runDiagnostic:async(io,...args)=>{
          let index=0;return loaded.runDiagnostic({async create(bytes){
            if(CORPUS[index++].id==='ratio')throw Object.assign(new EpubFailure('budget'),{message:'PRIVATE_ACQUISITION_SENTINEL'});
            return io.create(bytes);
          }},...args);
        }};
      };`);
    const result=spawnSync(process.execPath,['--require',preload,path.join(root,'scripts/epub-host-report.cjs')],{cwd:root,encoding:'utf8',timeout:60000});
    expect(result.error).toBeUndefined();expect(result.status).toBe(1);
    const json=fs.readFileSync(path.join(root,'dist/m1a-reports/host-direct.json'),'utf8'),report=JSON.parse(json);
    expect(report.summary).toMatchObject({total:64,passed:63,failed:1,skipped:0,cleanupFailures:0,verdict:'fail'});
    const test=report.tests.find((t:{id:string})=>t.id==='ratio');
    expect(test).toMatchObject({actual:'budget',expected:'budget',status:'fail',notes:['Failure origin: acquisition.']});
    expect(test.counters.bytesRead).toBe(0);expect(test.counters.operations.cleanup.calls).toBe(0);
    expect(json).not.toContain('PRIVATE_ACQUISITION_SENTINEL');expect(()=>serializeReport(report)).not.toThrow();
  } finally {fs.unlinkSync(preload);fs.rmdirSync(dir);}
},65000);
