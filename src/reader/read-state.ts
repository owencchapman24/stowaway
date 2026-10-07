import type { ReaderMessage } from './position';

/** One completion per reader session, with an awaitable/retryable local save. */
export class ReadEndSession {
  private ready = false;
  private requested = false;
  private saved = false;
  private inFlight: Promise<void> | null = null;

  constructor(private readonly save: () => Promise<void>, private readonly onError: () => void) {}

  receive(message: ReaderMessage): void {
    if (message.type === 'ready') this.ready = true;
    if (message.type === 'layout-start') this.ready = false;
    if (message.type !== 'read-end' || !this.ready || this.requested) return;
    this.requested = true;
    void this.flush().catch(this.onError);
  }

  async flush(): Promise<void> {
    if (!this.requested || this.saved) return;
    this.inFlight ??= Promise.resolve().then(this.save).then(() => { this.saved = true; })
      .finally(() => { this.inFlight = null; });
    await this.inFlight;
  }
}
