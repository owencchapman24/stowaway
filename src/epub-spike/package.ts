import type { XmlElement } from '@rgrove/parse-xml';
import { validateSourceImage, SOURCE_IMAGE_LIMITS, ImageRejected } from '../images/validate';
import { utf8, decodeUtf8 } from './bytes';
import { canonicalChapter } from './canonical';
import { EpubFailure, LIMITS, requireEpub, checkpoint, measureSync, type Context } from './limits';
import { hashImage } from './hash';
import { archivePath, resolveReference } from './paths';
import { children, descendants, elements, nameOf, namespacedAttribute, NS, strictXml } from './xml';
import { indexZip, packageHash, readMember, type Member, type Seekable } from './zip';

interface Item { id: string; path: string; media: string; properties: string[]; }
export interface ImageResult { blockId: string; state: 'accepted' | 'omitted'; reason: string | null; format?: string; width?: number; height?: number; }
export interface ChapterSummary { ordinal: number; role: 'primary' | 'auxiliary'; title: string; bytes: number; images: ImageResult[]; }
export interface PackageResult {
  version: string; metadata: { title: string; creators: string[]; language: string; identifier: string; description: string; rights: string };
  chapters: ChapterSummary[]; canonicalBytes: number; acceptedImages: number; acceptedImageBytes: number;
  packageHash: string; navigationLabels: number; warnings: string[];
}
export interface ProcessOptions { onChapter?: (chapter: Awaited<ReturnType<typeof canonicalChapter>>, summary: ChapterSummary) => void; }
/** Only core validation failures may satisfy a corpus rejection expectation. */
export class ProcessingFailure extends EpubFailure {
  constructor(readonly origin: 'validation' | 'read' | 'assertion' | 'unexpected' | 'cancelled' | 'cleanup', code: EpubFailure['code']) { super(code); }
}
const plain = (s: string, cap: number) => s.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, cap);
function exactlyOne(parent: XmlElement, uri: string, tag: string) {
  const found = children(parent, uri, tag); requireEpub(found.length === 1, 'package'); return found[0]!;
}

/** Owns/always closes the supplied handle. Never imports persistence or networking. */
export async function processEpub(input: Seekable, ctx: Context, options: ProcessOptions = {}): Promise<PackageResult> {
  // Adapter exceptions (even EpubFailure instances) are not EPUB validation.
  const file: Seekable = {
    get size() {
      try {
        const size = input.size;
        if (!Number.isSafeInteger(size) || size < 0) throw new ProcessingFailure('read', 'io');
        return size;
      } catch { throw new ProcessingFailure('read', 'io'); }
    },
    async read(at, length) {
      try {
        const bytes = await input.read(at, length);
        if (!(bytes instanceof Uint8Array) || bytes.length !== length) throw new ProcessingFailure('read', 'io');
        return bytes;
      } catch { throw new ProcessingFailure('read', 'io'); }
    },
    close() { input.close(); },
  };
  try {
    const zip = await indexZip(file, ctx);
    const required = (path: string): Member => { const m = zip.get(path); requireEpub(m && !m.directory, 'package'); return m; };
    const readXml = async (path: string, cap: number) => {
      await checkpoint(ctx, 'resource', true);
      return strictXml(await readMember(file, required(path), cap, ctx), ctx);
    };
    const mime = required('mimetype');
    requireEpub(mime.local === 0 && mime.method === 0 && !(mime.flags & 8) && mime.data === 38 && mime.size === 20, 'package');
    requireEpub(decodeUtf8(await readMember(file, mime, 20, ctx)) === 'application/epub+zip', 'package');
    const container = await readXml('META-INF/container.xml', LIMITS.smallXml);
    requireEpub(nameOf(container).uri === NS.container && nameOf(container).local === 'container', 'package');
    const roots = children(exactlyOne(container, NS.container, 'rootfiles'), NS.container, 'rootfile');
    requireEpub(roots.length === 1 && roots[0]!.attributes['media-type'] === 'application/oebps-package+xml', 'unsupported');
    const opfPath = archivePath(roots[0]!.attributes['full-path'] ?? '');
    const opf = await readXml(opfPath, LIMITS.xml);
    requireEpub(nameOf(opf).uri === NS.opf && nameOf(opf).local === 'package', 'package');
    const version = opf.attributes.version ?? ''; requireEpub(version === '2.0' || version === '3.0', 'unsupported');
    const metadataNode = exactlyOne(opf, NS.opf, 'metadata');
    for (const m of children(metadataNode, NS.opf, 'meta')) {
      requireEpub(!(m.attributes.property === 'rendition:layout' && m.text.trim() !== 'reflowable'), 'unsupported');
      requireEpub(!(m.attributes.name === 'fixed-layout' && m.attributes.content !== 'false'), 'unsupported');
    }
    const texts = (name: string, cap: number) => children(metadataNode, NS.dc, name).map((e) => plain(e.text, cap));
    const metadata = { title: texts('title', 512)[0] ?? '', creators: texts('creator', 512), language: texts('language', 64)[0] ?? '',
      identifier: texts('identifier', 8192)[0] ?? '', description: texts('description', 8192)[0] ?? '', rights: texts('rights', 8192)[0] ?? '' };
    requireEpub(!!metadata.title && !!metadata.language, 'package');
    const uniqueIdentifier = opf.attributes['unique-identifier'];
    const identifiers = children(metadataNode, NS.dc, 'identifier').filter((n) => n.attributes.id === uniqueIdentifier);
    requireEpub(uniqueIdentifier && identifiers.length === 1, 'package');
    metadata.identifier = plain(identifiers[0]!.text, 8192);
    requireEpub(!!metadata.identifier, 'package');
    requireEpub(utf8(JSON.stringify(metadata)).length <= LIMITS.metadata, 'budget');
    const items = new Map<string, Item>(), byPath = new Map<string, Item>();
    for (const e of children(exactlyOne(opf, NS.opf, 'manifest'), NS.opf, 'item')) {
      const id = e.attributes.id ?? '', href = e.attributes.href ?? '', media = e.attributes['media-type'] ?? '';
      requireEpub(id && !items.has(id) && !href.includes('#') && media, 'package');
      const path = resolveReference(opfPath, href), properties = (e.attributes.properties ?? '').split(/\s+/).filter(Boolean);
      requireEpub(!properties.includes('scripted') && !e.attributes['media-overlay'], 'unsupported');
      requireEpub(!byPath.has(path), 'package');
      const item = { id, path, media, properties }; items.set(id, item); byPath.set(path, item);
    }
    const spine = exactlyOne(opf, NS.opf, 'spine'), refs = children(spine, NS.opf, 'itemref');
    requireEpub(refs.length > 0 && refs.length <= LIMITS.spine, 'budget');
    const spinePaths = new Set<string>();
    const plan = refs.map((e) => {
      const item = items.get(e.attributes.idref ?? ''); requireEpub(item && item.media === 'application/xhtml+xml', 'unsupported');
      requireEpub(!spinePaths.has(item.path), 'package'); spinePaths.add(item.path); required(item.path);
      requireEpub(!e.attributes.properties?.includes('rendition:layout-pre-paginated'), 'unsupported');
      requireEpub(!e.attributes.linear || e.attributes.linear === 'yes' || e.attributes.linear === 'no', 'package');
      return { item, role: e.attributes.linear === 'no' ? 'auxiliary' as const : 'primary' as const };
    });
    if (zip.has('META-INF/encryption.xml')) {
      const encryption = await readXml('META-INF/encryption.xml', LIMITS.smallXml);
      requireEpub(nameOf(encryption).local === 'encryption' && nameOf(encryption).uri === NS.container && !Object.keys(encryption.attributes).some((a) => a !== 'xmlns'), 'encryption');
      const encNS = 'http://www.w3.org/2001/04/xmlenc#', seen = new Set<string>();
      for (const data of elements(encryption)) {
        requireEpub(nameOf(data).uri === encNS && nameOf(data).local === 'EncryptedData', 'encryption');
        const method = children(data, encNS, 'EncryptionMethod'), cipher = children(data, encNS, 'CipherData');
        requireEpub(elements(data).length === 2 && method.length === 1 && cipher.length === 1, 'encryption');
        requireEpub(method[0]!.attributes.Algorithm === 'http://www.idpf.org/2008/embedding' && !elements(method[0]!).length, 'encryption');
        const references = children(cipher[0]!, encNS, 'CipherReference');
        requireEpub(elements(cipher[0]!).length === 1 && references.length === 1 && !elements(references[0]!).length, 'encryption');
        for (const node of [data, method[0]!, cipher[0]!, references[0]!]) {
          requireEpub(Object.keys(node.attributes).every((key) => key === 'xmlns' || key.startsWith('xmlns:') ||
            (node === method[0] && key === 'Algorithm') || (node === references[0] && key === 'URI')), 'encryption');
          requireEpub(!node.children.some((c) => c.type === 'text' && (c as {text: string}).text.trim()), 'encryption');
        }
        const path = resolveReference('', references[0]!.attributes.URI ?? ''), item = byPath.get(path);
        requireEpub(item && ['font/otf','font/ttf','application/vnd.ms-opentype','application/font-sfnt','application/font-woff','font/woff'].includes(item.media) && !spinePaths.has(path) && !item.properties.includes('cover-image') && !seen.has(path) && zip.has(path), 'encryption');
        seen.add(path);
      }
    }
    const labels = new Map<string, string>();
    const navs = [...items.values()].filter((i) => i.properties.includes('nav'));
    requireEpub(navs.length <= 1 && (version !== '3.0' || navs.length === 1), 'package');
    if (navs.length) {
      requireEpub(navs[0]!.media === 'application/xhtml+xml', 'unsupported');
      const nav = await readXml(navs[0]!.path, LIMITS.xml);
      requireEpub(nameOf(nav).uri === NS.xhtml && nameOf(nav).local === 'html', 'package');
      const tocs = descendants(nav).filter((n) => nameOf(n).uri === NS.xhtml && nameOf(n).local === 'nav' && namespacedAttribute(n, 'http://www.idpf.org/2007/ops', 'type')?.split(/\s+/).includes('toc'));
      requireEpub(tocs.length === 1, 'package');
      for (const a of descendants(tocs[0]!).filter((n) => nameOf(n).uri === NS.xhtml && nameOf(n).local === 'a')) {
        const path = resolveReference(navs[0]!.path, a.attributes.href ?? '');
        if (!labels.has(path)) labels.set(path, plain(a.text, 512));
      }
    } else {
      const ncx = items.get(spine.attributes.toc ?? ''); requireEpub(ncx && ncx.media === 'application/x-dtbncx+xml', 'package');
      const root = await readXml(ncx.path, LIMITS.xml); requireEpub(nameOf(root).uri === NS.ncx && nameOf(root).local === 'ncx', 'package');
      for (const point of descendants(root).filter((n) => nameOf(n).uri === NS.ncx && nameOf(n).local === 'navPoint')) {
        const label = exactlyOne(point, NS.ncx, 'navLabel'), content = exactlyOne(point, NS.ncx, 'content');
        const path = resolveReference(ncx.path, content.attributes.src ?? ''); if (!labels.has(path)) labels.set(path, plain(label.text, 512));
      }
    }
    const result: PackageResult = { version, metadata, chapters: [], canonicalBytes: 0, acceptedImages: 0, acceptedImageBytes: 0,
      packageHash: '', navigationLabels: labels.size, warnings: ['internal-links-inert', 'source-styles-discarded', 'unread-members-not-crc-verified'] };
    type Inspected = Omit<ImageResult, 'blockId'>;
    const imageCache = new Map<string, Inspected>(), digests = new Set<string>();
    async function inspectImage(path: string): Promise<Inspected> {
      const cached = imageCache.get(path); if (cached) return cached;
      const member = zip.get(path), item = byPath.get(path);
      let image: Inspected = { state: 'omitted', reason: 'missing-or-unsupported-image' };
      if (member && !member.directory && item && ['image/png','image/jpeg','image/webp'].includes(item.media)) {
        if (member.size > SOURCE_IMAGE_LIMITS.maxBytes) image.reason = 'over-byte-budget';
        else {
          await checkpoint(ctx, 'resource');
          const bytes = await readMember(file, member, SOURCE_IMAGE_LIMITS.maxBytes, ctx); // Integrity failures are fatal.
          try {
            const validated = measureSync(ctx, 'imageValidate', () => validateSourceImage(bytes, item.media));
            await checkpoint(ctx, 'resource', true);
            const digest = await hashImage(bytes, ctx);
            if (!digests.has(digest) && (result.acceptedImages >= LIMITS.images || result.acceptedImageBytes + bytes.length > LIMITS.imageBytes)) image.reason = 'image-total-budget';
            else {
              if (!digests.has(digest)) { digests.add(digest); result.acceptedImages++; result.acceptedImageBytes += bytes.length; }
              image = { state: 'accepted', reason: null, format: validated.format, width: validated.width, height: validated.height };
            }
          } catch (error) { if (!(error instanceof ImageRejected)) throw error; image.reason = error.reason; }
        }
      }
      imageCache.set(path, image); return image;
    }
    for (const [ordinal, entry] of plan.entries()) {
      await checkpoint(ctx, 'chapter', true);
      const root = await readXml(entry.item.path, LIMITS.xhtml), chapter = await canonicalChapter(root, ctx);
      // Count all serialized canonical fields, not just visible HTML.
      await checkpoint(ctx, 'chapter', true);
      const bytes = measureSync(ctx, 'outputAssembly', () => utf8(JSON.stringify({ html: chapter.html, blockIds: chapter.blockIds, links: chapter.links, sanitizerVersion: chapter.sanitizerVersion, contentHash: chapter.contentHash })).length);
      result.canonicalBytes += bytes; requireEpub(result.canonicalBytes <= LIMITS.canonical, 'budget');
      const heading = descendants(root).find((n) => nameOf(n).uri === NS.xhtml && /^h[1-6]$/.test(nameOf(n).local));
      const title = labels.get(entry.item.path) || plain(heading?.text ?? '', 512) || plain(children(children(root, NS.xhtml, 'head')[0] ?? root, NS.xhtml, 'title')[0]?.text ?? '', 512) || `Section ${ordinal + 1}`;
      const summary: ChapterSummary = { ordinal, role: entry.role, title, bytes, images: [] }; let instances = 0, pixels = 0;
      for (const reference of chapter.images) {
        await checkpoint(ctx, 'resource'); let image: Inspected;
        if (instances >= LIMITS.chapterImages) image = { state: 'omitted', reason: 'chapter-image-budget' };
        else {
          let path: string | null = null;
          try { path = resolveReference(entry.item.path, reference.reference); }
          catch (error) { if (!(error instanceof EpubFailure) || error.code !== 'path') throw error; }
          image = path ? { ...await inspectImage(path) } : { state: 'omitted', reason: 'nonlocal-or-unsafe-reference' };
          if (image.state === 'accepted') {
            const area = image.width! * image.height!;
            if (pixels + area > LIMITS.chapterPixels) image = { state: 'omitted', reason: 'chapter-pixel-budget' };
            else { pixels += area; instances++; }
          }
        }
        summary.images.push({ blockId: reference.blockId, ...image });
      }
      await checkpoint(ctx, 'chapter', true);
      try { measureSync(ctx, 'expectations', () => options.onChapter?.(chapter, summary)); }
      catch { throw new ProcessingFailure('assertion', 'assertion'); }
      result.chapters.push(summary);
    }
    result.packageHash = await packageHash(file, ctx); return result;
  } catch (error) {
    if (error instanceof ProcessingFailure) throw error;
    if (error instanceof EpubFailure) {
      const origin = error.code === 'cancelled' ? 'cancelled' :
        ['io', 'policy', 'assertion'].includes(error.code) ? 'unexpected' : 'validation';
      throw new ProcessingFailure(origin, error.code);
    }
    throw new ProcessingFailure('unexpected', 'io');
  } finally {
    const started = performance.now();
    try { measureSync(ctx, 'cleanup', () => input.close()); }
    catch { throw new ProcessingFailure('cleanup', 'io'); }
    finally { ctx.timings.cleanup += performance.now() - started; }
  }
}
