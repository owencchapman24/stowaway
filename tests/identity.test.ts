import { chapterId, storyId } from '../src/domain/identity';

test('story and chapter identity use canonical numeric strings, not labels or order', () => {
  const story = storyId('fixture', '001001');
  expect(story).toBe('fixture:thread:1001');
  expect(chapterId(story, '0002001')).toBe(chapterId(story, '2001'));
  expect(chapterId(story, '2002')).not.toBe(chapterId(story, '2001'));
  expect(chapterId(storyId('fixture', '1002'), '2001')).not.toBe(chapterId(story, '2001'));
  expect(storyId('fixture', '90071992547409931234')).toContain('90071992547409931234');
});

test.each(['0', '000', '-1', '1.5', 'post:1', ' 1', ''])('rejects invalid ID %p', (id) => {
  expect(() => storyId('fixture', id)).toThrow();
});
