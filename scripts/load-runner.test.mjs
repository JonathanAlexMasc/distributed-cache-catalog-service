import test from 'node:test';
import assert from 'node:assert/strict';
import { setMaxListeners } from 'node:events';
import { validateConfig, targetUrl, readResponse, runPhase } from '../src/main/resources/static/load-runner.mjs';

const config = { target: 'product', mode: 'compare', value: 'test-id', count: 10001, concurrency: 7 };
const response = () => new Response('{"id":"test-id"}', { headers: { 'Content-Type': 'application/json' } });

test('validates guardrails and encodes arbitrary target values', () => {
  assert.equal(validateConfig(config).count, 10001);
  for (const change of [{ count: 0 }, { count: 100001 }, { count: 1.5 }, { concurrency: 21 }, { concurrency: 0 }, { value: ' ' }, { mode: 'bad' }]) {
    assert.throws(() => validateConfig({ ...config, ...change }));
  }
  assert.throws(() => validateConfig({ ...config, target: 'category' }));
  assert.match(targetUrl('', { ...config, value: 'a/b ?' }, false), /a%2Fb%20%3F\?useCache=false$/);
});

test('sends exactly 10001 requests with bounded concurrency and consumes bodies', async () => {
  let active = 0, peak = 0, calls = 0;
  const result = await runPhase({ url: '/test', ...config, fetchFn: async () => {
    calls++; active++; peak = Math.max(peak, active);
    await new Promise((resolve) => setImmediate(resolve));
    active--;
    return response();
  } });
  assert.equal(calls, 10001);
  assert.equal(result.completed, 10001);
  assert.equal(result.succeeded, 10001);
  assert.equal(result.failed, 0);
  assert.equal(result.status, 'completed');
  assert.equal(result.successRate, 100);
  assert.equal(peak, 7);
  assert.ok(result.bytes > 10001);
  assert.ok(result.p95Ms >= 0);
});

test('stop cancels outstanding requests and starts no further requests', async () => {
  const controller = new AbortController();
  let calls = 0;
  const result = await runPhase({ url: '/test', ...config, signal: controller.signal, fetchFn: async (_, { signal }) => {
    calls++;
    await new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Stopped', 'AbortError')), { once: true });
      setImmediate(() => controller.abort());
    });
    return response();
  } });
  assert.equal(calls, config.concurrency);
  assert.equal(result.completed, 0);
  assert.equal(result.cancelled, config.concurrency);
  assert.equal(result.failed, 0);
  assert.equal(result.status, 'stopped');
});

test('HTTP failures are counted and trigger the error cutoff', async () => {
  const result = await runPhase({ url: '/test', ...config, concurrency: 1,
    fetchFn: async () => new Response('', { status: 503 }) });
  assert.equal(result.failed, 20);
  assert.equal(result.succeeded, 0);
  assert.equal(result.status, 'stopped');
  assert.equal(result.errors.length, 20);
  assert.equal(result.averageMs, null);
});

test('enforces transfer and duration limits', async () => {
  const result = await runPhase({ url: '/test', ...config, concurrency: 1, maxBytes: 1, fetchFn: async () => response() });
  assert.equal(result.completed, 1);
  assert.equal(result.reason, 'Transfer budget reached.');
  const timed = await runPhase({ url: '/test', ...config, concurrency: 1, phaseTimeoutMs: 5,
    fetchFn: async (_, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('Stopped', 'AbortError')), { once: true })) });
  assert.equal(timed.status, 'stopped');
  assert.match(timed.reason, /Two-minute/);
});

test('request timeout includes response body consumption', async () => {
  await assert.rejects(readResponse('/test', { timeoutMs: 5, fetchFn: async (_, { signal }) => ({
    ok: true, arrayBuffer: () => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('Stopped', 'AbortError')), { once: true }))
  }) }), /timed out/);
});

test('already stopped runs send no requests', async () => {
  const controller = new AbortController(); controller.abort(); setMaxListeners(0, controller.signal);
  const result = await runPhase({ url: '/test', ...config, signal: controller.signal, fetchFn: async () => { throw new Error('Must not fetch'); } });
  assert.equal(result.started, 0);
  assert.equal(result.status, 'stopped');
});
