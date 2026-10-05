import { RequestClient, retryAfterMs, USER_AGENT, type Clock, type Transport, type TransportResponse } from '../src/sources/spacebattles/request';
import { threadUrl, page } from './fixtures/spacebattles';

export function reply(url: string, status = 200, html = page(''), retry: string | null = null): TransportResponse {
  return { url, status, headers: { get: (name) => name === 'retry-after' ? retry : name === 'content-type' ? 'text/html' : null }, text: async () => html };
}
function timer() {
  let now = 0;
  const sleeps: number[] = [];
  const clock: Clock = { now: () => now, sleep: async (ms) => { sleeps.push(ms); now += ms; } };
  return { clock, sleeps };
}

test('serializes simultaneous callers including body consumption; starts at least two seconds apart', async () => {
  const { clock } = timer();
  const starts: number[] = [];
  let inFlight = 0, peak = 0;
  const transport: Transport = async (url, init) => {
    expect(init.credentials).toBe('omit'); expect(init.redirect).toBe('manual');
    expect(init.headers).toEqual({ 'User-Agent': USER_AGENT, Accept: 'text/html, application/xhtml+xml', 'Cache-Control': 'no-store' });
    expect(Object.keys(init.headers).some((key) => /cookie|authorization/i.test(key))).toBe(false);
    starts.push(clock.now()); inFlight++; peak = Math.max(peak, inFlight);
    return { ...reply(url), text: async () => { await Promise.resolve(); inFlight--; return page(''); } };
  };
  const client = new RequestClient(transport, clock);
  await Promise.all([client.get(threadUrl, '9001'), client.get(threadUrl, '9001'), client.get(threadUrl, '9001')]);
  expect(peak).toBe(1); expect(starts).toEqual([0, 2000, 4000]);
});
test.each([401, 403])('HTTP %s is blocked without retries', async (status) => {
  const { clock } = timer();
  const transport = jest.fn(async (url: string) => reply(url, status));
  await expect(new RequestClient(transport, clock).get(threadUrl, '9001')).rejects.toMatchObject({ code: 'blocked', status });
  expect(transport).toHaveBeenCalledTimes(1);
});
test('429 honors Retry-After; retries and manual redirects also use the shared spacing policy', async () => {
  const { clock } = timer(); const starts: number[] = [];
  const transport = jest.fn(async (url: string) => { starts.push(clock.now()); return reply(url, starts.length === 1 ? 429 : 200, page(''), '7'); });
  await new RequestClient(transport, clock).get(threadUrl, '9001');
  expect(starts).toEqual([0, 7000]);
  expect(retryAfterMs('Thu, 01 Jan 1970 00:00:10 GMT', 1000)).toBe(9000);
});
test.each([429, 500])('HTTP %s stops after two retries with increasing delays', async (status) => {
  const { clock } = timer(); const starts: number[] = [];
  const transport = jest.fn(async (url: string) => { starts.push(clock.now()); return reply(url, status); });
  await expect(new RequestClient(transport, clock).get(threadUrl, '9001')).rejects.toMatchObject({ code: 'transient', status });
  expect(starts).toEqual([0, 2000, 6000]); expect(transport).toHaveBeenCalledTimes(3);
});
test('timeouts have two retries; ordinary network failures have no automatic endpoint rotation', async () => {
  const { clock } = timer(); const starts: number[] = [];
  const timeout = jest.fn(async () => { starts.push(clock.now()); const error = new Error('Synthetic timeout'); error.name = 'AbortError'; throw error; });
  await expect(new RequestClient(timeout, clock).get(threadUrl, '9001')).rejects.toMatchObject({ code: 'transient' });
  expect(starts).toEqual([0, 2000, 6000]);
  const network = jest.fn(async () => { throw new TypeError('Synthetic network failure'); });
  await expect(new RequestClient(network, clock).get(threadUrl, '9001')).rejects.toMatchObject({ code: 'network' });
  expect(network).toHaveBeenCalledTimes(1);
});
test.each(['<title>Log in | Synthetic forum</title><form action="/login/login"></form>', '<title>Just a moment...</title>',
  '<script src="/cdn-cgi/challenge-platform/test"></script>', '<title>Access denied</title>'])('200 login/interstitial HTML is failure: %s', async (html) => {
  const { clock } = timer(); const transport = jest.fn(async (url: string) => reply(url, 200, html));
  await expect(new RequestClient(transport, clock).get(threadUrl, '9001')).rejects.toMatchObject({ code: 'challenge' });
  expect(transport).toHaveBeenCalledTimes(1);
});
test('a 503 challenge is not retried as a transient server error', async () => {
  const { clock } = timer(); const transport = jest.fn(async (url: string) => reply(url, 503, '<title>Just a moment...</title>'));
  await expect(new RequestClient(transport, clock).get(threadUrl, '9001')).rejects.toMatchObject({ code: 'challenge' });
  expect(transport).toHaveBeenCalledTimes(1);
});
test('redirect destinations are checked before fetching and unread redirect bodies are cancelled', async () => {
  const { clock } = timer(); const cancel = jest.fn(async () => undefined);
  let calls = 0;
  const transport: Transport = async (url) => { calls++; return { ...reply(url, 301), body: { cancel },
    headers: { get: (name) => name === 'location' ? '/login/' : null } }; };
  await expect(new RequestClient(transport, clock).get(threadUrl, '9001')).rejects.toMatchObject({ code: 'unsupported-url' });
  expect(calls).toBe(1); expect(cancel).toHaveBeenCalledTimes(1);
});
test('a validated redirect is another serial, spaced request; automatic redirects fail closed', async () => {
  const { clock } = timer(); const starts: number[] = [];
  const transport: Transport = async (url) => { starts.push(clock.now()); return starts.length === 1 ?
    { ...reply(url, 301), headers: { get: (name) => name === 'location' ? '/threads/9001/' : null } } : reply(url); };
  await new RequestClient(transport, clock).get(threadUrl, '9001'); expect(starts).toEqual([0, 2000]);
  await expect(new RequestClient(async () => reply('https://evil.test/'), clock).get(threadUrl, '9001')).rejects.toThrow();
});
test('Retry-After also delays a validated redirect, not only transient retries', async () => {
  const { clock } = timer(); const starts: number[] = [];
  const transport: Transport = async (url) => {
    starts.push(clock.now());
    return starts.length === 1 ? { ...reply(url, 301), headers: { get: (name) =>
      name === 'location' ? '/threads/9001/' : name === 'retry-after' ? '7' : null } } : reply(url);
  };
  await new RequestClient(transport, clock).get(threadUrl, '9001');
  expect(starts).toEqual([0, 7000]);
});
test('long Retry-After is not shortened on a repeated run; cancel/budget do not issue a GET', async () => {
  const { clock } = timer(); const transport = jest.fn(async (url: string) => reply(url, 429, '', '3600'));
  const client = new RequestClient(transport, clock);
  await expect(client.get(threadUrl, '9001')).rejects.toMatchObject({ code: 'transient' });
  await expect(client.get(threadUrl, '9001')).rejects.toMatchObject({ code: 'transient' });
  expect(transport).toHaveBeenCalledTimes(1);
  const controller = new AbortController(); controller.abort();
  await expect(client.get(threadUrl, '9001', { signal: controller.signal })).rejects.toMatchObject({ code: 'cancelled' });
  await expect(new RequestClient(transport, clock).get(threadUrl, '9001', { limit: 0 })).rejects.toMatchObject({ code: 'incomplete' });
});
