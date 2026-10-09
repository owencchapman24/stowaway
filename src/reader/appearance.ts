import type { ReaderFont } from '../domain/types';

/** Local fonts only. The final generic family works even when a named face is absent. */
export const READER_FONT_STACKS: Record<ReaderFont, string> = {
  "baskerville": "Baskerville, Georgia, serif",
  "charter": "Charter, Georgia, serif",
  "cochin": "Cochin, Georgia, serif",
  "didot": "Didot, Georgia, serif",
  "georgia": "Georgia, \"Times New Roman\", serif",
  "hoefler-text": "\"Hoefler Text\", Georgia, serif",
  "palatino": "Palatino, \"Palatino Linotype\", \"Book Antiqua\", Georgia, serif",
  "times": "\"Times New Roman\", Times, serif",
  "serif": "ui-serif, \"Times New Roman\", serif",
  "avenir": "Avenir, -apple-system, sans-serif",
  "avenir-next": "\"Avenir Next\", -apple-system, \"Helvetica Neue\", Arial, sans-serif",
  "futura": "Futura, -apple-system, sans-serif",
  "gill-sans": "\"Gill Sans\", -apple-system, sans-serif",
  "helvetica-neue": "\"Helvetica Neue\", Helvetica, Arial, sans-serif",
  "optima": "Optima, -apple-system, sans-serif",
  "sans": "-apple-system, BlinkMacSystemFont, \"Helvetica Neue\", Arial, sans-serif",
  "american-typewriter": "\"American Typewriter\", \"Courier New\", monospace",
  "courier-new": "\"Courier New\", Courier, monospace",
  "menlo": "Menlo, \"Courier New\", monospace",
  "bradley-hand": "\"Bradley Hand\", \"Chalkboard SE\", cursive",
  "chalkboard-se": "\"Chalkboard SE\", cursive",
  "marker-felt": "\"Marker Felt\", \"Chalkboard SE\", cursive",
  "noteworthy": "Noteworthy, \"Chalkboard SE\", cursive",
  "copperplate": "Copperplate, Georgia, serif",
  "papyrus": "Papyrus, fantasy",
  "snell-roundhand": "\"Snell Roundhand\", cursive",
};
export const READER_PAPER = { light: '#fcf9f2', paper: '#eee8dd', dark: '#15191e' };
