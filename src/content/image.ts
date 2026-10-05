// Stowaway budgets for this bundled fixture, not source-site policy.
export const IMAGE_LIMITS = { maxBytes: 2_000_000, maxDimension: 2048 };
export const HARBOR_SHA256 = 'f7563c72d533152e62ca3f51a9c4583dbf5664abe18da16d469ec0a46d41c591';

export function validatePng(bytes: Uint8Array): void {
  const magic = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 45 || bytes.length > IMAGE_LIMITS.maxBytes ||
    !magic.every((value, index) => bytes[index] === value) ||
    String.fromCharCode(...bytes.slice(12, 16)) !== 'IHDR' ||
    String.fromCharCode(...bytes.slice(-8, -4)) !== 'IEND') throw new Error('Invalid fixture PNG.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  if (!width || !height || width > IMAGE_LIMITS.maxDimension || height > IMAGE_LIMITS.maxDimension) {
    throw new Error('Image exceeds dimension budget.');
  }
}
