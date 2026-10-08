import type { ImportProgress } from '../importing/import-story';
import type { ImageProgress } from '../images/download';

export function importProgressText(progress: ImportProgress | null) {
  if (!progress) return 'Starting…';
  switch (progress.phase) {
    case 'validating': return 'Validating story URL';
    case 'manifest': return `Reading primary Threadmarks · ${progress.total} found`;
    case 'saving': case 'reconciling': return 'Saving story contents';
    case 'downloading': return `${progress.downloaded} of ${progress.total} chapters downloaded${progress.title ? ` · ${progress.title}` : ''}`;
    case 'images': return `Downloading eligible images${progress.title ? ` · ${progress.title}` : ''}`;
    case 'completed': return 'All primary text downloaded.';
    case 'cancelled': return 'Cancelled. Completed local work was kept.';
    case 'failed': return 'Download stopped.';
  }
}
export function imageProgressText(progress: ImageProgress | null) {
  if (!progress) return 'Starting image work…';
  if (progress.phase === 'discovering') return `Finding eligible images${progress.title ? ` · ${progress.title}` : ''}`;
  if (progress.phase === 'downloading') return `${progress.completed} of ${progress.total} images processed${progress.title ? ` · ${progress.title}` : ''}`;
  if (progress.phase === 'cancelled') return 'Image work cancelled. Text and completed local images retained.';
  return progress.phase === 'completed' ? 'Image work finished.' : 'Image work stopped. Text is retained.';
}
