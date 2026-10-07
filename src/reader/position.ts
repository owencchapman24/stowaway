import type { Chapter, Locator } from '../domain/types';

export type ReaderMessage =
  | { type: 'ready' | 'layout-start' | 'flushed' | 'read-end'; session: string; chapterId: string; contentHash: string }
  | { type: 'quiesced'; session: string; chapterId: string; contentHash: string; handoffId: string }
  | { type: 'link'; session: string; chapterId: string; contentHash: string; linkId: string }
  | { type: 'position'; session: string; chapterId: string; contentHash: string; locator: Locator; reason: 'scroll' | 'flush' };

export function parseMessage(raw: string, chapter: Chapter, session: string): ReaderMessage | null {
  if (raw.length > 16_000) return null;
  try {
    const message = JSON.parse(raw);
    if (!message || typeof message !== 'object' || message.session !== session ||
      message.chapterId !== chapter.id || message.contentHash !== chapter.contentHash) return null;
    if (message.type === 'ready' || message.type === 'layout-start' || message.type === 'flushed' || message.type === 'read-end') {
      return Object.keys(message).length === 4 ? message : null;
    }
    if (message.type === 'quiesced') {
      return Object.keys(message).length === 5 && typeof message.handoffId === 'string' &&
        /^[A-Za-z0-9:-]{1,100}$/.test(message.handoffId) ? message : null;
    }
    if (message.type === 'link') {
      return typeof message.linkId === 'string' && Object.hasOwn(chapter.links, message.linkId) ? message : null;
    }
    const locator = message.locator;
    if (message.type !== 'position' || !locator || locator.chapterId !== chapter.id ||
      locator.contentHash !== chapter.contentHash || !chapter.blockIds.includes(locator.blockId) ||
      typeof locator.offset !== 'number' || !Number.isFinite(locator.offset) || locator.offset < 0 || locator.offset > 1_000_000 ||
      typeof locator.progression !== 'number' || !Number.isFinite(locator.progression) ||
      locator.progression < 0 || locator.progression > 1 || !Array.isArray(locator.expandedSpoilers) ||
      locator.expandedSpoilers.length > chapter.blockIds.length ||
      !locator.expandedSpoilers.every((id: unknown) => typeof id === 'string' && chapter.blockIds.includes(id)) ||
      (message.reason !== 'scroll' && message.reason !== 'flush')) return null;
    return message;
  } catch {
    return null;
  }
}

/** Only post-restoration reading samples become candidates for persistence. */
export class PositionSession {
  private ready = false;
  private pending: Locator | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private writes: Promise<void> = Promise.resolve();

  constructor(private readonly save: (locator: Locator) => Promise<void>, private readonly onError: (error: unknown) => void) {}

  receive(message: ReaderMessage): void {
    if (message.type === 'layout-start') {
      this.ready = false;
      return;
    }
    if (message.type === 'ready') {
      this.ready = true;
      return;
    }
    if (message.type !== 'position' || !this.ready) return;
    this.pending = message.locator;
    if (this.timer) clearTimeout(this.timer);
    if (message.reason === 'flush') void this.flush().catch(this.onError);
    else this.timer = setTimeout(() => { void this.flush().catch(this.onError); }, 300);
  }

  async flush(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const locator = this.pending;
    this.pending = null;
    if (locator) {
      this.writes = this.writes.catch(() => undefined).then(() => this.save(locator));
      try { await this.writes; }
      catch (error) { this.pending ??= locator; throw error; }
    } else await this.writes;
  }

  dispose(): void {
    this.ready = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    void this.flush().catch(this.onError);
  }
}
