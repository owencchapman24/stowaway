export class ImportFailure extends Error {
  constructor(readonly code: 'storage' | 'busy', message: string) { super(message); this.name = 'ImportFailure'; }
}
// Across screens and repository handles, released only after all commits settle.
const activeStories = new Set<string>();
const localWrites = new Map<string, number>();
const listeners = new Set<() => void>();
export function isStoryBusy(id: string) { return activeStories.has(id) || localWrites.has(id); }
export function subscribeStoryOperations(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
function changed() { listeners.forEach((listener) => listener()); }
export function acquireStory(id: string): () => void {
  if (isStoryBusy(id)) throw new ImportFailure('busy', 'This story already has an import, update, image, read-state or library operation running.');
  activeStories.add(id);
  changed();
  let released = false;
  return () => { if (!released) { released = true; activeStories.delete(id); changed(); } };
}

/** Local reader writes may queue together, but cannot overlap a source/management owner. */
export async function withLocalStoryWrite<T>(id: string, work: () => Promise<T>): Promise<T> {
  if (activeStories.has(id)) throw new ImportFailure('busy', 'This story has another operation running. Please retry after it finishes.');
  localWrites.set(id, (localWrites.get(id) ?? 0) + 1);
  changed();
  try { return await work(); }
  finally {
    const remaining = localWrites.get(id)! - 1;
    if (remaining) localWrites.set(id, remaining); else localWrites.delete(id);
    changed();
  }
}
