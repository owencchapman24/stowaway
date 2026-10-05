export function storyId(source: 'fixture' | 'spacebattles', threadId: string): string {
  return `${source}:thread:${numericId(threadId)}`;
}

export function chapterId(story: string, postId: string): string {
  return `${story}:post:${numericId(postId)}`;
}

function numericId(value: string): string {
  if (!/^[0-9]+$/.test(value) || /^0+$/.test(value)) {
    throw new Error('Source IDs must be positive numeric strings.');
  }
  return value.replace(/^0+/, '');
}
