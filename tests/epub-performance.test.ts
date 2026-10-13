import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { decodeXmlUtf8, decodeUtf8, utf8 } from '../src/epub-spike/bytes';
import { hashText, hashImage, HASH_CHUNK } from '../src/epub-spike/hash';
import { context, LIMITS } from '../src/epub-spike/limits';
import { strictXml } from '../src/epub-spike/xml';
import { canonicalChapter } from '../src/epub-spike/canonical';
import { xhtml } from '../src/epub-spike/fixtures';
import { sanitize } from '../src/content/sanitize';
import { finishReport, serializeReport } from '../src/epub-spike/report';
import { passedResult, reportMetadata } from './fixtures/epub-report';

test('pinned Node/Metro parser artifacts preserve trees, offsets, malformed-input rejection and linear scan counts', () => {
  const result = spawnSync(process.execPath, ['scripts/epub-parser-benchmark.cjs'], {cwd:path.resolve(__dirname,'..'),encoding:'utf8',timeout:25000});
  expect(result.status).toBe(0);
  const report=JSON.parse(result.stdout);
  expect(report.differentialCases).toBeGreaterThanOrEqual(20);
  const dense=report.before.find((r:{id:string})=>r.id==='siblings-9000');
  expect(dense.suffixUnits).toBeGreaterThan(6_000_000_000);
  expect(report.after.every((r:{suffixUnits:number;correct:boolean})=>r.suffixUnits===0 && r.correct)).toBe(true);
},30000);

test.each([HASH_CHUNK-1,HASH_CHUNK,HASH_CHUNK+1,2*HASH_CHUNK-1])('hash identity and fatal decoding at chunk boundary %i',async(padding)=>{
  const source='x'.repeat(padding)+'🌊é航\r\n'+'z'.repeat(HASH_CHUNK+1), bytes=utf8(source),ctx=context();
  expect(await decodeXmlUtf8(bytes,LIMITS.string,ctx)).toBe(decodeUtf8(bytes));
  expect(await hashText(source,ctx)).toBe(createHash('sha256').update(source).digest('hex'));
  expect(await hashImage(bytes,ctx)).toBe(createHash('sha256').update(bytes).digest('hex'));
  expect(ctx.operations.contentHash.calls).toBeGreaterThan(2);
  expect(ctx.operations.xmlDecode.calls).toBeGreaterThan(2);
});
test.each([[0xc0,0xaf],[0xf0,0x9f,0x8c],[0xed,0xa0,0x80],[0x80,0x80,0x80,0x80,0x80]].map((tail)=>({tail})))('bounded decoder preserves fatal UTF-8 rejection: $tail',async({tail})=>{
  for(const padding of [16381,16382,16383,16384]) {
    const bytes=new Uint8Array(padding+tail.length);bytes.fill(120,0,padding);bytes.set(tail,padding);
    await expect(decodeXmlUtf8(bytes,LIMITS.string,context())).rejects.toMatchObject({code:'xml'});
  }
});
test('decoded budget retains exact valid/invalid boundary before normalization',async()=>{
  expect((await decodeXmlUtf8(utf8('x'.repeat(LIMITS.string)),LIMITS.string,context())).length).toBe(LIMITS.string);
  await expect(decodeXmlUtf8(utf8('x'.repeat(LIMITS.string)+'x'),LIMITS.string,context())).rejects.toMatchObject({code:'budget'});
});
test('a real timer can cancel decoding and content hashing between bounded units',async()=>{
  for(const operation of ['decode','hash'] as const) {
    const bytes=utf8('x'.repeat(981000)),abort=new AbortController(),ctx=context(abort.signal);
    const measured=operation==='decode'?'xmlDecode':'contentHash';let timer:ReturnType<typeof setTimeout>|undefined;
    ctx.checkpoint=()=>{if(ctx.operations[measured].calls && timer===undefined){timer=setTimeout(()=>abort.abort(),0);ctx.lastYield=-Infinity;}};
    try { await expect(operation==='decode'?decodeXmlUtf8(bytes,LIMITS.string,ctx):hashText('x'.repeat(981000),ctx)).rejects.toMatchObject({code:'cancelled'}); }
    finally {if(timer!==undefined)clearTimeout(timer);}
    expect(ctx.operations[measured].calls).toBeGreaterThan(0);expect(ctx.operations[measured].calls).toBeLessThan(10);
  }
});
test('canonical chunking preserves formatting, image slots, exact block/link IDs and Unicode hash',async()=>{
  const body='<div><p>'+'x'.repeat(16383)+'🌊 &amp; &lt; &#13; <em>safe</em></p><details><p>spoiler</p></details><a href="https://example.org/">link</a><img src="image.png"/></div>';
  const ctx=context(),result=await canonicalChapter(await strictXml(utf8(xhtml(body)),ctx),ctx);
  const expected=sanitize(body);
  expect(result.html).toBe(expected.html);expect(result.blockIds).toEqual(expected.blockIds);expect(result.links).toEqual(expected.links);
  expect(result.contentHash).toBe(createHash('sha256').update(`${expected.sanitizerVersion}\n${expected.html}`).digest('hex'));
  expect(result.images).toEqual([{reference:'image.png',blockId:'block-0005'}]);
});
test('schema 3 reports preparation separately and retain unchanged processing gates',()=>{
  const result=passedResult();result.preparation={elapsedMs:400,longestStallMs:390};
  let report=finishReport(reportMetadata,new Date().toISOString(),[result]);
  expect(report.schemaVersion).toBe(3);expect(report.summary.verdict).toBe('pass');expect(JSON.parse(serializeReport(report))).toEqual(report);
  result.longestStallMs=251;report=finishReport(reportMetadata,report.startedAt,[result]);expect(report.summary.verdict).toBe('fail');
  result.longestStallMs=0;result.cancellationLatencyMs=1001;expect(finishReport(reportMetadata,report.startedAt,[result]).summary.verdict).toBe('fail');
  result.counters.operations.xmlParse.maxMs=Infinity;expect(()=>serializeReport(report)).toThrow();
});
