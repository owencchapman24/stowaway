export type ImageReason = 'external-host' | 'non-https' | 'invalid-url' | 'unsupported-format' |
  'animated' | 'over-byte-budget' | 'over-dimension-budget' | 'invalid-bytes' | 'content-type-mismatch';
export type ImageDiscovery = 'unknown' | 'scanned' | 'saved-text-mismatch' | 'fixture';
export interface ImageSlot {
  slot: number;
  blockId: string;
  sourceUrl: string | null;
  alt: string;
  state: 'pending' | 'omitted';
  reason: ImageReason | null;
}
export interface ImageFile {
  relativePath: string;
  format: 'png' | 'jpeg' | 'webp';
  byteLength: number;
  width: number;
  height: number;
  digest: string;
}
export interface ChapterImage extends Omit<ImageSlot, 'state'> {
  chapterId: string;
  state: 'pending' | 'omitted' | 'downloaded';
  file: ImageFile | null;
}
export interface ImageSummary {
  unknown: number; mismatch: number; scanned: number;
  local: number; pending: number; omitted: number;
  mimeRetryable?: number;
}
/** Bounded, transient diagnostics; never part of the persisted image reference. */
export interface ImageMimeDiagnostic {
  chapterId: string; slot: number;
  receivedMime: string | null; detectedFormat: ImageFile['format']; accepted: boolean;
}
