import { prepareContent } from '../../content/sanitize';
import { fixtureStory } from '../../fixtures/story';
import type { Chapter, Locator } from '../../domain/types';
import type { SqlDatabase } from '../../storage/database';
import { migrate } from '../../storage/migrations';
import { compileFixture, createRepository, type Repository, type WriteBoundary } from '../../storage/repository';
import { assetPath, createLocalContentFiles } from '../../storage/local-files';
import { UUID, type LocalFiles } from '../../storage/file-primitives';
import { assertS2AResources, removeS2AOrphans, removeS2ARenders } from './isolation';

export interface S2ADependencies {
  documentRoot: string;
  databaseName: string;
  databaseDirectory: string;
  files: LocalFiles;
  databaseExists(): boolean;
  open(): Promise<{ db: SqlDatabase; close(): Promise<void> }>;
  deleteDatabase(): Promise<void>;
  digest(value: string): Promise<string>;
  imageDigest(bytes: Uint8Array): Promise<string>;
  bundled(): Promise<Uint8Array>;
  uuid(): string;
}
export interface S2ASnapshot {
  initialized: boolean;
  revision?: string;
  chapter?: Chapter | null;
  locator?: Locator | null;
  counts?: { stories: number; chapters: number; assets: number };
  image?: string;
  reference?: string | null;
  orphans?: number;
  marker?: string;
}
export function createS2ADiagnostic(deps: S2ADependencies) {
  const { files } = deps;
  const owned = () => assertS2AResources(deps.documentRoot, files, deps.databaseName, deps.databaseDirectory);
  owned();
  const contentFiles = createLocalContentFiles(files, deps.imageDigest, deps.bundled, deps.uuid);
  const staging = new Set<string>();
  let handle: Awaited<ReturnType<S2ADependencies['open']>> | null = null;
  let opening: ReturnType<S2ADependencies['open']> | null = null;
  let repository: Repository | null = null;
  let running = false;
  let release: ((commit: boolean) => void) | null = null;
  const listeners = new Set<(message: string) => void>();
  function status(message: string) { for (const listener of listeners) listener(message); }
  function marker(message: string) { owned(); files.write('checkpoint.txt', message); status(message); }
  async function open() {
    owned();
    opening ??= deps.open().catch((error) => { opening = null; throw error; });
    handle ??= await opening;
    repository ??= createRepository(handle.db);
    return { handle, repository };
  }
  async function existing() {
    if (!deps.databaseExists()) throw new Error('Initialize the disposable S2A fixture first.');
    const result = await open();
    const version = await result.handle.db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    if (version?.user_version !== 1) throw new Error('S2A schema is absent/unsupported; inspect, then explicitly reset. No automatic repair.');
    return result;
  }
  async function fixture() { return compileFixture(deps.digest); }
  async function firstChapter() {
    const chapter = (await fixture()).chapters[0];
    if (!chapter) throw new Error('Missing synthetic S2A chapter.');
    return chapter;
  }
  async function replacement() {
    const chapter = fixtureStory.chapters[0];
    if (!chapter) throw new Error('Missing synthetic source.');
    return prepareContent('<h2>S2A revision B</h2><p>The keeper added a second red lantern beside the original lamp.</p>' + chapter.sourceHtml, deps.digest);
  }
  async function idle<T>(work: () => Promise<T>) {
    owned();
    if (running) throw new Error('S2A operation is active. Finish the checkpoint or force-quit; reset is disabled.');
    running = true;
    try { return await work(); } finally { running = false; }
  }
  async function checkpoint(message: string) {
    try {
      await new Promise<void>((resolve, reject) => {
        release = (commit) => { release = null; if (commit) resolve(); else reject(new Error('Explicit JS rollback at checkpoint.')); };
        marker(message);
      });
    } finally { release = null; }
  }
  const api = {
    get busy() { return running; },
    get checkpointReached() { return release !== null; },
    subscribe(listener: (message: string) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    async inspect(): Promise<S2ASnapshot> {
      owned();
      const savedMarker = files.isDirectory('checkpoint.txt') ? 'Marker path is not a file; retained' :
        files.exists('checkpoint.txt') ? Array.from((await files.read('checkpoint.txt')).slice(0, 200), (byte) => String.fromCharCode(byte)).join('') : 'No prior operation';
      if (!deps.databaseExists()) return { initialized: false, marker: savedMarker };
      const { handle, repository } = await existing(); // No migrate, seed, image repair or cleanup here.
      const first = await firstChapter();
      const chapter = await repository.getChapter(first.id);
      const locator = await repository.getLocator(first.id);
      const reference = await repository.getAssetPath();
      let image = 'not referenced';
      if (reference) {
        try { await contentFiles.image(reference); image = 'valid'; }
        catch { image = files.exists(assetPath(reference)) ? 'corrupt' : 'missing'; }
      }
      const counts = await handle.db.getFirstAsync<{ stories: number; chapters: number; assets: number }>(
        'SELECT (SELECT COUNT(*) FROM stories) AS stories, (SELECT COUNT(*) FROM chapters) AS chapters, (SELECT COUNT(*) FROM assets) AS assets');
      const orphans = files.list('assets').filter((name) => name.endsWith('.png') && UUID.test(name.slice(0, -4)) &&
        `assets/${name}` !== reference && !files.isDirectory(`assets/${name}`)).length;
      return { initialized: true, revision: chapter ? (chapter.html.includes('S2A revision B') ? 'B' : 'A') : 'missing', chapter, locator,
        counts: counts ?? undefined, reference, image, orphans, marker: savedMarker };
    },
    async initialize() {
      return idle(async () => {
        owned();
        if (deps.databaseExists()) throw new Error('S2A DB already exists. Inspect it first; explicit reset is required to restart.');
        files.mkdir('database');
        const { handle, repository } = await open();
        await migrate(handle.db, 1);
        const compiled = await fixture();
        const asset = await contentFiles.stage(null);
        await repository.seed(compiled, asset);
        const chapter = compiled.chapters[0];
        if (!chapter) throw new Error('Missing synthetic S2A chapter.');
        const blockId = chapter.blockIds[Math.min(10, chapter.blockIds.length - 1)];
        if (!blockId) throw new Error('Missing synthetic S2A block.');
        await repository.saveLocator({ chapterId: chapter.id, contentHash: chapter.contentHash,
          blockId, offset: 12,
          progression: 0.3, expandedSpoilers: [] });
        await repository.savePreferences({ theme: 'dark', fontSize: 22 });
        marker('Initialized revision A, synthetic baseline locator and dark/22 preferences');
      });
    },
    async text(mode: 'before-write' | 'after-html-write' | 'commit' | 'checkpoint') {
      return idle(async () => {
        const { repository } = await existing();
        const id = (await firstChapter()).id;
        const content = await replacement();
        marker(`Text ${mode}: started (not proof of commit)`);
        const boundary: WriteBoundary = async (phase) => {
          if (phase === mode) throw new Error(`Injected JS exception: ${phase}`);
          if (mode === 'checkpoint' && phase === 'before-commit') await checkpoint('READY TO FORCE-QUIT BEFORE COMMIT');
        };
        try { await repository.replaceChapterContent(id, content, boundary); }
        catch (error) { marker('Text transaction rejected/rolled back; NOT a process-kill test'); throw error; }
        marker('Text commit completed: revision B');
      });
    },
    finishCheckpoint(commit: boolean) {
      if (!release) throw new Error('No checkpoint reached.');
      release(commit);
    },
    async image(mode: 'corrupt-stage' | 'fail-reference' | 'commit' | 'checkpoint' | 'remove-reference' | 'corrupt-reference') {
      return idle(async () => {
        const { repository } = await existing();
        const old = await repository.getAssetPath();
        if (mode === 'remove-reference' || mode === 'corrupt-reference') {
          if (!old) throw new Error('No referenced S2A image.');
          owned();
          assetPath(old);
          if (files.isDirectory(old)) throw new Error('Refusing to mutate a directory as an image.');
          if (mode === 'remove-reference') { if (files.exists(old)) files.remove(old); }
          else files.write(old, (await deps.bundled()).slice(0, 40));
          marker(`S2A referenced image ${mode}; no automatic repair`);
          return;
        }
        if (mode === 'corrupt-stage') {
          const path = assetPath(`assets/${deps.uuid()}.png`);
          owned();
          if (files.exists(path)) throw new Error('Refusing existing file.');
          files.mkdir('assets');
          files.write(path, (await deps.bundled()).slice(0, 40));
          try { await contentFiles.image(path); }
          catch { marker('Injected partial/corrupt file rejected; DB reference unchanged'); return; }
          throw new Error('Corrupt fixture unexpectedly accepted.');
        }
        marker(`Image ${mode}: staging started`);
        let activePath: string | null = null;
        try {
          const asset = await contentFiles.stage(null, (path) => { activePath = path; staging.add(path); });
          if (mode === 'checkpoint') await checkpoint('READY TO FORCE-QUIT: VALIDATED IMAGE, BEFORE DB REFERENCE');
          await repository.commitAssetReference(asset, async (phase) => {
            if (mode === 'fail-reference' && phase === 'before-commit') throw new Error('Injected asset-reference exception');
          });
        } catch (error) { marker('Image operation failed; inspect reference and staged/orphan files'); throw error; }
        finally { if (activePath) staging.delete(activePath); }
        marker('Image reference commit completed');
      });
    },
    async cleanupOrphans() {
      return idle(async () => {
        const { repository } = await existing();
        const count = removeS2AOrphans(files, await repository.getAssetPath(), staging, owned);
        status(`Removed ${count} eligible S2A orphan files only`);
        return count;
      });
    },
    async removeRenders() { return idle(async () => { const count = removeS2ARenders(files, owned); status(`Removed ${count} disposable S2A render directories`); return count; }); },
    async readerStorage() { if (running) throw new Error('Finish checkpoint before reading.'); return (await existing()).repository; },
    async reopen() {
      return idle(async () => { if (handle) await handle.close(); handle = null; opening = null; repository = null; return api.inspect(); });
    },
    async reset() {
      return idle(async () => {
        owned();
        if (handle) await handle.close();
        handle = null; opening = null; repository = null;
        await deps.deleteDatabase();
        removeS2AOrphans(files, null, staging, owned);
        removeS2ARenders(files, owned);
        if (files.exists('checkpoint.txt') && !files.isDirectory('checkpoint.txt')) files.remove('checkpoint.txt');
        status('Reset only exact S2A DB and recognized S2A files. Initialize explicitly.');
      });
    },
  };
  return api;
}
export type S2ADiagnostic = ReturnType<typeof createS2ADiagnostic>;
