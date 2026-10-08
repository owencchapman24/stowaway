import type { ReaderFont } from '../domain/types';

/** Local fonts only. The final generic family works even when a named face is absent. */
export const READER_FONT_STACKS: Record<ReaderFont, string> = {
  georgia: 'Georgia, "Times New Roman", serif',
  baskerville: 'Baskerville, Georgia, serif',
  palatino: 'Palatino, "Palatino Linotype", "Book Antiqua", Georgia, serif',
  charter: 'Charter, Georgia, serif',
  times: '"Times New Roman", Times, serif',
  serif: 'ui-serif, "Times New Roman", serif',
  sans: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif',
  'avenir-next': '"Avenir Next", -apple-system, "Helvetica Neue", Arial, sans-serif',
  'helvetica-neue': '"Helvetica Neue", Helvetica, Arial, sans-serif',
};
export const READER_PAPER = { light: '#fcf9f2', paper: '#eee8dd', dark: '#15191e' };
