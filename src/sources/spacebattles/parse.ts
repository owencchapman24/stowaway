import { DomUtils, parseDocument } from 'htmlparser2';
import type { ChildNode, Element } from 'domhandler';
import { chapterId } from '../../domain/identity';
import { accessFailure } from './request';
import { documentUrl, postIdFromLink } from './url';
import { S1Failure, type Category, type Document, type Entry, type Sample, type Thread } from './types';
import type { StoryMetadata } from '../../domain/types';

function elements(node: { children?: ChildNode[] }): Element[] {
  const list: Element[] = [];
  for (const child of node.children ?? []) {
    if (child.type === 'tag' || child.type === 'script' || child.type === 'style') {
      list.push(child); list.push(...elements(child));
    }
  }
  return list;
}
function has(node: Element, name: string): boolean { return (node.attribs.class ?? '').split(/\s+/).includes(name); }
function text(node: ChildNode): string {
  if (node.type === 'text') return node.data;
  if ('name' in node && ['script', 'style'].includes(node.name)) return '';
  return 'children' in node ? node.children.map(text).join('') : '';
}
function numeric(value: string | undefined): string | null {
  return value && /^[0-9]+$/.test(value) && !/^0+$/.test(value) ? value.replace(/^0+/, '') : null;
}
function sourceHtml(html: string): string {
  if (html.trimStart().startsWith('{')) {
    try {
      const json: unknown = JSON.parse(html);
      if (json && typeof json === 'object' && 'html' in json) {
        if ('errors' in json || ('status' in json && json.status === 'error')) {
          throw new S1Failure('parser', 'Source range response reports an error.');
        }
        const value = json.html;
        if (typeof value === 'string') return value;
        if (value && typeof value === 'object' && 'content' in value && typeof value.content === 'string') return value.content;
      }
    } catch { /* A malformed source envelope is not content. */ }
    throw new S1Failure('parser', 'Unrecognized source range response envelope.');
  }
  return html;
}
function dom(page: Document, thread: Thread, fragment = false): Element[] {
  const html = sourceHtml(page.html);
  const denied = accessFailure(html);
  if (denied) throw denied;
  const list = elements(parseDocument(html));
  if (!fragment && list.some((n) => /^thread-[0-9]+$/.test(n.attribs['data-content-key'] ?? '') &&
      n.attribs['data-content-key'] !== `thread-${thread.threadId}`)) {
    throw new S1Failure('parser', 'Source document contains conflicting thread identity.');
  }
  if (!fragment && !list.some((n) => n.attribs['data-content-key'] === `thread-${thread.threadId}`)) {
    throw new S1Failure('unsupported-structure', 'Expected selected-thread source identity was not present.');
  }
  return list;
}

function bareIndex(value: string, thread: Thread, base: string): string | null {
  const url = new URL(documentUrl(value, thread.threadId, base));
  return /\/threadmarks\/?$/.test(url.pathname) && !url.search ? url.href : null;
}

export function primaryIndex(page: Document, thread: Thread): string {
  const tabs = dom(page, thread).find((n) => has(n, 'block-tabHeader--threadmarkCategoryTabs'));
  if (!tabs) throw new S1Failure('unsupported-structure', 'No source threadmark category tabs were found.');
  const urls = elements(tabs).filter((n) => n.name === 'a' && n.attribs.href)
    .map((n) => bareIndex(n.attribs.href!, thread, page.url)).filter((url) => url !== null);
  if (urls.length !== 1) throw new S1Failure('unsupported-structure', 'Primary category is not uniquely identified by the default index link.');
  return urls[0]!;
}

export interface Range { kind: 'range'; url: string }
export interface IndexPage {
  category: Category; items: (Entry | Range)[]; next: string | null; lastPage: number;
}

function rowItems(scope: Element[], page: Document, thread: Thread, categoryId: string): (Entry | Range)[] {
  const rows = scope.filter((n) => has(n, 'structItem--threadmark'));
  if (!rows.length) throw new S1Failure('parser', 'No threadmark rows in the expected source container.');
  return rows.map((row) => {
    const descendants = elements(row);
    if (has(row, 'structItem--threadmark-filler')) {
      const fetcher = descendants.find((n) => n.attribs['data-xf-click'] === 'threadmark-fetcher');
      const value = fetcher?.attribs['data-fetchurl'];
      if (!value) throw new S1Failure('incomplete', 'Range placeholder has no observed continuation URL.');
      const url = documentUrl(value, thread.threadId, page.url);
      const parsed = new URL(url);
      if (!/\/threadmarks-load-range\/?$/.test(parsed.pathname) ||
          parsed.searchParams.get('threadmark_category_id') !== categoryId ||
          !parsed.searchParams.has('min') || !parsed.searchParams.has('max')) {
        throw new S1Failure('unsupported-structure', 'Range continuation is not scoped to the primary category.');
      }
      return { kind: 'range', url };
    }
    const title = descendants.find((n) => has(n, 'structItem-title'));
    const anchor = title && elements(title).find((n) => n.name === 'a' && postIdFromLink(n.attribs.href ?? '', page.url));
    const postId = anchor && postIdFromLink(anchor.attribs.href!, page.url);
    if (!anchor || !postId) throw new S1Failure('parser', 'A primary row is missing its numeric post link.');
    const url = new URL(anchor.attribs.href!, page.url);
    documentUrl(url.href, thread.threadId);
    return {
      postId, chapterId: chapterId(thread.storyId, postId),
      threadmarkId: numeric(row.attribs['data-threadmark-id']) ?? numeric(row.attribs.id?.replace(/^threadmark-/, '')),
      title: text(anchor).replace(/\s+/g, ' ').trim().slice(0, 300), url: url.href,
    };
  });
}

export function parseIndex(page: Document, thread: Thread, previous?: Category): IndexPage {
  const list = dom(page, thread);
  primaryIndex(page, thread);
  const tabs = list.find((n) => has(n, 'block-tabHeader--threadmarkCategoryTabs'))!;
  const activeTabs = elements(tabs).filter((n) => n.name === 'a' && has(n, 'is-active'));
  if (activeTabs.length !== 1 || !activeTabs[0]!.attribs.href ||
      !bareIndex(activeTabs[0]!.attribs.href!, thread, page.url)) {
    throw new S1Failure('unsupported-structure', 'The active index tab is not the source default primary category.');
  }
  const pane = list.find((n) => n.name === 'li' && has(n, 'is-active') &&
    /^threadmark-category-[0-9]+$/.test(n.attribs['aria-labelledby'] ?? ''));
  const categoryId = numeric(pane?.attribs['aria-labelledby']?.replace('threadmark-category-', ''));
  const body = list.find((n) => has(n, 'block-body--threadmarkBody') && has(n, 'is-active'));
  if (!body || !categoryId || !has(body, `category-${categoryId}`) || (previous && previous.id !== categoryId)) {
    throw new S1Failure('unsupported-structure', 'Primary category pane/body identity is missing or changed.');
  }
  const queryCategory = new URL(page.url).searchParams.get('threadmark_category');
  if (queryCategory && queryCategory !== categoryId) throw new S1Failure('incomplete', 'Source switched threadmark categories.');
  // Global header "Threadmarks" may combine categories. Only category-scoped counts are evidence.
  const rawExpected = body.attribs['data-threadmark-count'] ?? pane?.attribs['data-threadmark-count'];
  const expected = rawExpected && /^[0-9]+$/.test(rawExpected) ? Number(rawExpected) : null;
  if (expected !== null && (!Number.isSafeInteger(expected) || expected > 10000)) throw new S1Failure('incomplete', 'Source count exceeds the spike budget.');
  if (previous?.expected !== null && previous?.expected !== undefined && expected !== null && expected !== previous.expected) {
    throw new S1Failure('incomplete', 'Primary count changed during traversal.');
  }
  const category: Category = { id: categoryId, url: previous?.url ?? primaryIndex(page, thread), expected: previous?.expected ?? expected };
  const navs = list.filter((n) => has(n, 'threadmarks-pagenav--wrapper') && has(n, `category-${categoryId}`));
  const links = navs.flatMap(elements).filter((n) => n.name === 'a' && n.attribs.href);
  const nextLinks = [...new Set(links.filter((n) => has(n, 'pageNav-jump--next') || has(n, 'pageNavSimple-el--next'))
    .map((n) => documentUrl(n.attribs.href!, thread.threadId, page.url)))];
  if (nextLinks.length > 1) throw new S1Failure('incomplete', 'Source next-page controls disagree.');
  const current = Number(new URL(page.url).searchParams.get('page') ?? 1);
  let lastPage = current;
  for (const n of links) {
    const target = new URL(documentUrl(n.attribs.href!, thread.threadId, page.url));
    if (!/\/threadmarks\/?$/.test(target.pathname) || (target.searchParams.get('threadmark_category') ?? categoryId) !== categoryId) {
      throw new S1Failure('incomplete', 'Primary pagination leaves its source category.');
    }
    lastPage = Math.max(lastPage, Number(target.searchParams.get('page') ?? 1));
  }
  const next = nextLinks[0] ?? null;
  if ((next && Number(new URL(next).searchParams.get('page')) !== current + 1) || (!next && lastPage > current)) {
    throw new S1Failure('incomplete', 'Primary pagination is missing a coherent next page.');
  }
  return { category, items: rowItems(elements(body), page, thread, categoryId), next, lastPage };
}

export function parseRange(page: Document, thread: Thread, categoryId: string): (Entry | Range)[] {
  const list = dom(page, thread, true);
  if (list.some((n) => has(n, 'block-body--threadmarkBody') && !has(n, `category-${categoryId}`))) {
    throw new S1Failure('incomplete', 'Range response switched threadmark categories.');
  }
  return rowItems(list, page, thread, categoryId);
}

function selectedBody(page: Document, thread: Thread, entry: Entry, categoryId: string, requireCategory = false): Element {
  if (entry.chapterId !== chapterId(thread.storyId, entry.postId)) throw new S1Failure('parser', 'Chapter identity does not match the selected story/post.');
  const posts = dom(page, thread).filter((n) => n.name === 'article' && has(n, 'message--post') &&
    (n.attribs.id === `js-post-${entry.postId}` || n.attribs['data-content'] === `post-${entry.postId}`));
  const post = posts[0];
  const categories = (post?.attribs.class ?? '').split(/\s+/).filter((c) => /^threadmark-category-[0-9]+$/.test(c));
  if (posts.length !== 1 || !post ||
      (post.attribs.id && post.attribs.id !== `js-post-${entry.postId}`) ||
      (post.attribs['data-content'] && post.attribs['data-content'] !== `post-${entry.postId}`) ||
      (requireCategory && !categories.length) || categories.some((c) => c !== `threadmark-category-${categoryId}`)) {
    throw new S1Failure('parser', 'Representative numeric post/category did not match the manifest entry.');
  }
  const bodies = elements(post).filter((n) => has(n, 'message-body'));
  const wrappers = bodies.length === 1 ? elements(bodies[0]!).filter((n) => has(n, 'bbWrapper')) : [];
  const prose = wrappers[0];
  if (wrappers.length !== 1 || !prose || !text(prose).trim()) throw new S1Failure('parser', 'Representative post has no unambiguous readable body.');
  return prose;
}

export function samplePost(page: Document, thread: Thread, entry: Entry, categoryId: string): Sample {
  const prose = selectedBody(page, thread, entry, categoryId, true);
  const tags = ['p', 'h1', 'h2', 'h3', 'em', 'strong', 'b', 'i', 'blockquote', 'ul', 'ol', 'li', 'table', 'img'];
  return { postId: entry.postId, bodyCharacters: text(prose).length,
    formattingTags: [...new Set(elements(prose).map((n) => n.name).filter((n) => tags.includes(n)))] };
}

export function parseStoryMetadata(page: Document, thread: Thread): Omit<StoryMetadata, 'categoryId'> {
  const list = dom(page, thread);
  const titles = list.filter((n) => n.name === 'h1' && has(n, 'p-title-value'));
  const title = titles.length === 1 ? text(titles[0]!).replace(/\s+/g, ' ').trim().slice(0, 500) : '';
  if (!title) throw new S1Failure('parser', 'Selected thread has no unambiguous story title.');
  const description = list.filter((n) => has(n, 'p-description'));
  const authors = description.flatMap(elements).filter((n) => n.name === 'a' && has(n, 'username'));
  const author = authors.length === 1 ? text(authors[0]!).replace(/\s+/g, ' ').trim().slice(0, 200) || null : null;
  return { id: thread.storyId, source: 'spacebattles', threadId: thread.threadId, title, author, sourceUrl: thread.url };
}

/** Transient extraction only. The caller must sanitize before persisting. */
export function extractPostBody(page: Document, thread: Thread, entry: Entry, categoryId: string): string {
  const prose = selectedBody(page, thread, entry, categoryId);
  for (const node of elements(prose)) {
    if (node.name === 'img') node.attribs.src = ''; // Even a source-supplied fixture URL is not a bundled asset.
    if (node.name === 'a' && node.attribs.href) {
      try { node.attribs.href = new URL(node.attribs.href, page.url).href; } catch { delete node.attribs.href; }
    }
    if (has(node, 'bbCodeSpoiler')) {
      const inner = elements(node).find((n) => has(n, 'bbCodeSpoiler-content-inner'));
      if (inner) {
        node.name = 'details';
        node.children = [...parseDocument('<summary>Spoiler</summary>').children, ...inner.children];
      }
    }
  }
  // XenForo's direct text/BR runs need paragraph-sized locator blocks. Preserve
  // existing block markup; normalize only inline runs, before the sanitizer.
  const blockTags = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'blockquote',
    'table', 'pre', 'details', 'hr', 'img', 'figure']);
  let html = '';
  let run: ChildNode[] = [];
  function flush() {
    if (run.some((node) => text(node).trim())) html += `<p>${run.map((node) => DomUtils.getOuterHTML(node)).join('')}</p>`;
    run = [];
  }
  for (const node of prose.children) {
    if (node.type === 'tag' && (blockTags.has(node.name) || node.name === 'br')) {
      flush();
      if (node.name !== 'br') html += DomUtils.getOuterHTML(node);
    } else run.push(node);
  }
  flush();
  return `<div>${html}</div>`;
}
