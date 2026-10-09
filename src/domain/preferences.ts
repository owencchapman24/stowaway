import { DEFAULT_PREFERENCES, type Preferences, type ReaderFont } from './types';

export const READER_FONTS: readonly ReaderFont[] = [
  "baskerville", "charter", "cochin", "didot", "georgia", "hoefler-text", "palatino", "times", "serif",
  "avenir", "avenir-next", "futura", "gill-sans", "helvetica-neue", "optima", "sans",
  "american-typewriter", "courier-new", "menlo",
  "bradley-hand", "chalkboard-se", "marker-felt", "noteworthy",
  "copperplate", "papyrus", "snell-roundhand",
];
/** Old JSON and untrusted persisted values never become CSS or bridge commands. */
export function normalizePreferences(value: unknown): Preferences & { font: ReaderFont } {
  const p = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    theme: p.theme === 'dark' || p.theme === 'paper' ? p.theme : 'light',
    fontSize: typeof p.fontSize === 'number' && Number.isFinite(p.fontSize) && p.fontSize >= 14 && p.fontSize <= 32
      ? p.fontSize : DEFAULT_PREFERENCES.fontSize,
    font: READER_FONTS.includes(p.font as ReaderFont) ? p.font as ReaderFont : 'georgia',
  };
}
