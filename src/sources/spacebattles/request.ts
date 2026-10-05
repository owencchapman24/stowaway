import { S1Failure, type Document, type RequestEvent } from './types';
import { documentUrl } from './url';

export const USER_AGENT = 'Stowaway/0.1 personal-reader-feasibility';
export const MIN_SPACING_MS = 2000;
export interface TransportResponse {
  status: number; url: string; headers: { get(name: string): string | null };
  body?: { cancel(): Promise<void> } | null; bodyUsed?: boolean;
  text(): Promise<string>;
}
export interface TransportInit {
  method: 'GET'; headers: Record<string, string>; credentials: 'omit'; redirect: 'manual';
  signal: AbortSignal; cache: 'no-store';
}
export type Transport = (url: string, init: TransportInit) => Promise<TransportResponse>;
export interface Clock { now(): number; sleep(ms: number): Promise<void> }
const clock: Clock = { now: Date.now, sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)) };

export function retryAfterMs(value: string | null, now: number): number {
  if (!value) return 0;
  if (/^[0-9]+$/.test(value.trim())) return Number(value) * 1000;
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - now) : 0;
}

/** HTML access classification examines structural/title markers, not arbitrary chapter prose. */
export function accessFailure(html: string): S1Failure | null {
  const head = html.slice(0, 60000);
  if (/cf-chl-|challenge-platform|id=["']challenge-form|<title[^>]*>\s*(?:just a moment|attention required|access denied|verify you are human|forbidden|unauthorized|security check|checking your browser|request rejected)/i.test(head)) {
    return new S1Failure('challenge', 'Source returned an anti-bot challenge or access interstitial.');
  }
  if (/<title[^>]*>\s*(?:log[ -]?in|sign[ -]?in)|<form[^>]+action=["'][^"']*\/login\//i.test(head)) {
    return new S1Failure('challenge', 'Source returned a login page instead of public content.');
  }
  return null;
}

export class RequestClient {
  private queue: Promise<unknown> = Promise.resolve();
  private lastStart = -Infinity;
  private notBefore = 0;
  requestCount = 0;

  constructor(private readonly transport: Transport, private readonly time: Clock = clock) {}

  get(value: string, threadId: string, options: {
    signal?: AbortSignal; limit?: number; onEvent?: (event: RequestEvent) => void;
  } = {}): Promise<Document> {
    const url = documentUrl(value, threadId);
    const task = this.queue.then(() => this.read(url, threadId, options));
    this.queue = task.then(() => undefined, () => undefined);
    return task;
  }

  private async read(url: string, threadId: string, options: {
    signal?: AbortSignal; limit?: number; onEvent?: (event: RequestEvent) => void;
  }): Promise<Document> {
    let current = url;
    let redirects = 0;
    let retries = 0;
    let retryDelay = 0;
    for (;;) {
      if (options.signal?.aborted) throw new S1Failure('cancelled', 'Diagnostic cancelled.');
      const wait = Math.max(0, this.lastStart + MIN_SPACING_MS - this.time.now(), this.notBefore - this.time.now(), retryDelay);
      if (wait > 30000) throw new S1Failure('transient', 'Retry-After exceeds the spike wait limit; stop and retry later.');
      options.onEvent?.({ state: 'waiting', count: this.requestCount });
      await this.time.sleep(wait);
      if (options.signal?.aborted) throw new S1Failure('cancelled', 'Diagnostic cancelled.');
      if (this.requestCount >= (options.limit ?? Infinity)) throw new S1Failure('incomplete', 'Diagnostic request budget reached.');
      this.lastStart = this.time.now();
      this.requestCount++;
      options.onEvent?.({ state: 'requesting', count: this.requestCount });
      const abort = new AbortController();
      const cancel = () => abort.abort();
      options.signal?.addEventListener('abort', cancel, { once: true });
      const timeout = setTimeout(cancel, 20000);
      let response: TransportResponse | null = null;
      try {
        response = await this.transport(current, {
          method: 'GET', credentials: 'omit', redirect: 'manual', cache: 'no-store', signal: abort.signal,
          headers: { 'User-Agent': USER_AGENT, Accept: 'text/html, application/xhtml+xml', 'Cache-Control': 'no-store' },
        });
        options.onEvent?.({ state: 'response', count: this.requestCount, status: response.status });
        if (response.url && documentUrl(response.url, threadId) !== current) {
          throw new S1Failure('blocked', 'Transport followed a redirect without policy validation.');
        }
        const after = retryAfterMs(response.headers.get('retry-after'), this.time.now());
        this.notBefore = Math.max(this.notBefore, this.time.now() + after);
        if (response.status === 401 || response.status === 403) {
          throw new S1Failure('blocked', 'Source refused unauthenticated access; no retry or workaround.', response.status);
        }
        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get('location');
          if (!location || ++redirects > 4) throw new S1Failure('blocked', 'Missing or excessive source redirects.', response.status);
          current = documentUrl(location, threadId, current);
          continue;
        }
        const length = Number(response.headers.get('content-length'));
        if (length > 3_000_000) throw new S1Failure('unsupported-structure', 'Source document exceeds the 3 MB spike budget.');
        if (response.status === 429 || response.status >= 500) {
          const transientBody = await response.text();
          if (transientBody.length > 3_000_000) throw new S1Failure('unsupported-structure', 'Transient document exceeds the spike budget.');
          const challenge = accessFailure(transientBody);
          if (challenge) throw challenge;
          if (retries++ >= 2) throw new S1Failure('transient', 'Transient response exhausted two retries.', response.status);
          retryDelay = Math.max(2000 * 2 ** (retries - 1), after);
          continue;
        }
        if (response.status !== 200) throw new S1Failure('blocked', 'Unexpected source HTTP response.', response.status);
        const html = await response.text();
        if (html.length > 3_000_000) throw new S1Failure('unsupported-structure', 'Source document exceeds the spike budget.');
        const denied = accessFailure(html);
        if (denied) throw denied;
        const contentType = response.headers.get('content-type');
        if (contentType && !/text\/html|application\/xhtml\+xml|application\/json/i.test(contentType)) {
          throw new S1Failure('unsupported-structure', 'Expected an HTML source document.');
        }
        return { url: current, html, status: response.status };
      } catch (error) {
        if (error instanceof S1Failure) throw error;
        if (options.signal?.aborted) throw new S1Failure('cancelled', 'Diagnostic cancelled.');
        const timedOut = abort.signal.aborted || (error instanceof Error && error.name === 'AbortError');
        if (!timedOut) throw new S1Failure('network', 'Ordinary network request failed.');
        if (retries++ >= 2) throw new S1Failure('transient', 'Request timeout exhausted two retries.');
        retryDelay = 2000 * 2 ** (retries - 1);
      } finally {
        clearTimeout(timeout);
        options.signal?.removeEventListener('abort', cancel);
        abort.abort();
        // Header-only failures/redirects must not leave a previous body downloading behind the queue.
        try { if (response && !response.bodyUsed) await response.body?.cancel(); } catch { /* Already closed/aborted. */ }
      }
    }
  }
}
