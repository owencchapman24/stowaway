import type { ReaderMessage } from './position';

/** Owned outside the keyed WebView reader: accepted intent survives its replacement. */
export class ReadCompletion {
  private requested = false;
  private saved = false;
  private inFlight: Promise<void> | null = null;

  constructor(private readonly save: () => Promise<void>) {}

  request(): Promise<void> {
    this.requested = true;
    return this.flush();
  }

  async flush(): Promise<void> {
    if (!this.requested || this.saved) return;
    this.inFlight ??= Promise.resolve().then(this.save).then(() => { this.saved = true; })
      .finally(() => { this.inFlight = null; });
    await this.inFlight;
  }

  async settle(replace: () => void): Promise<void> {
    // No await between the last pending check and the replacement decision.
    // A request accepted during any preceding await must join this drain.
    while (this.requested && !this.saved) await this.flush();
    replace();
  }
}

/** Readiness belongs to one rendering, independently of the retained completion. */
export class ReadEndSession {
  private ready = false;
  private requested = false;

  constructor(private readonly completion: ReadCompletion, private readonly onError: () => void) {}

  receive(message: ReaderMessage): void {
    if (message.type === 'ready') this.ready = true;
    if (message.type === 'layout-start') this.ready = false;
    if (message.type !== 'read-end' || !this.ready || this.requested) return;
    this.requested = true;
    void this.completion.request().catch(this.onError);
  }

  flush(): Promise<void> { return this.completion.flush(); }
}
