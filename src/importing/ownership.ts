export class ImportFailure extends Error {
  constructor(readonly code: 'storage' | 'busy', message: string) { super(message); this.name = 'ImportFailure'; }
}
// Across screens and repository handles, released only after all commits settle.
const activeStories = new Set<string>();
export function acquireStory(id: string): () => void {
  if (activeStories.has(id)) throw new ImportFailure('busy', 'This story already has an import, update or image download running.');
  activeStories.add(id);
  return () => { activeStories.delete(id); };
}
