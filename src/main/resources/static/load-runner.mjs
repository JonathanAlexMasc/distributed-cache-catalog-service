export const LIMITS = Object.freeze({
  productRequests: 100000, categoryRequests: 1000,
  productConcurrency: 20, categoryConcurrency: 4,
  transferBytes: 256 * 1024 * 1024,
  requestTimeoutMs: 10000, phaseTimeoutMs: 120000, maxErrors: 20
});

export function validateConfig(config) {
  if (!['product', 'category'].includes(config.target)) throw new Error('Choose a target.');
  if (!['cached', 'bypass', 'compare'].includes(config.mode)) throw new Error('Choose a cache mode.');
  if (!config.value?.trim()) throw new Error(config.target === 'product' ? 'Enter a product ID.' : 'Choose a category.');
  const maxCount = LIMITS[config.target + 'Requests'];
  const maxConcurrency = LIMITS[config.target + 'Concurrency'];
  if (!Number.isInteger(config.count) || config.count < 1 || config.count > maxCount) {
    throw new Error(`Requests must be an integer between 1 and ${maxCount.toLocaleString()}.`);
  }
  if (!Number.isInteger(config.concurrency) || config.concurrency < 1 || config.concurrency > maxConcurrency) {
    throw new Error(`Concurrency must be an integer between 1 and ${maxConcurrency}.`);
  }
  return { ...config, value: config.value.trim() };
}

export function targetUrl(base, config, useCache) {
  const path = config.target === 'product'
    ? '/api/load-simulation/products/' + encodeURIComponent(config.value)
    : '/api/load-simulation/category';
  const query = new URLSearchParams({ useCache: String(useCache) });
  if (config.target === 'category') query.set('category', config.value);
  return base.replace(/\/$/, '') + path + '?' + query;
}

export async function readResponse(url, { signal, fetchFn = fetch, timeoutMs = LIMITS.requestTimeoutMs } = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  try {
    const response = await fetchFn(url, { cache: 'no-store', signal: controller.signal, headers: { Accept: 'application/json' } });
    const body = await response.arrayBuffer();
    if (!response.ok) throw new Error(`HTTP ${response.status}${response.status === 404 ? ': target not found' : ''}`);
    return body;
  } catch (error) {
    if (timedOut) throw new Error('Request timed out.');
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}

// Workers claim one request at a time; no array of thousands of pending fetches.
export async function runPhase({ url, count, concurrency, mode, signal, onProgress = () => {},
  fetchFn = fetch, maxBytes = LIMITS.transferBytes, timeoutMs = LIMITS.requestTimeoutMs,
  phaseTimeoutMs = LIMITS.phaseTimeoutMs }) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  const startedAt = performance.now();
  let started = 0, completed = 0, succeeded = 0, failed = 0, bytes = 0, reason = '';
  const latencies = [], errors = [];
  const stop = (message) => { reason ||= message; controller.abort(); };
  const snapshot = () => {
    const durationMs = performance.now() - startedAt;
    return { mode, requested: count, started, completed, succeeded, failed, bytes, durationMs,
      throughput: durationMs > 0 ? completed * 1000 / durationMs : 0,
      successRate: completed ? succeeded * 100 / completed : 0, errors: [...errors] };
  };
  const timer = setTimeout(() => stop('Two-minute run limit reached.'), phaseTimeoutMs);
  const progress = setInterval(() => onProgress(snapshot()), 200);
  async function worker() {
    while (!controller.signal.aborted && started < count) {
      const requestNumber = ++started;
      const start = performance.now();
      try {
        const body = await readResponse(url, { signal: controller.signal, fetchFn, timeoutMs });
        bytes += body.byteLength;
        succeeded++;
        completed++;
        latencies.push(performance.now() - start);
        if (bytes > maxBytes) stop('Transfer budget reached.');
      } catch (error) {
        if (controller.signal.aborted) break;
        failed++;
        completed++;
        if (errors.length < LIMITS.maxErrors) errors.push({ request: requestNumber, message: error.message });
        if (failed >= LIMITS.maxErrors) stop('Stopped after 20 request errors.');
      }
    }
  }
  try {
    await Promise.all(Array.from({ length: Math.min(concurrency, count) }, worker));
  } finally {
    clearInterval(progress);
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
  latencies.sort((a, b) => a - b);
  const result = {
    ...snapshot(), status: controller.signal.aborted ? 'stopped' : 'completed',
    reason: reason || (signal?.aborted ? 'Stopped by user.' : ''),
    cancelled: started - completed,
    averageMs: latencies.length ? latencies.reduce((sum, n) => sum + n, 0) / latencies.length : null,
    p95Ms: latencies.length ? latencies[Math.ceil(latencies.length * .95) - 1] : null
  };
  onProgress(result);
  return result;
}
