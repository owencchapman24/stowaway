import type { UpdateResult } from './import-story';

export function describeUpdate(result: Omit<UpdateResult, 'failure'> & { failure: unknown }): string {
  const changes = result.reconciliation;
  if (!changes) return 'Previous primary contents kept; no complete update committed.';
  const parts: string[] = [];
  if (changes.added) parts.push(`${changes.added} new ${changes.added === 1 ? 'chapter' : 'chapters'} listed`);
  if (changes.reactivated) parts.push(`${changes.reactivated} ${changes.reactivated === 1 ? 'chapter' : 'chapters'} listed again`);
  if (changes.renamed || changes.orderChanged) parts.push('Source order/titles updated');
  if (changes.metadataChanged) parts.push('Story metadata updated');
  if (changes.removed) parts.push('Removed entries retained; downloaded text remains saved');
  if (result.bodiesDownloaded) parts.push(`${result.bodiesDownloaded} ${result.bodiesDownloaded === 1 ? 'chapter' : 'chapters'} downloaded`);
  const pending = result.story ? result.story.total - result.story.downloaded : null;
  if (pending) parts.push(`Contents checked; ${pending} ${pending === 1 ? 'chapter' : 'chapters'} pending`);
  if (!parts.length) return result.failure ? 'Contents checked; committed text retained.' : 'Up to date.';
  return `${parts.join('. ')}.`;
}
