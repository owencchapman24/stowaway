import { Directory, File, FileMode, Paths, type FileHandle } from 'expo-file-system';
import { randomUUID } from 'expo-crypto';
import Constants from 'expo-constants';
import { Platform, Share } from 'react-native';
import { BUILD_AUDIENCE } from '../config/build-audience';
import { EPUB_DIAGNOSTIC_FLAG, requireDiagnostic } from './policy';
import { runDiagnostic, runSelected, ScratchFailure, type ScratchInput } from './diagnostic';
import { LIMITS, requireEpub, checkAbort, checkpoint, context, EpubFailure } from './limits';
import { serializeReport, type Report, type TestResult } from './report';
import type { PerformanceCase } from './corpus';

let running = false;
function metadata(tier: Report['metadata']['tier']): Report['metadata'] {
  return { appVersion: Constants.expoConfig?.version ?? 'unavailable', audience: BUILD_AUDIENCE,
    diagnosticFlag: EPUB_DIAGNOSTIC_FLAG === 'enabled' ? 'enabled' : 'disabled', runtime: 'React Native', platform: Platform.OS,
    hermes: !!(globalThis as { HermesInternal?: unknown }).HermesInternal, tier };
}
function reserve() { requireEpub(Paths.availableDiskSpace >= LIMITS.reserve, 'budget'); }
function scratchDirectory() {
  requireDiagnostic();
  const root = new Directory(Paths.cache, 'stowaway-m1a'); root.create({ intermediates: true, idempotent: true });
  const dir = new Directory(root, randomUUID()); dir.create(); return dir;
}
async function scratchInput(bytes: Uint8Array | File, signal?: AbortSignal): Promise<ScratchInput> {
  requireDiagnostic(); reserve(); checkAbort(signal);
  const size = bytes instanceof Uint8Array ? bytes.length : bytes.size;
  requireEpub(Number.isSafeInteger(size) && size >= 0 && size <= LIMITS.archive, 'budget');
  const dir = scratchDirectory(), file = new File(dir, `${randomUUID()}.epub`);
  const stats: TestResult['cleanup'] = { created: 0, removed: 0, handlesOpened: 0, handlesClosed: 0, failures: 0 };
  let handle: FileHandle | undefined, writer: FileHandle | undefined, original: FileHandle | undefined;
  const close = () => { if (handle) { handle.close(); handle = undefined; stats.handlesClosed++; } };
  const cleanup = () => {
    close();
    // These are generated objects created by this call, never provider or ZIP paths.
    if (file.exists) { file.delete(); stats.removed++; }
    if (dir.exists && dir.list().length === 0) dir.delete();
  };
  try {
    file.create(); stats.created++; writer = file.open(FileMode.WriteOnly); stats.handlesOpened++;
    if (!(bytes instanceof Uint8Array)) { original = bytes.open(FileMode.ReadOnly); stats.handlesOpened++; requireEpub(original.size === size, 'io'); }
    const ctx = context(signal);
    for (let at = 0; at < size; at += LIMITS.buffer) {
      await checkpoint(ctx, 'resource');
      const n = Math.min(LIMITS.buffer, size - at), chunk = original ? original.readBytes(n) : (bytes as Uint8Array).subarray(at, at + n);
      requireEpub(chunk.length === n, 'io'); writer.writeBytes(chunk);
    }
    writer.close(); writer = undefined; stats.handlesClosed++;
    if (original) { original.close(); original = undefined; stats.handlesClosed++; }
    requireEpub(file.size === size, 'io'); handle = file.open(FileMode.ReadOnly); stats.handlesOpened++;
    requireEpub(handle.size === size, 'io');
    return { stats, cleanup, file: { size, async read(at,n) {
      requireEpub(handle && n <= LIMITS.buffer && at >= 0 && at + n <= size, 'io');
      handle.offset = at; return handle.readBytes(n);
    }, close } };
  } catch (error) {
    try { if (writer) { writer.close(); stats.handlesClosed++; } } catch { stats.failures++; }
    try { if (original) { original.close(); stats.handlesClosed++; } } catch { stats.failures++; }
    try { cleanup(); } catch { stats.failures++; }
    throw new ScratchFailure(stats, error instanceof EpubFailure ? error.code : 'io');
  }
}
async function exclusive<T>(work: () => Promise<T>): Promise<T> {
  requireDiagnostic(); requireEpub(!running, 'policy'); running = true;
  try { return await work(); } finally { running = false; }
}
export function runNativeEpubSuite(tier: 'quick' | 'extended', signal: AbortSignal, progress?: (done: number, total: number) => void) {
  return exclusive(() => runDiagnostic({ create: (bytes) => scratchInput(bytes, signal) }, metadata(tier), signal, progress));
}
export function runNativeEpubCase(id: PerformanceCase, signal: AbortSignal) {
  return exclusive(() => runDiagnostic({ create: (bytes) => scratchInput(bytes, signal) }, metadata('single'), signal, undefined, id));
}
export function selectNativeEpub(signal: AbortSignal): Promise<Report | null> {
  return exclusive(async () => {
    reserve(); checkAbort(signal);
    let picked: File | File[];
    try {
      // SDK57 object overload swallows every provider error as cancellation.
      // This supported deprecated overload retains the native error for classification.
      picked = await File.pickFileAsync(undefined, 'application/epub+zip');
    } catch (error) {
      if ((error as { code?: string }).code === 'ERR_FILE_PICKING_CANCELLED') return null;
      throw new EpubFailure('io');
    }
    requireDiagnostic(); checkAbort(signal); requireEpub(!Array.isArray(picked), 'unsupported');
    return runSelected(() => scratchInput(picked, signal), metadata('selected'), signal);
  });
}
export function exportNativeEpubReport(report: Report) {
  return exclusive(async () => {
    requireEpub(Platform.OS === 'ios', 'unsupported');
    const json = serializeReport(report), dir = scratchDirectory(), file = new File(dir, `stowaway-epub-${randomUUID()}.json`);
    try { file.create(); file.write(json); await Share.share({ url: file.uri }, { subject: 'Stowaway EPUB diagnostic' }); }
    finally { if (file.exists) file.delete(); if (dir.exists && !dir.list().length) dir.delete(); }
  });
}
