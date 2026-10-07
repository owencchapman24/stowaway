import { ImageRejected, normalizeImageMime, validateSourceImage } from '../src/images/validate';
import { jpeg, png, pngChunk, webp } from './fixtures/images';

const rasters = [['png', png()], ['jpeg', jpeg()], ['webp', webp()]] as const;
const rasterMime = ['image/png', 'image/jpeg', 'image/jpg', 'image/pjpeg', 'image/webp'];

test.each(rasters.flatMap(([format, bytes]) => rasterMime.map((mime) => [format, mime, bytes] as const)))('%s bytes remain authoritative under %s', (format, mime, bytes) => {
  expect(validateSourceImage(bytes, mime)).toEqual({ format, width: 2, height: 3, byteLength: bytes.length });
});
test.each([undefined, null, '', 'application/octet-stream', ' APPLICATION/OCTET-STREAM ; filename=ignored.jpg '])('missing/opaque MIME %s still requires accepted bytes', (mime) => {
  for (const [format, bytes] of rasters) expect(validateSourceImage(bytes, mime).format).toBe(format);
});
test.each([
  [' IMAGE/JPEG ; charset=binary ', jpeg(), 'jpeg'], ['Image/JpG; name=ignored.png', jpeg(), 'jpeg'],
  ['image/PJPEG; q=1', jpeg(), 'jpeg'], [' IMAGE/PNG; filename=ignored.jpeg ', png(), 'png'], ['Image/WeBp; foo=bar', webp(), 'webp'],
])('case/parameters in %s cannot control format', (mime, bytes, format) => {
  expect(validateSourceImage(bytes, mime as string).format).toBe(format);
});
test.each(['text/html', 'application/xhtml+xml', 'application/xml', 'text/xml', 'image/svg+xml', 'image/gif', 'image/avif', 'image/apng', 'image/bmp', 'audio/mpeg', 'application/pdf', 'application/binary'])('%s vetoes even valid accepted raster bytes', (mime) => {
  for (const [format, bytes] of rasters) {
    try { validateSourceImage(bytes, mime); throw new Error('Unexpected acceptance.'); }
    catch (error) {
      expect(error).toBeInstanceOf(ImageRejected);
      expect(error).toMatchObject({ reason: 'content-type-mismatch', mime: { receivedMime: mime, detectedFormat: format } });
    }
  }
});
test.each([
  ['multiple types', 'image/png, text/html'], ['missing type', '; image/png'], ['control characters', 'image/png\r\nAuthorization: secret'],
  ['overlong type', 'image/' + 'x'.repeat(5000)], ['credential URL', 'https://user:secret@example.com'],
])('%s is bounded/redacted rather than accepted as MIME', (_label, mime) => {
  expect(normalizeImageMime(mime)).toBe('invalid');
  expect(() => validateSourceImage(png(), mime)).toThrow('content-type-mismatch');
});
test('diagnostic strips all parameters and never includes raw response metadata', () => {
  const header = ' TEXT/HTML ; token=secret; filename=private.jpg; session=private';
  try { validateSourceImage(jpeg(), header); throw new Error('Unexpected acceptance.'); }
  catch (error) {
    expect(error).toMatchObject({ mime: { receivedMime: 'text/html', detectedFormat: 'jpeg' } });
    expect(JSON.stringify(error)).not.toMatch(/secret|private|session|filename/);
  }
  expect(normalizeImageMime('image/jpg;' + 'x'.repeat(10000))).toBe('image/jpg');
});
test.each([...rasterMime, 'application/octet-stream', undefined])('invalid/unsupported/animated/over-budget bytes never become accepted under %s', (mime) => {
  const rejected = [
    Buffer.from('<html><title>Log in</title></html>'), Buffer.from('<svg xmlns="fake">not a raster</svg>'),
    Buffer.from('<?xml version="1.0"?><fake/>'), Buffer.from('GIF89a' + '0'.repeat(30)),
    Buffer.from('0000ftypavif' + '0'.repeat(30)), new Uint8Array(64), png().slice(0, -1), jpeg().slice(0, -1), webp().slice(0, -1),
    png(2, 3, [pngChunk('acTL', Buffer.alloc(8))]), webp('VP8X', 2, 3, true), png(2049), new Uint8Array(2_000_001),
    Buffer.concat([Buffer.from(png()), Buffer.from('<html><title>Log in</title></html>')]),
  ];
  for (const bytes of rejected) expect(() => validateSourceImage(bytes, mime)).toThrow();
});
