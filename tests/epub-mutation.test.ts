import * as canonical from '../src/epub-spike/canonical';
import * as packages from '../src/epub-spike/package';
import { runDiagnostic } from '../src/epub-spike/diagnostic';
import type { Report } from '../src/epub-spike/report';
import { CORPUS } from '../src/epub-spike/corpus';

const metadata: Report['metadata'] = { appVersion:'test',audience:'internal-personal',diagnosticFlag:'enabled',runtime:'Jest mutation',platform:'host',hermes:false,tier:'quick' };
const io = { async create(bytes: Uint8Array) {
  const stats = {created:1,removed:0,handlesOpened:1,handlesClosed:0,failures:0}; let closed=false;
  return {stats,file:{size:bytes.length,async read(at:number,n:number){return bytes.slice(at,at+n);},close(){if(!closed){closed=true;stats.handlesClosed++;}}},cleanup(){stats.removed++;}};
} };
afterEach(()=>jest.restoreAllMocks());
test.each(['empty','corrupt-text','omit-content','unsafe'] as const)('shared diagnostic rejects %s canonical mutation',async(kind)=>{
  const original=canonical.canonicalChapter;
  jest.spyOn(canonical,'canonicalChapter').mockImplementation(async(...args)=>{
    const chapter=await original(...args);
    return {...chapter,html:kind==='empty'?'':kind==='corrupt-text'?chapter.html.replace('A synthetic preface.','CORRUPTED'):kind==='omit-content'?chapter.html.replace(/<p[^>]*>A synthetic preface\.<\/p>/,''):chapter.html+'<script>UNSAFE_SURVIVED</script>'};
  });
  const report=await runDiagnostic(io,{...metadata,tier:kind==='empty'?'extended':'quick'});
  expect(report.summary.verdict).toBe('fail');expect(report.summary.failed).toBeGreaterThan(0);
  expect(report.tests.find((t)=>t.id==='epub3')).toMatchObject({status:'fail',actual:'assertion'});
  if(kind==='empty') {
    const accepted=CORPUS.filter((c)=>c.expected==='accepted').map((c)=>c.id);
    const acceptedResults=report.tests.filter((t)=>accepted.includes(t.id));
    expect(acceptedResults).toHaveLength(accepted.length);
    expect(acceptedResults.every((t)=>t.status==='fail' && t.actual==='assertion')).toBe(true);
    // Invalid packages can also fail earlier at their mutated chapter callback.
    expect(report.summary.failed).toBeGreaterThanOrEqual(accepted.length);
  }
},30000);
test('shared diagnostic rejects corrupted callback chapter ordering even if summaries look correct',async()=>{
  const original=packages.processEpub;
  jest.spyOn(packages,'processEpub').mockImplementation((file,ctx,options)=>original(file,ctx,{onChapter(c,s){options?.onChapter?.(c,{...s,ordinal:s.ordinal===0?1:s.ordinal===1?0:s.ordinal});}}));
  const report=await runDiagnostic(io,metadata);
  expect(report.summary.verdict).toBe('fail');expect(report.tests.find((t)=>t.id==='epub3')).toMatchObject({status:'fail',actual:'assertion'});
},30000);
test('shared diagnostic rejects an omitted chapter callback even when package summaries are unchanged',async()=>{
  const original=packages.processEpub;
  jest.spyOn(packages,'processEpub').mockImplementation((file,ctx,options)=>original(file,ctx,{onChapter(c,s){if(s.ordinal!==1)options?.onChapter?.(c,s);}}));
  const report=await runDiagnostic(io,metadata);
  expect(report.tests.find((t)=>t.id==='epub3')).toMatchObject({status:'fail',actual:'assertion'});
},30000);
