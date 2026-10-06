import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createS2ADiagnostic, type S2ADependencies, type S2ADiagnostic } from '../../src/diagnostics/s2a/recovery';
import { assertS2AResources, removeS2AOrphans, removeS2ARenders, S2A_DATABASE } from '../../src/diagnostics/s2a/isolation';
import { createLocalContentFiles } from '../../src/storage/local-files';
import { relativeFile } from '../../src/storage/file-primitives';
import { compileFixture, createRepository } from '../../src/storage/repository';
import { migrate } from '../../src/storage/migrations';
import { hostSqlite } from './host-sqlite';
import { hostFiles } from './host-files';

const digest = async (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const bundled = async () => new Uint8Array(readFileSync(join(process.cwd(), 'assets/harbor.png')));
let documentRoot: string;
let deps: S2ADependencies;
let diagnostic: S2ADiagnostic;
let handles: Set<ReturnType<typeof hostSqlite>>;
let counter: number;
beforeEach(() => {
  documentRoot = mkdtempSync(join(tmpdir(), 'stowaway-s2a-')).replace(/\\/g, '/');
  const root = join(documentRoot, 'stowaway-s2a');
  const databaseDirectory = join(root, 'database').replace(/\\/g, '/');
  const database = join(databaseDirectory, S2A_DATABASE);
  handles = new Set(); counter = 0;
  deps = {
    documentRoot, files: hostFiles(root), databaseName: S2A_DATABASE, databaseDirectory,
    databaseExists: () => existsSync(database),
    open: async () => {
      const host = hostSqlite(database); handles.add(host);
      return { db: host.db, close: async () => { if (handles.delete(host)) host.close(); } };
    },
    deleteDatabase: async () => {
      assertS2AResources(documentRoot, deps.files, deps.databaseName, deps.databaseDirectory);
      for (const suffix of ['', '-wal', '-shm', '-journal']) if (existsSync(database + suffix)) rmSync(database + suffix);
    },
    digest, imageDigest: digest, bundled,
    uuid: () => `11111111-1111-4111-8111-${String(++counter).padStart(12, '0')}`,
  };
  diagnostic = createS2ADiagnostic(deps);
});
afterEach(() => {
  handles.forEach((host) => host.close());
  if (!documentRoot.startsWith(join(tmpdir(), 'stowaway-s2a-').replace(/\\/g, '/'))) throw new Error('Unexpected test root.');
  rmSync(documentRoot, { recursive: true, force: true });
});

test('inspection never creates, seeds or repairs a missing database; initialization is explicit and refuses repeats', async () => {
  expect(await diagnostic.inspect()).toMatchObject({ initialized: false });
  expect(deps.databaseExists()).toBe(false);
  expect(existsSync(deps.files.root)).toBe(false);
  await diagnostic.initialize();
  await expect(diagnostic.initialize()).rejects.toThrow('already exists');
  expect((await diagnostic.inspect()).counts).toEqual({ stories: 1, chapters: 3, assets: 1 });
});

test.each(['before-write', 'after-html-write'] as const)('%s exception preserves all committed chapter fields and locator across normal reopen; retry queue works', async (boundary) => {
  await diagnostic.initialize();
  const baseline = await diagnostic.inspect();
  const repo = await diagnostic.readerStorage();
  const failed = diagnostic.text(boundary);
  // Queue another production write after the rejected transaction.
  await expect(failed).rejects.toThrow('Injected JS exception');
  await repo.savePreferences({ theme: 'light', fontSize: 26 });
  const reopened = await diagnostic.reopen();
  expect(reopened.chapter).toEqual(baseline.chapter);
  expect(reopened.locator).toEqual(baseline.locator);
  expect(await (await diagnostic.readerStorage()).getPreferences()).toEqual({ theme: 'light', fontSize: 26 });
  await diagnostic.text('commit');
  await diagnostic.text('commit');
  const next = await diagnostic.reopen();
  expect(next.revision).toBe('B');
  expect(next.chapter?.contentHash).not.toBe(baseline.chapter?.contentHash);
  expect(next.chapter?.html).toContain('S2A revision B');
  expect(next.chapter?.sanitizerVersion).toBe(baseline.chapter?.sanitizerVersion);
  expect(next.chapter?.blockIds).not.toEqual(baseline.chapter?.blockIds);
  expect(next.chapter?.links).toEqual(baseline.chapter?.links);
  expect(next.counts).toEqual({ stories: 1, chapters: 3, assets: 1 });
  expect(next.locator).toEqual(baseline.locator); // Preserved but incompatible; reader uses progression.
  await expect((await diagnostic.readerStorage()).saveLocator(baseline.locator!)).rejects.toThrow('stale');
});

test('host-driver injected before-commit failure rolls back all fields; same repository queue accepts subsequent writes', async () => {
  await diagnostic.initialize();
  const baseline = await diagnostic.inspect();
  [...handles][0]!.failNextCommit();
  await expect(diagnostic.text('commit')).rejects.toThrow('Injected commit failure');
  expect((await diagnostic.inspect()).chapter).toEqual(baseline.chapter);
  expect((await diagnostic.inspect()).locator).toEqual(baseline.locator);
  await diagnostic.text('commit');
  expect((await diagnostic.reopen()).revision).toBe('B');
});

test('real open transaction checkpoint shows old committed state on another connection; JS release rolls back and queued write survives', async () => {
  await diagnostic.initialize();
  const baseline = await diagnostic.inspect();
  const repo = await diagnostic.readerStorage();
  let reached!: () => void;
  const ready = new Promise<void>((resolve) => { reached = resolve; });
  const unsubscribe = diagnostic.subscribe((message) => { if (message === 'READY TO FORCE-QUIT BEFORE COMMIT') reached(); });
  const operation = diagnostic.text('checkpoint');
  const result = operation.catch((error: Error) => error); // Handle rejection before explicit rollback.
  await ready;
  const preferences = repo.savePreferences({ theme: 'light', fontSize: 30 });
  let queuedComplete = false;
  void preferences.then(() => { queuedComplete = true; });
  try {
    expect(diagnostic.checkpointReached).toBe(true);
    expect((await diagnostic.inspect()).chapter).toEqual(baseline.chapter);
    expect((await diagnostic.inspect()).marker).toBe('READY TO FORCE-QUIT BEFORE COMMIT');
    expect(queuedComplete).toBe(false);
    await expect(diagnostic.reset()).rejects.toThrow('active');
    await expect(diagnostic.cleanupOrphans()).rejects.toThrow('active');
  } finally { diagnostic.finishCheckpoint(false); await result; await preferences; unsubscribe(); }
  expect((await diagnostic.reopen()).chapter).toEqual(baseline.chapter);
  expect(await (await diagnostic.readerStorage()).getPreferences()).toEqual({ theme: 'light', fontSize: 30 });
});

test('checkpoint can be explicitly committed; normal reopen retains new content without seeding', async () => {
  await diagnostic.initialize();
  let reached!: () => void;
  const ready = new Promise<void>((resolve) => { reached = resolve; });
  const unsubscribe = diagnostic.subscribe((message) => { if (message === 'READY TO FORCE-QUIT BEFORE COMMIT') reached(); });
  const operation = diagnostic.text('checkpoint');
  await ready;
  diagnostic.finishCheckpoint(true);
  await operation; unsubscribe();
  const state = await diagnostic.reopen();
  expect(state.revision).toBe('B');
  expect(state.marker).toBe('Text commit completed: revision B');
});

test('failed checkpoint marker cannot leave an armed gate after rollback; later commit works', async () => {
  diagnostic = createS2ADiagnostic({ ...deps, files: { ...deps.files, write(path, bytes) {
    if (bytes === 'READY TO FORCE-QUIT BEFORE COMMIT') throw new Error('Injected marker write failure');
    deps.files.write(path, bytes);
  } } });
  await diagnostic.initialize();
  const baseline = await diagnostic.inspect();
  await expect(diagnostic.text('checkpoint')).rejects.toThrow('marker write failure');
  expect(diagnostic.checkpointReached).toBe(false);
  expect(diagnostic.busy).toBe(false);
  expect((await diagnostic.inspect()).chapter).toEqual(baseline.chapter);
  await diagnostic.text('commit');
  expect((await diagnostic.reopen()).revision).toBe('B');
});

test('an interrupted pre-schema DB is inspected without migration/seeding and requires explicit reset', async () => {
  deps.files.mkdir('database');
  const partial = await deps.open();
  await partial.db.execAsync('CREATE TABLE interruption_marker(value TEXT)');
  await partial.close();
  await expect(diagnostic.inspect()).rejects.toThrow('schema is absent');
  await expect(diagnostic.initialize()).rejects.toThrow('already exists');
  const persisted = await deps.open();
  expect(await persisted.db.getFirstAsync('PRAGMA user_version')).toEqual({ user_version: 0 });
  expect(await persisted.db.getFirstAsync("SELECT name FROM sqlite_master WHERE name = 'stories'")).toBeNull();
  await persisted.close();
  await diagnostic.reset();
  expect(deps.databaseExists()).toBe(false);
});

test('injected partial image and failed reference commit leave original reference and text intact; orphan retry succeeds', async () => {
  await diagnostic.initialize();
  const baseline = await diagnostic.inspect();
  await diagnostic.image('corrupt-stage');
  expect(await diagnostic.inspect()).toMatchObject({ reference: baseline.reference, image: 'valid', orphans: 1, chapter: baseline.chapter });
  await expect(diagnostic.image('fail-reference')).rejects.toThrow('asset-reference');
  expect(await diagnostic.reopen()).toMatchObject({ reference: baseline.reference, image: 'valid', orphans: 2, chapter: baseline.chapter });
  // A newly constructed diagnostic (relaunch seam) inspects, never promotes an orphan.
  diagnostic = createS2ADiagnostic(deps);
  expect((await diagnostic.inspect()).reference).toBe(baseline.reference);
  await diagnostic.image('commit');
  await diagnostic.image('commit');
  const next = await diagnostic.reopen();
  expect(next.reference).not.toBe(baseline.reference);
  expect(next.image).toBe('valid');
  expect(next.counts).toEqual({ stories: 1, chapters: 3, assets: 1 });
  expect(next.chapter).toEqual(baseline.chapter);
  const accepted = createLocalContentFiles(deps.files, digest, bundled, deps.uuid);
  expect(await accepted.image(next.reference!)).toEqual(await bundled());
});

test('validated-file checkpoint holds old reference, protects staging and rejects cleanup/reset; JS rollback leaves harmless orphan', async () => {
  await diagnostic.initialize();
  const baseline = await diagnostic.inspect();
  let reached!: () => void;
  const ready = new Promise<void>((resolve) => { reached = resolve; });
  const unsubscribe = diagnostic.subscribe((message) => { if (message.startsWith('READY TO FORCE-QUIT: VALIDATED IMAGE')) reached(); });
  const operation = diagnostic.image('checkpoint');
  const result = operation.catch((error: Error) => error);
  await ready;
  try {
    expect(await diagnostic.inspect()).toMatchObject({ reference: baseline.reference, image: 'valid', orphans: 1 });
    await expect(diagnostic.cleanupOrphans()).rejects.toThrow('active');
    await expect(diagnostic.reset()).rejects.toThrow('active');
  } finally { diagnostic.finishCheckpoint(false); await result; unsubscribe(); }
  expect((await diagnostic.reopen()).reference).toBe(baseline.reference);
  expect(await diagnostic.cleanupOrphans()).toBe(1);
  expect((await diagnostic.inspect()).image).toBe('valid');
});

test.each(['remove-reference', 'corrupt-reference'] as const)('%s leaves canonical text, passage and settings intact; render loss regenerates from SQLite with placeholder path', async (mode) => {
  await diagnostic.initialize();
  const baseline = await diagnostic.inspect();
  const content = createLocalContentFiles(deps.files, digest, bundled, deps.uuid);
  const repo = await diagnostic.readerStorage();
  const prefs = await repo.getPreferences();
  const directory = await content.render(baseline.chapter!, baseline.locator!, prefs, deps.uuid(), baseline.reference!);
  expect(deps.files.exists(`${directory}/asset-harbor.png`)).toBe(true);
  await diagnostic.image(mode);
  expect(await diagnostic.inspect()).toMatchObject({ chapter: baseline.chapter, locator: baseline.locator, image: mode === 'remove-reference' ? 'missing' : 'corrupt' });
  expect(await diagnostic.removeRenders()).toBe(1);
  expect(deps.files.exists(directory)).toBe(false);
  const state = await diagnostic.reopen();
  const render = await content.render(state.chapter!, state.locator!, await (await diagnostic.readerStorage()).getPreferences(), deps.uuid(), state.reference!);
  expect(deps.files.exists(`${render}/asset-harbor.png`)).toBe(false);
  const html = Buffer.from(await deps.files.read(`${render}/index.html`)).toString('utf8');
  expect(html).toContain(state.chapter!.html);
  expect(html).toContain(JSON.stringify(state.locator));
  expect(html).toContain('22px');
  expect(html).toContain('data-theme="dark"');
  expect(html).toContain('[Local image unavailable: ');
  expect(await (await diagnostic.readerStorage()).getPreferences()).toEqual(prefs);
});

test('accepted image and exact locator/preferences regenerate after deleting render directory with no bundle/source access', async () => {
  await diagnostic.initialize();
  const baseline = await diagnostic.inspect();
  const repo = await diagnostic.readerStorage();
  const locator = { ...baseline.locator!, offset: 37, progression: 0.42 };
  const prefs = { theme: 'light' as const, fontSize: 28 };
  await repo.saveLocator(locator); await repo.savePreferences(prefs);
  const content = createLocalContentFiles(deps.files, digest, async () => { throw new Error('Must not materialize bundle for render'); }, deps.uuid);
  const first = await content.render(baseline.chapter!, locator, prefs, deps.uuid(), baseline.reference!);
  expect(deps.files.exists(`${first}/index.html`)).toBe(true);
  await diagnostic.removeRenders();
  const state = await diagnostic.reopen();
  const next = await content.render(state.chapter!, state.locator!, await (await diagnostic.readerStorage()).getPreferences(), deps.uuid(), state.reference!);
  expect(await deps.files.read(`${next}/asset-harbor.png`)).toEqual(await bundled());
  expect(state.chapter).toEqual(baseline.chapter);
  expect(state.locator).toEqual(locator);
  expect(await (await diagnostic.readerStorage()).getPreferences()).toEqual(prefs);
});

test('production staging rejects a truncated destination and cannot overwrite an existing file or update a DB reference', async () => {
  await diagnostic.initialize();
  const baseline = await diagnostic.inspect();
  const faultyFiles = { ...deps.files, write(path: string, bytes: Uint8Array | string) {
    deps.files.write(path, typeof bytes === 'string' ? bytes : bytes.slice(0, 40));
  } };
  const content = createLocalContentFiles(faultyFiles, digest, bundled, deps.uuid);
  await expect(content.stage(null)).rejects.toThrow('PNG');
  expect(await diagnostic.inspect()).toMatchObject({ reference: baseline.reference, chapter: baseline.chapter, image: 'valid', orphans: 1 });
  const fixedId = deps.uuid();
  deps.files.write(`assets/${fixedId}.png`, await bundled());
  const refusesOverwrite = createLocalContentFiles(deps.files, digest, bundled, () => fixedId);
  await expect(refusesOverwrite.stage(null)).rejects.toThrow('overwrite');
  expect(await deps.files.read(`assets/${fixedId}.png`)).toEqual(await bundled());
  const reuse = createLocalContentFiles(deps.files, digest, async () => { throw new Error('Valid reference must not restage'); }, deps.uuid);
  expect(await reuse.stage(`assets/${fixedId}.png`)).toEqual({ relativePath: `assets/${fixedId}.png`, byteLength: 2024 });
});

test('orphan cleanup excludes reference, in-progress file, directories and unrecognized files; render cleanup refuses foreign children', async () => {
  await diagnostic.initialize();
  const reference = (await diagnostic.inspect()).reference!;
  const stage = `assets/${deps.uuid()}.png`;
  const orphan = `assets/${deps.uuid()}.png`;
  deps.files.write(stage, await bundled()); deps.files.write(orphan, await bundled());
  deps.files.write('assets/keep.txt', 'keep');
  deps.files.mkdir(`assets/${deps.uuid()}.png`);
  const assertOwned = () => assertS2AResources(documentRoot, deps.files, deps.databaseName, deps.databaseDirectory);
  expect(removeS2AOrphans(deps.files, reference, new Set([stage]), assertOwned)).toBe(1);
  expect(deps.files.exists(stage)).toBe(true);
  expect(deps.files.exists(reference)).toBe(true);
  expect(deps.files.exists('assets/keep.txt')).toBe(true);
  const foreign = `reader/${deps.uuid()}`;
  deps.files.mkdir(foreign); deps.files.write(`${foreign}/foreign.txt`, 'keep');
  expect(removeS2ARenders(deps.files, assertOwned)).toBe(0);
  expect(deps.files.exists(`${foreign}/foreign.txt`)).toBe(true);
});

test('guard rejects normal DB/path, traversal and mismatched root before open/delete; reset preserves real normal S0 data', async () => {
  const normal = hostSqlite(join(documentRoot, 'stowaway-s0.db')); handles.add(normal);
  await migrate(normal.db);
  const repo = createRepository(normal.db);
  const fixture = await compileFixture(digest);
  await repo.seed(fixture, { relativePath: '', byteLength: 0 });
  const chapter = fixture.chapters[0]!;
  const locator = { chapterId: chapter.id, contentHash: chapter.contentHash, blockId: chapter.blockIds[5]!, offset: 30, progression: 0.2, expandedSpoilers: [] };
  await repo.saveLocator(locator); await repo.savePreferences({ theme: 'light', fontSize: 30 });
  const originalChapter = await repo.getChapter(chapter.id);
  const normalFiles = hostFiles(documentRoot);
  normalFiles.mkdir('assets'); normalFiles.write('assets/normal.png', await bundled());
  normalFiles.mkdir('reader/normal'); normalFiles.write('reader/normal/index.html', 'normal render');
  const unsafeOpen = jest.fn(deps.open); const unsafeDelete = jest.fn(deps.deleteDatabase);
  for (const change of [
    { databaseName: 'stowaway-s0.db' }, { files: normalFiles }, { databaseDirectory: documentRoot },
    { files: { ...deps.files, root: documentRoot + '/stowaway-s2a/../assets' } },
  ]) expect(() => createS2ADiagnostic({ ...deps, open: unsafeOpen, deleteDatabase: unsafeDelete, ...change })).toThrow('exact S2A');
  expect(unsafeOpen).not.toHaveBeenCalled(); expect(unsafeDelete).not.toHaveBeenCalled();
  expect(() => relativeFile('../stowaway-s0.db')).toThrow();
  expect(() => relativeFile('/assets/normal.png')).toThrow();
  await diagnostic.initialize(); await diagnostic.image('corrupt-stage'); await diagnostic.reset();
  expect(await diagnostic.inspect()).toMatchObject({ initialized: false });
  expect(await repo.getChapter(chapter.id)).toEqual(originalChapter);
  expect(await repo.getLocator(chapter.id)).toEqual(locator);
  expect(await repo.getPreferences()).toEqual({ theme: 'light', fontSize: 30 });
  expect(await repo.listChapters()).toHaveLength(3);
  expect(await normalFiles.read('assets/normal.png')).toEqual(await bundled());
  expect(Buffer.from(await normalFiles.read('reader/normal/index.html')).toString()).toBe('normal render');
});
