import { threadFromUrl, documentUrl, postIdFromLink } from '../src/sources/spacebattles/url';
import { chapterId } from '../src/domain/identity';
import { threadUrl } from './fixtures/spacebattles';

test.each([threadUrl, threadUrl.slice(0, -1), 'https://forums.spacebattles.com/threads/9001', `${threadUrl}page-37?x=1#post-99`, 'https://forums.spacebattles.com/threads/renamed.0009001/?q=one',
  'https://forums.spacebattles.com/threads/9001/'])('normalizes thread identity independent of slug/query/page/fragment: %s', (url) => {
  expect(threadFromUrl(url)).toEqual({ threadId: '9001', storyId: 'spacebattles:thread:9001', url: 'https://forums.spacebattles.com/threads/9001/' });
});
test.each(['http://forums.spacebattles.com/threads/9001/', 'https://forums.spacebattles.com.evil.test/threads/9001/',
  'https://evil.test/threads/9001/', 'https://forums.spacebattles.com/posts/91/', 'not a URL',
  'https://forums.spacebattles.com/threads/0/', 'https://user@forums.spacebattles.com/threads/9001/',
  'https://forums.spacebattles.com/search/', 'https://forums.spacebattles.com/threads/9001/threadmarks'])('rejects unsupported story input: %s', (url) => {
  expect(() => threadFromUrl(url)).toThrow();
});
test.each(['/login/', '/account/', '/attachments/91/', '/search/', '/cdn-cgi/', '/goto/post?id=91', '/admin.php',
  '/whats-new/', '/threads/9002/', '/threads/9001/threadmarks.rss', '//evil.test/threads/9001/',
  '/threads/9001/threadmarks?redirect=1', '/threads/9001/threadmarks-load-range?recent_only=1'])('request allowlist rejects sensitive/unrelated paths: %s', (url) => {
  expect(() => documentUrl(url, '9001')).toThrow();
});
test('large string IDs and observed post references retain stable identity', () => {
  const thread = threadFromUrl('https://forums.spacebattles.com/threads/new.90071992547409931234/');
  expect(thread.threadId).toBe('90071992547409931234');
  const id = postIdFromLink(`${threadUrl}page-37#post-00091`, threadUrl)!;
  expect(id).toBe('91');
  expect(chapterId(thread.storyId, id)).toBe('spacebattles:thread:90071992547409931234:post:91');
  expect(postIdFromLink('/posts/92/', threadUrl)).toBe('92');
});
