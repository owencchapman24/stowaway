import { createHash } from 'node:crypto';
import { prepareContent } from '../src/content/sanitize';
import { extractPostContent } from '../src/sources/spacebattles/parse';
import { threadFromUrl, ORIGIN } from '../src/sources/spacebattles/url';
import { RequestClient, type TransportResponse } from '../src/sources/spacebattles/request';
import { validateSourceImage, SOURCE_IMAGE_LIMITS } from '../src/images/validate';
import { classifyImageUrl } from '../src/images/source-url';
import { validateSlots } from '../src/images/slots';
import { bodyArticle } from './fixtures/import';
import { page, threadUrl } from './fixtures/spacebattles';
import { png, pngChunk, jpeg, webp, webpChunk } from './fixtures/images';

const digest = async (value: string) => createHash('sha256').update(value).digest('hex');
const thread = threadFromUrl(threadUrl);
const entry = { postId: '101', chapterId: `${thread.storyId}:post:101`, title: 'Generated', url: threadUrl, threadmarkId: null };
async function extract(body: string) {
  const extracted = extractPostContent({ url: threadUrl, html: page(bodyArticle('101', body)), status: 200 }, thread, entry, '9');
  return { extracted, content: await prepareContent(extracted.sourceHtml, digest) };
}
test.each([
  ['ordinary', `<img src="${ORIGIN}/attachments/a-png.1/">`, 'pending', null],
  ['relative', '<img src="/attachments/a-png.1/">', 'pending', null],
  ['protocol-relative', '<img src="//forums.spacebattles.com/data/attachments/a.png">', 'pending', null],
  ['wrapped', '<a href="/threads/9001/"><span><img src="/attachments/a-png.1/"></span></a>', 'pending', null],
  ['lazy', '<img src="data:fake" data-src="/attachments/a-png.1/">', 'pending', null],
  ['lazy data-url', '<img src="" data-url="/data/attachments/a.png">', 'pending', null],
  ['external', '<img src="https://example.com/a.png">', 'omitted', 'external-host'],
  ['http', '<img src="http://forums.spacebattles.com/a.png">', 'omitted', 'non-https'],
  ['malformed', '<img src="https://[broken">', 'omitted', 'invalid-url'],
  ['svg', '<img src="/attachments/image.svg.1/">', 'omitted', 'unsupported-format'],
  ['gif', '<img src="/attachments/image.gif.1/">', 'omitted', 'unsupported-format'],
  ['fixture impersonation', '<img src="fixture://harbor.png">', 'omitted', 'non-https'],
])('%s extraction maps one canonical inert slot', async (_name, markup, state, reason) => {
  const { extracted, content } = await extract(`<p>Generated before.</p>${markup}<p>Generated after.</p>`);
  expect(extracted.images).toHaveLength(1);
  expect(extracted.images[0]).toMatchObject({ slot: 0, state, reason });
  expect(() => validateSlots(content, extracted.images)).not.toThrow();
  expect(content.html).not.toMatch(/<img|\bsrc=|srcset=|data-stowaway-image|fixture:\/\//);
  expect(content.blockIds).toContain(extracted.images[0]!.blockId);
});
test('no images returns a scanned zero-slot result', async () => {
  const { extracted } = await extract('<p>Generated only.</p>'); expect(extracted.images).toEqual([]);
});
test('many ordered slots ignore discarded active containers and spoiler chrome', async () => {
  const body = '<script><img src="/a.png"></script><form><img src="/b.png"></form><div class="bbCodeSpoiler"><button><img src="/discard.png"></button><div class="bbCodeSpoiler-content-inner"><p>Inside.</p><img src="/c.png"></div></div>' +
    Array.from({ length: 250 }, (_, i) => `<img src="/attachments/${i}.png" alt="Generated ${i}">`).join('');
  const first = await extract(body), second = await extract(body);
  expect(first).toEqual(second); expect(first.extracted.images).toHaveLength(251);
  expect(first.extracted.images[0]!.sourceUrl).toBe(`${ORIGIN}/c.png`);
  expect(first.extracted.images.at(-1)!.alt).toBe('Generated 249');
  validateSlots(first.content, first.extracted.images);
});
test('image URL and alt changes leave the saved canonical text/hash/version/blocks unchanged', async () => {
  const a = await extract('<p>Same.</p><img src="/a.png" alt="A"><p>After.</p>');
  const b = await extract('<p>Same.</p><img src="/b.png" alt="B"><p>After.</p>');
  expect(a.content).toEqual(b.content); expect(a.extracted.images).not.toEqual(b.extracted.images);
});
test.each([
  ['PNG', png(), 'png'], ['JPEG', jpeg(), 'jpeg'], ['VP8L', webp(), 'webp'], ['VP8', webp('VP8 '), 'webp'], ['VP8X', webp('VP8X'), 'webp'],
])('%s complete raster structure yields dimensions', (_name, bytes, format) => {
  expect(validateSourceImage(bytes)).toEqual({ format, width: 2, height: 3, byteLength: bytes.length });
});
test.each([
  ['truncated PNG', png().slice(0, -1)], ['truncated JPEG', jpeg().slice(0, -1)], ['truncated WebP', webp().slice(0, -1)],
  ['GIF', Buffer.from('GIF89a' + '0'.repeat(30))], ['SVG', Buffer.from('<svg xmlns="fake">image</svg>')],
  ['XML', Buffer.from('<?xml version="1.0"?><fake/>')], ['HTML', Buffer.from('<html><title>Not image</title></html>')],
  ['arbitrary', new Uint8Array(64)], ['zero width', png(0)], ['zero height', png(2, 0)],
  ['bad PNG CRC', Uint8Array.from(png(), (b, i) => i === 29 ? b ^ 1 : b)],
  ['APNG', png(2, 3, [pngChunk('acTL', Buffer.alloc(8))])],
  ['animated VP8X', webp('VP8X', 2, 3, true)],
  ['dimension budget', png(2049)], ['byte budget', new Uint8Array(SOURCE_IMAGE_LIMITS.maxBytes + 1)],
])('%s cannot be accepted', (_name, bytes) => { expect(() => validateSourceImage(bytes)).toThrow(); });
test('WebP ANIM/ANMF markers and corrupt chunk lengths cannot hide in a complete RIFF', () => {
  for (const tag of ['ANIM', 'ANMF']) {
    const bytes = Buffer.concat([Buffer.from(webp('VP8X')), webpChunk(tag, Buffer.alloc(6))]);
    bytes.writeUInt32LE(bytes.length - 8, 4);
    expect(() => validateSourceImage(bytes)).toThrow('animated');
  }
  const bad = Buffer.from(webp()); bad.writeUInt32LE(9999, 16); expect(() => validateSourceImage(bad)).toThrow();
});
test.each(['image/jpeg', 'text/html', 'image/svg+xml'])('PNG bytes with %s obey the secondary MIME compatibility policy', (mime) => {
  if (mime === 'image/jpeg') expect(validateSourceImage(png(), mime).format).toBe('png');
  else expect(() => validateSourceImage(png(), mime)).toThrow('content-type-mismatch');
});
test('missing/opaque MIME is safe only with accepted byte structure', () => {
  expect(validateSourceImage(png(), 'application/octet-stream').format).toBe('png');
  expect(() => validateSourceImage(Buffer.from('<html>Not an image</html>'), 'image/png')).toThrow();
});

const imageUrl = `${ORIGIN}/attachments/generated.png`;
function response(url = imageUrl, status = 200, headers: Record<string, string> = {}, bytes = png()): TransportResponse {
  return { url, status, headers: { get: (name) => headers[name] ?? null }, bodyUsed: true,
    text: async () => '<p>Generated HTML</p>', arrayBuffer: async () => new Uint8Array(bytes).buffer };
}
function clock() { let time = 0; return { now: () => time, sleep: async (ms: number) => { time += ms; } }; }
test('same-origin binary and HTML share serialized cooldown and omitted credential/manual redirect policy', async () => {
  const time = clock(), starts: number[] = [], init: unknown[] = [];
  const transport = jest.fn(async (url, options) => { starts.push(time.now()); init.push(options); return response(url); });
  const client = new RequestClient(transport, time);
  await Promise.all([client.getImage(imageUrl), client.get(threadUrl, '9001'), client.getImage(imageUrl)]);
  expect(starts).toEqual([0, 2000, 4000]);
  for (const options of init) expect(options).toMatchObject({ credentials: 'omit', redirect: 'manual', cache: 'no-store' });
  expect(transport.mock.calls[0]![1].headers.Accept).toBe('image/png, image/jpeg, image/webp');
  expect(transport.mock.calls[1]![1].headers.Accept).toContain('text/html');
});
test('the shared queue retains ownership until the binary response body is consumed', async () => {
  let entered!: () => void, release!: () => void;
  const reading = new Promise<void>((resolve) => { entered = resolve; });
  const held = new Promise<void>((resolve) => { release = resolve; });
  const transport = jest.fn(async (url) => ({ ...response(url), arrayBuffer: async () => {
    if (url === imageUrl) { entered(); await held; }
    return new Uint8Array(png()).buffer;
  } }));
  const client = new RequestClient(transport, clock()), image = client.getImage(imageUrl);
  await reading;
  const document = client.get(threadUrl, '9001');
  await Promise.resolve(); await Promise.resolve();
  expect(transport).toHaveBeenCalledTimes(1);
  release(); await Promise.all([image, document]);
  expect(transport).toHaveBeenCalledTimes(2);
});
test.each(['https://example.com/a.png', 'https://spacebattles.com/a.png', 'https://cdn.forums.spacebattles.com/a.png', 'http://forums.spacebattles.com/a.png', 'https://user:secret@forums.spacebattles.com/a.png', 'https://forums.spacebattles.com/a.png?session=secret', 'https://forums.spacebattles.com/data%2fprivate.png'])('ineligible URL %s causes zero requests', async (url) => {
  const transport = jest.fn(); const client = new RequestClient(transport, clock());
  await expect(client.getImage(url)).rejects.toThrow(); expect(transport).not.toHaveBeenCalled();
  expect(classifyImageUrl(url).reason).not.toBeNull();
});
test('every same-origin redirect is checked and external redirect is rejected before following', async () => {
  const transport = jest.fn(async (url) => response(url, url === imageUrl ? 302 : 200, { location: '/data/attachments/new.png' }));
  expect((await new RequestClient(transport, clock()).getImage(imageUrl)).url).toBe(`${ORIGIN}/data/attachments/new.png`);
  expect(transport).toHaveBeenCalledTimes(2);
  const external = jest.fn(async (url) => response(url, 302, { location: 'https://example.com/escape.png' }));
  await expect(new RequestClient(external, clock()).getImage(imageUrl)).rejects.toThrow('external-host');
  expect(external).toHaveBeenCalledTimes(1);
});
test('unvalidated transport redirect is refused', async () => {
  await expect(new RequestClient(async () => response(`${ORIGIN}/other.png`), clock()).getImage(imageUrl)).rejects.toMatchObject({ code: 'blocked' });
});
test('transport following an external redirect stops as blocked instead of hiding it as an asset omission', async () => {
  await expect(new RequestClient(async () => response('https://example.com/escape.png'), clock()).getImage(imageUrl)).rejects.toMatchObject({ code: 'blocked' });
});
test.each([false, true])('oversized transient body remains retryable, header supplied=%s', async (header) => {
  const transport = jest.fn(async () => response(imageUrl, 503, header ? { 'content-length': '2000001' } : {}, new Uint8Array(2_000_001)));
  await expect(new RequestClient(transport, clock()).getImage(imageUrl)).rejects.toMatchObject({ code: 'transient' });
  expect(transport).toHaveBeenCalledTimes(1);
});
test('Content-Length and actual streamed bytes are bounded; overflow cancels stream', async () => {
  const buffer = jest.fn(async () => new Uint8Array(png()).buffer);
  await expect(new RequestClient(async () => ({ ...response(), headers: { get: () => '2000001' }, arrayBuffer: buffer }), clock()).getImage(imageUrl)).rejects.toThrow('over-byte-budget');
  expect(buffer).not.toHaveBeenCalled();
  const reader = { read: jest.fn(async () => ({ done: false, value: new Uint8Array(1_100_000) })), cancel: jest.fn(async () => {}), releaseLock: jest.fn() };
  await expect(new RequestClient(async () => ({ ...response(), body: { cancel: jest.fn(), getReader: () => reader } }), clock()).getImage(imageUrl)).rejects.toThrow('over-byte-budget');
  expect(reader.read).toHaveBeenCalledTimes(2); expect(reader.cancel).toHaveBeenCalled(); expect(reader.releaseLock).toHaveBeenCalled();
});
test('cancellation during cooldown causes no next request and during reading closes stream', async () => {
  const signal = new AbortController(), transport = jest.fn(async (url) => response(url));
  const client = new RequestClient(transport, { now: () => 0, sleep: (ms) => ms ? new Promise(() => {}) : Promise.resolve() });
  await client.getImage(imageUrl);
  const waiting = client.getImage(imageUrl, { signal: signal.signal });
  signal.abort(); await expect(waiting).rejects.toMatchObject({ code: 'cancelled' }); expect(transport).toHaveBeenCalledTimes(1);
  const during = new AbortController();
  const reader = { read: async () => { during.abort(); return new Promise<{ done: boolean }>(() => {}); }, cancel: jest.fn(async () => {}), releaseLock: jest.fn() };
  await expect(new RequestClient(async () => ({ ...response(), body: { cancel: jest.fn(), getReader: () => reader } }), clock()).getImage(imageUrl, { signal: during.signal })).rejects.toMatchObject({ code: 'cancelled' });
  expect(reader.cancel).toHaveBeenCalled();
});
test.each([401, 403, 404])('HTTP %s conservatively stops without retry', async (status) => {
  const transport = jest.fn(async () => response(imageUrl, status));
  await expect(new RequestClient(transport, clock()).getImage(imageUrl)).rejects.toMatchObject({ code: 'blocked' }); expect(transport).toHaveBeenCalledTimes(1);
});
test('challenge/login binary masquerade stops, transient retries remain bounded', async () => {
  const transport = jest.fn(async () => response(imageUrl, 200, {}, Buffer.from('<html><title>Log in</title></html>')));
  await expect(new RequestClient(transport, clock()).getImage(imageUrl)).rejects.toMatchObject({ code: 'challenge' });
  const transient = jest.fn(async () => response(imageUrl, 503));
  await expect(new RequestClient(transient, clock()).getImage(imageUrl)).rejects.toMatchObject({ code: 'transient' }); expect(transient).toHaveBeenCalledTimes(3);
});
