import { createHash } from 'node:crypto';
import { classifyImageUrl } from '../src/images/source-url';
import { SOURCE_IMAGE_LIMITS, validateSourceImage } from '../src/images/validate';
import { RequestClient, type TransportResponse } from '../src/sources/spacebattles/request';
import { ORIGIN } from '../src/sources/spacebattles/url';
import { png, pngChunk } from './fixtures/images';
import { threadUrl } from './fixtures/spacebattles';

const imageUrl = `${ORIGIN}/attachments/review.png`;
function clock() { let now = 0; return { now: () => now, sleep: async (ms: number) => { now += ms; } }; }
function response(url: string): TransportResponse {
  return { url, status: 200, bodyUsed: true,
    headers: { get: (name) => name === 'content-type' ? (url === threadUrl ? 'text/html' : 'image/png') : null },
    text: async () => '<p>Original synthetic document.</p>', arrayBuffer: async () => new Uint8Array(png()).buffer };
}

test.each([
  '/login/', '/%6cogin/', '/l%6fg%69n/', '/%4c%4fGIN/', '/%256cogin/', '/%25256cogin/',
  '/logout/', '/log%6fut/', '/account/', '/%61ccount/', '/admin/', '/%61dmin/', '/%61dmin.php',
  '/moderator/', '/%6doderator/', '/register/', '/%72egister/', '/conversations/', '/%63onversations/',
  '/attachments/%2e%2e/%6cogin/', '/attachments/%252e%252e/login/',
  '/attachments/bad%.png', '/attachments/%GG.png', '/attachments/%0G.png', '/attachments/%E0%A4%A.png',
  '/attachments/%00.png', '/attachments/%1f.png', '/attachments/%7f.png',
  '/attachments/a%2fb.png', '/attachments/a%5cb.png', '/attachments/a%252fb.png', '/attachments/a%255cb.png',
])('excluded/ambiguous path %s causes zero direct requests and no redirected request', async (path) => {
  expect(classifyImageUrl(path).reason).toBe('invalid-url');
  const direct = jest.fn();
  await expect(new RequestClient(direct, clock()).getImage(ORIGIN + path)).rejects.toThrow('invalid-url');
  expect(direct).not.toHaveBeenCalled();
  const redirect = jest.fn(async (url: string) => ({ ...response(url), status: 302, headers: { get: (name: string) => name === 'location' ? path : null } }));
  await expect(new RequestClient(redirect, clock()).getImage(imageUrl)).rejects.toThrow('invalid-url');
  expect(redirect).toHaveBeenCalledTimes(1);
});
test.each([
  '/attachments/example-png.123/', '/data/attachments/example.png', '/attachments/a%20b.png',
  '/attachments/%E2%98%83.png', '/attachments/100%25real.png', '/attachments/example%2epng',
])('legitimate path %s retains its request URL through initial and redirected classification', async (path) => {
  const expected = new URL(path, ORIGIN).href;
  expect(classifyImageUrl(path)).toEqual({ sourceUrl: expected, reason: null });
  const direct = jest.fn(async (url: string) => response(url));
  expect((await new RequestClient(direct, clock()).getImage(expected)).url).toBe(expected);
  expect(direct).toHaveBeenCalledWith(expected, expect.objectContaining({ credentials: 'omit', redirect: 'manual' }));
  const redirect = jest.fn(async (url: string) => url === imageUrl
    ? { ...response(url), status: 302, headers: { get: (name: string) => name === 'location' ? path : null } } : response(url));
  expect((await new RequestClient(redirect, clock()).getImage(imageUrl)).url).toBe(expected);
  expect(redirect.mock.calls.map(([url]) => url)).toEqual([imageUrl, expected]);
});
test.each(['/attachments/a.%67if', '/attachments/a.%73vg', '/attachments/a.%61vif'])('decoded unsupported extension %s stays ineligible', async (path) => {
  const transport = jest.fn();
  expect(classifyImageUrl(path).reason).toBe('unsupported-format');
  await expect(new RequestClient(transport, clock()).getImage(ORIGIN + path)).rejects.toThrow('unsupported-format');
  expect(transport).not.toHaveBeenCalled();
});

type Chunk = { done: boolean; value?: Uint8Array };
function stream(read: () => Promise<Chunk>) {
  const reader = { read: jest.fn(read), cancel: jest.fn(async () => {}), releaseLock: jest.fn() };
  return { reader, response: { ...response(imageUrl), body: { getReader: () => reader, cancel: jest.fn(async () => {}) } } };
}
test.each(['tiny', 'empty', 'mixed'])('bounded accumulator reconstructs thousands of %s chunks and releases the queue', async (mode) => {
  let at = 0, dataAt = 0;
  const count = mode === 'mixed' ? 20000 : 10000;
  const body = stream(async () => {
    if (at++ === count) return { done: true };
    const empty = mode === 'empty' || (mode === 'mixed' && at % 2 === 0);
    return { done: false, value: empty ? new Uint8Array(0) : Uint8Array.of(dataAt++ % 251) };
  });
  const transport = jest.fn(async (url: string) => url === imageUrl ? body.response : response(url));
  const client = new RequestClient(transport, clock());
  const result = await client.getImage(imageUrl);
  expect(Buffer.from(result.bytes).equals(Buffer.from(Array.from({ length: mode === 'empty' ? 0 : 10000 }, (_, i) => i % 251)))).toBe(true);
  expect(body.reader.read).toHaveBeenCalledTimes(count + 1);
  expect(body.reader.cancel).toHaveBeenCalledTimes(1); expect(body.reader.releaseLock).toHaveBeenCalledTimes(1);
  expect((await client.get(threadUrl, '9001')).url).toBe(threadUrl);
  expect(transport).toHaveBeenCalledTimes(2);
});
test.each([0, 1])('stream enforces the exact byte cap with %s excess bytes despite an underreported header', async (excess) => {
  const payload = new Uint8Array(SOURCE_IMAGE_LIMITS.maxBytes).fill(71);
  const chunks = [payload, new Uint8Array(0), new Uint8Array(excess).fill(72)];
  let at = 0;
  const body = stream(async () => at < chunks.length ? { done: false, value: chunks[at++]! } : { done: true });
  body.response.headers = { get: (name) => name === 'content-length' ? String(payload.length) : null };
  const client = new RequestClient(async (url) => url === imageUrl ? body.response : response(url), clock());
  if (excess) await expect(client.getImage(imageUrl)).rejects.toThrow('over-byte-budget');
  else {
    const result = await client.getImage(imageUrl);
    expect(result.bytes.length).toBe(payload.length);
    const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
    expect(digest(result.bytes)).toBe(digest(payload));
  }
  expect(body.reader.cancel).toHaveBeenCalledTimes(1); expect(body.reader.releaseLock).toHaveBeenCalledTimes(1);
  expect((await client.get(threadUrl, '9001')).url).toBe(threadUrl);
});
function deferred() { let resolve!: () => void; const promise = new Promise<void>((r) => { resolve = r; }); return { promise, resolve }; }
test('stream accumulator copies bytes before a transport reuses its chunk buffer', async () => {
  const reused = new Uint8Array(1); let at = 0;
  const body = stream(async () => {
    if (at === 10000) return { done: true };
    reused[0] = at++ % 251; return { done: false, value: reused };
  });
  const result = await new RequestClient(async () => body.response, clock()).getImage(imageUrl);
  expect(Buffer.from(result.bytes).equals(Buffer.from(Array.from({ length: 10000 }, (_, i) => i % 251)))).toBe(true);
  expect(body.reader.cancel).toHaveBeenCalledTimes(1); expect(body.reader.releaseLock).toHaveBeenCalledTimes(1);
});
test.each(['success', 'cancel', 'error'])('stream %s retains queue ownership until cancel/release settles', async (ending) => {
  const controller = new AbortController(), entered = deferred(), held = deferred();
  let at = 0;
  const body = stream(async () => {
    if (!at++) return { done: false, value: png() };
    if (ending === 'cancel') { controller.abort(); return new Promise<Chunk>(() => {}); }
    if (ending === 'error') throw new Error('Original synthetic stream error.');
    return { done: true };
  });
  body.reader.cancel.mockImplementation(async () => { entered.resolve(); await held.promise; });
  const transport = jest.fn(async (url: string) => url === imageUrl ? body.response : response(url));
  const client = new RequestClient(transport, clock());
  const outcome = client.getImage(imageUrl, { signal: controller.signal }).then((value) => ({ value, error: null }), (error: unknown) => ({ value: null, error }));
  await entered.promise;
  const next = client.get(threadUrl, '9001');
  await Promise.resolve(); await Promise.resolve();
  expect(transport).toHaveBeenCalledTimes(1); expect(body.reader.releaseLock).not.toHaveBeenCalled();
  held.resolve();
  const result = await outcome;
  if (ending === 'success') expect(result.value?.bytes).toEqual(png());
  else expect(result.error).toMatchObject({ code: ending === 'cancel' ? 'cancelled' : 'network' });
  expect((await next).url).toBe(threadUrl);
  expect(body.reader.cancel).toHaveBeenCalledTimes(1); expect(body.reader.releaseLock).toHaveBeenCalledTimes(1);
  expect(transport).toHaveBeenCalledTimes(2);
});
test('stream timeout retains bounded retries, closes every reader and permits subsequent HTML work', async () => {
  jest.useFakeTimers();
  try {
    const bodies: ReturnType<typeof stream>[] = [];
    const client = new RequestClient(async (url) => {
      if (url !== imageUrl) return response(url);
      const body = stream(async () => new Promise<Chunk>(() => {})); bodies.push(body); return body.response;
    }, clock());
    const result = client.getImage(imageUrl).catch((error: unknown) => error);
    for (let i = 0; i < 3; i++) await jest.advanceTimersByTimeAsync(20000);
    expect(await result).toMatchObject({ code: 'transient' }); expect(bodies).toHaveLength(3);
    for (const body of bodies) { expect(body.reader.cancel).toHaveBeenCalledTimes(1); expect(body.reader.releaseLock).toHaveBeenCalledTimes(1); }
    expect((await client.get(threadUrl, '9001')).url).toBe(threadUrl);
  } finally { jest.useRealTimers(); }
});

const originalPng = Buffer.from(png());
const payload = originalPng.subarray(41, 41 + originalPng.readUInt32BE(33));
const firstData = pngChunk('IDAT', payload.subarray(0, 3)), lastData = pngChunk('IDAT', payload.subarray(3));
function pngWithChunks(chunks: Buffer[]) { return Buffer.concat([originalPng.subarray(0, 33), ...chunks, pngChunk('IEND')]); }
test.each([
  ['before', [pngChunk('IDAT'), firstData, lastData]],
  ['between', [firstData, pngChunk('IDAT'), lastData]],
  ['after', [firstData, lastData, pngChunk('IDAT')]],
  ['multiple', [pngChunk('IDAT'), pngChunk('IDAT'), firstData, pngChunk('IDAT'), lastData, pngChunk('IDAT')]],
] as const)('PNG accepts empty IDAT %s nonempty contiguous data', (_label, chunks) => {
  expect(validateSourceImage(pngWithChunks([...chunks]), 'image/png')).toMatchObject({ format: 'png', width: 2, height: 3 });
});
test.each([
  ['missing', []], ['all empty', [pngChunk('IDAT'), pngChunk('IDAT')]],
  ['resumed data', [firstData, pngChunk('tEXt', Buffer.from('key\0value')), lastData]],
  ['resumed empty', [firstData, lastData, pngChunk('tEXt', Buffer.from('key\0value')), pngChunk('IDAT')]],
  ['empty starts closed run', [pngChunk('IDAT'), pngChunk('tEXt', Buffer.from('key\0value')), firstData, lastData]],
] as const)('PNG rejects %s IDAT structure', (_label, chunks) => {
  expect(() => validateSourceImage(pngWithChunks([...chunks]))).toThrow('invalid-bytes');
});
test('empty IDAT still requires its CRC', () => {
  const empty = pngChunk('IDAT'); empty[11] = empty[11]! ^ 1;
  expect(() => validateSourceImage(pngWithChunks([empty, firstData, lastData]))).toThrow('invalid-bytes');
});
test.each(['acTL', 'fcTL', 'fdAT'])('empty IDAT cannot hide APNG %s', (marker) => {
  expect(() => validateSourceImage(pngWithChunks([pngChunk('IDAT'), pngChunk(marker, Buffer.alloc(8)), firstData, lastData]))).toThrow('animated');
});
