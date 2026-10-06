import type { ImageSummary } from './types';

export function describeImages(summary: ImageSummary): string {
  const parts: string[] = [];
  if (summary.unknown) parts.push(`${summary.unknown} text chapters not scanned`);
  if (summary.local || summary.pending || summary.omitted) parts.push(`${summary.local} local · ${summary.omitted} omitted · ${summary.pending} pending`);
  if (summary.mismatch) parts.push(`${summary.mismatch} chapters unavailable: saved text differs`);
  if (summary.mimeRetryable) parts.push(`${summary.mimeRetryable} previously rejected images can be retried`);
  return `Images: ${parts.join(' · ') || (summary.scanned ? 'no source images' : 'no downloaded text to scan')}`;
}
