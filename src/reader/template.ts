import type { Chapter, Locator, Preferences } from '../domain/types';
import { escapeHtml } from '../content/sanitize';
import { normalizePreferences } from '../domain/preferences';
import { READER_FONT_STACKS } from './appearance';
import { POSITION_BRIDGE } from './bridge';

function scriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

export function readerDocument(chapter: Chapter, locator: Locator | null, preferences: Preferences, session: string): string {
  const prefs = normalizePreferences(preferences);
  const config = scriptJson({ chapterId: chapter.id, contentHash: chapter.contentHash, session, locator });
  // session is an app-generated UUID, never source input.
  if (!/^[a-f0-9-]{36}$/.test(session)) throw new Error('Invalid reader session.');
  return `<!doctype html><html lang="en" data-theme="${prefs.theme}" data-font="${prefs.font}"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${session}'; style-src 'nonce-${session}'; img-src 'self' file:; connect-src 'none'; font-src 'none'; media-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">
<title>${escapeHtml(chapter.title)}</title>
<style nonce="${session}">
:root { --font-size: ${prefs.fontSize}px; --paper:#fcf9f2; --ink:#242424; --link:#1d5e96; color-scheme:light; }
:root[data-theme="paper"] { --paper:#eee8dd; --ink:#332e27; --link:#6b512e; color-scheme:light; }
${Object.entries(READER_FONT_STACKS).map(([font, stack]) => `:root[data-font="${font}"] { --reader-font:${stack}; }`).join("\n")}
:root[data-theme="dark"] { --paper:#15191e; --ink:#e8e5dd; --link:#9ac4ff; color-scheme:dark; }
html { background:var(--paper); color:var(--ink); font-size:var(--font-size); overflow-anchor:none; scroll-behavior:auto; }
body { margin:0 auto; max-width:46rem; padding:24px 22px 48px; font-family:var(--reader-font, Georgia, serif); line-height:1.65; overflow-wrap:anywhere; -webkit-text-size-adjust:100%; }
p { margin:0 0 1em; } h1,h2,h3,h4,h5,h6 { line-height:1.25; margin:1.2em 0 .7em; }
h1 { font-size:1.5em; } h2 { font-size:1.3em; } h3 { font-size:1.15em; }
blockquote { border-left:3px solid var(--link); margin:1em 0; padding-left:1em; }
a { color:var(--link); text-decoration:underline; } img { max-width:100%; height:auto; display:block; margin:1em auto; }
details { border-radius:8px; border:1px solid var(--link); padding:.6em; margin:1em 0; } summary { cursor:pointer; font-weight:bold; padding:.3em; }
table { display:block; overflow-x:auto; max-width:100%; border-collapse:collapse; width:100%; font-size:.85em; } th,td { border:1px solid var(--ink); padding:.4em; }
pre { white-space:pre-wrap; } hr { margin:1.5em 0; border:0; border-top:1px solid var(--ink); }
</style></head><body><main id="chapter">${chapter.html}</main>
<script nonce="${session}">const CONFIG = ${config};\n${POSITION_BRIDGE}</script></body></html>`;
}
