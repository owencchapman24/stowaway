import { page, tabs, index, row, threadUrl, indexUrl } from './spacebattles';

export const importRootUrl = 'https://forums.spacebattles.com/threads/9001/';
export const storyHeader = '<h1 class="p-title-value">The Synthetic Orchard &amp; Sea</h1><div class="p-description"><a class="username" data-user-id="7">Generated Author</a></div>';
export function bodyArticle(id: string, content = '<p>Original generated passage.</p>') {
  return `<article class="message--post threadmark-category-9" id="js-post-${id}" data-content="post-${id}">
    <div class="message-content"><article class="message-body"><div class="bbWrapper">${content}</div></article></div>
    <aside class="message-signature"><p>Excluded signature.</p></aside></article>`;
}
export function importDocuments(expected = 3) {
  return new Map<string, string>([
    [importRootUrl, page(storyHeader + tabs)],
    [indexUrl, index(row('101', 2) + row('102', 2) + row('103', 3), { expected })],
    [`${threadUrl}page-2`, page(bodyArticle('101') + bodyArticle('102'))],
    [`${threadUrl}page-3`, page(bodyArticle('103'))],
  ]);
}
