import { context } from '../../src/epub-spike/limits';
import { finishReport, type Report, type TestResult } from '../../src/epub-spike/report';
export const reportMetadata: Report['metadata'] = { appVersion:'test',audience:'internal-personal',diagnosticFlag:'enabled',runtime:'test',platform:'ios',hermes:false,tier:'quick' };
export function passedResult(id='synthetic', expected='accepted'): TestResult {
  const ctx=context();
  return {id,name:id,fixture:id,expected,actual:expected,status:'pass',failureCategory:expected==='accepted'?null:expected,
    elapsedMs:1,longestStallMs:0,cancellationLatencyMs:'unavailable',preparation:{elapsedMs:0,longestStallMs:0},
    counters:{output:0,bytesRead:0,compressed:0,maxInput:0,maxOutput:0,timings:ctx.timings,operations:ctx.operations},
    cleanup:{created:1,removed:1,handlesOpened:1,handlesClosed:1,failures:0},notes:[]};
}
export const passedReport=(tier:Report['metadata']['tier']='quick')=>finishReport({...reportMetadata,tier},new Date().toISOString(),[passedResult()]);
