import { File, Directory, Paths } from 'expo-file-system';
import { Share } from 'react-native';
import * as policy from '../src/epub-spike/policy';
import { selectNativeEpub, runNativeEpubSuite, runNativeEpubCase, exportNativeEpubReport } from '../src/epub-spike/native';
import { finishReport } from '../src/epub-spike/report';
import { EpubFailure } from '../src/epub-spike/limits';

jest.mock('../src/epub-spike/policy',()=>({__esModule:true,EPUB_DIAGNOSTIC_FLAG:'enabled',requireDiagnostic:jest.fn()}));
jest.mock('expo-file-system',()=>({Paths:{cache:{uri:'file:///synthetic-cache'},availableDiskSpace:1024*1024*1024},File:jest.fn(),Directory:jest.fn(),FileMode:{ReadOnly:'r',WriteOnly:'w'}}));
const picker=jest.fn();Object.assign(File,{pickFileAsync:picker});
beforeEach(()=>{jest.clearAllMocks();jest.mocked(policy.requireDiagnostic).mockImplementation(()=>{});});

test('native low-storage budget cannot satisfy the ratio validation expectation',async()=>{
  const available=Paths.availableDiskSpace;Object.assign(Paths,{availableDiskSpace:0});
  try {
    const report=await runNativeEpubCase('ratio',new AbortController().signal);
    expect(report.summary).toMatchObject({passed:0,failed:1,skipped:0,verdict:'fail'});
    expect(report.tests[0]).toMatchObject({actual:'budget',status:'fail',notes:['Failure origin: acquisition.']});
    expect(Directory).not.toHaveBeenCalled();expect(File).not.toHaveBeenCalled();
  } finally {Object.assign(Paths,{availableDiskSpace:available});}
});

test('native scratch writing with matching budget failure cleans up and still fails',async()=>{
  const dir={create:jest.fn(),exists:true,list:jest.fn(()=>[]),delete:jest.fn()};
  const writer={writeBytes:jest.fn(()=>{throw new EpubFailure('budget');}),close:jest.fn()};
  const file={create:jest.fn(),open:jest.fn(()=>writer),exists:true,delete:jest.fn()};
  jest.mocked(Directory).mockImplementation(()=>dir as unknown as Directory);
  jest.mocked(File).mockImplementation(()=>file as unknown as File);
  const report=await runNativeEpubCase('ratio',new AbortController().signal);
  expect(report.summary).toMatchObject({passed:0,failed:1,cleanupFailures:0,verdict:'fail'});
  expect(report.tests[0]).toMatchObject({actual:'budget',status:'fail',notes:['Failure origin: acquisition.'],cleanup:{created:1,removed:1,handlesOpened:1,handlesClosed:1,failures:0}});
  expect(writer.close).toHaveBeenCalledTimes(1);expect(file.delete).toHaveBeenCalledTimes(1);
});
test('native entry points deny before filesystem, picker or share',async()=>{
  jest.mocked(policy.requireDiagnostic).mockImplementation(()=>{throw new Error('policy');});
  const signal=new AbortController().signal;
  await expect(runNativeEpubSuite('quick',signal)).rejects.toThrow('policy');
  await expect(runNativeEpubCase('dense-valid',signal)).rejects.toThrow('policy');
  await expect(selectNativeEpub(signal)).rejects.toThrow('policy');
  const report=finishReport({appVersion:'test',audience:'public',diagnosticFlag:'enabled',runtime:'test',platform:'ios',hermes:false,tier:'quick'},new Date().toISOString(),[]);
  await expect(exportNativeEpubReport(report)).rejects.toThrow('policy');
  expect(Directory).not.toHaveBeenCalled();expect(File).not.toHaveBeenCalled();expect(picker).not.toHaveBeenCalled();
});
test('picker cancellation differs from provider failure and neither deletes provider files',async()=>{
  picker.mockRejectedValueOnce({code:'ERR_FILE_PICKING_CANCELLED'});
  await expect(selectNativeEpub(new AbortController().signal)).resolves.toBeNull();
  picker.mockRejectedValueOnce({code:'ERR_PROVIDER_FAILURE',message:'private path'});
  await expect(selectNativeEpub(new AbortController().signal)).rejects.toMatchObject({code:'io'});
  expect(Directory).not.toHaveBeenCalled();expect(File).not.toHaveBeenCalled();
});
test('second native run cannot overlap a pending picker; policy is checked again on return',async()=>{
  let resolve!: (value:unknown)=>void;picker.mockReturnValue(new Promise((r)=>{resolve=r;}));
  const signal=new AbortController().signal, pending=selectNativeEpub(signal);
  await expect(runNativeEpubSuite('quick',signal)).rejects.toMatchObject({code:'policy'});
  await expect(runNativeEpubCase('ratio',signal)).rejects.toMatchObject({code:'policy'});
  jest.mocked(policy.requireDiagnostic).mockImplementation(()=>{throw new Error('revoked');});resolve({size:1});
  await expect(pending).rejects.toThrow('revoked');expect(Directory).not.toHaveBeenCalled();
});
test('report export shares a generated local JSON file and deletes only that file after dismissal',async()=>{
  const dir={create:jest.fn(),exists:true,list:jest.fn(()=>[]),delete:jest.fn()};
  const file={uri:'file:///synthetic-cache/stowaway-m1a/generated/report.json',create:jest.fn(),write:jest.fn(),exists:true,delete:jest.fn()};
  jest.mocked(Directory).mockImplementation(()=>dir as unknown as Directory);
  jest.mocked(File).mockImplementation(()=>file as unknown as File);
  const share=jest.spyOn(Share,'share').mockResolvedValue({action:Share.dismissedAction});
  const report=finishReport({appVersion:'test',audience:'internal-personal',diagnosticFlag:'enabled',runtime:'test',platform:'ios',hermes:false,tier:'quick'},new Date().toISOString(),[]);
  await exportNativeEpubReport(report);
  expect(share).toHaveBeenCalledWith({url:file.uri},{subject:'Stowaway EPUB diagnostic'});
  expect(JSON.parse(file.write.mock.calls[0]![0] as string).schemaVersion).toBe(3);
  expect(file.delete).toHaveBeenCalledTimes(1);expect(dir.delete).toHaveBeenCalledTimes(1);share.mockRestore();
});
