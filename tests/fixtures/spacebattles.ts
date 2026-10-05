// Entirely generated source-like markup. No live page captures, prose or real source IDs.
export const threadUrl = 'https://forums.spacebattles.com/threads/synthetic.9001/';
export const indexUrl = `${threadUrl}threadmarks`;
export const rangeUrl = `${threadUrl}threadmarks-load-range?threadmark_category_id=9&min=1&max=8`;
export const tabs = `<div class="block-tabHeader--threadmarkCategoryTabs">
  <a class="tabs-tab is-active" href="${indexUrl}">Renamed primary label</a>
  <a class="tabs-tab" href="${indexUrl}?threadmark_category=42">Excluded category</a></div>`;
export function page(content: string): string {
  return `<html data-content-key="thread-9001"><head><title>Synthetic structural fixture</title></head><body>${content}</body></html>`;
}
export function row(id: string, pageNumber?: number): string {
  const url = `${threadUrl}${pageNumber ? `page-${pageNumber}` : ''}#post-${id}`;
  return `<div class="structItem structItem--threadmark" data-threadmark-id="${id}">
    <div class="structItem-title"><ul><li><a href="${url}">Original synthetic entry ${id}</a></li></ul></div></div>`;
}
export function range(url = rangeUrl): string {
  return `<div class="structItem structItem--threadmark structItem--threadmark-filler">
    <div data-xf-click="threadmark-fetcher" data-fetchurl="${url.replace(/&/g, '&amp;')}"></div></div>`;
}
export function index(rows: string, options: { expected?: number; next?: string; last?: string; category?: string } = {}): string {
  const id = options.category ?? '9';
  return page(`${tabs}<div class="threadmarkListingHeader-stats">Threadmarks 9999</div>
    <ul class="js-threadmarkTabPanes"><li class="is-active" aria-labelledby="threadmark-category-${id}">
    <div class="block-body--threadmarkBody category-${id} is-active" ${options.expected === undefined ? '' : `data-threadmark-count="${options.expected}"`}>${rows}</div>
    </li></ul><div class="threadmarks-pagenav--wrapper category-${id}">
    ${options.next ? `<a class="pageNav-jump--next" href="${options.next.replace(/&/g, '&amp;')}">Next</a>` : ''}
    ${options.last ? `<a class="pageNavSimple-el--last" href="${options.last.replace(/&/g, '&amp;')}">Last</a>` : ''}</div>`);
}
export function post(id: string): string {
  return page(`${tabs}<article class="message--post threadmark-category-9" id="js-post-${id}">
    <article class="message-body"><div class="bbWrapper"><p>Entirely original synthetic sample.</p>
    <blockquote>A generated quote.</blockquote><b>Bold.</b></div></article></article>`);
}
