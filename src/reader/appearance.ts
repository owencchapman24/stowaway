import type { ReaderFont } from '../domain/types';

/** Local fonts only. The final generic family works even when a named face is absent. */
export const READER_FONT_STACKS: Record<ReaderFont, string> = {
  georgia: 'Georgia, "Times New Roman", serif',
  palatino: 'Palatino, "Palatino Linotype", "Book Antiqua", Georgia, serif',
  serif: 'ui-serif, "Times New Roman", serif',
  sans: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif',
};
export const READER_PAPER = { light: '#fcf9f2', paper: '#eee8dd', dark: '#15191e' };
