import { LIMITS, validateConfig, targetUrl, readResponse, runPhase } from './load-runner.mjs';

const $ = (id) => document.getElementById(id);
const base = window.PRODUCT_API_BASE || '';
let controller = null, results = [], lastConfig = null;
const labels = { cached: 'Cached', bypass: 'Bypass cache' };
const number = (value) => value.toLocaleString(undefined, { maximumFractionDigits: 1 });
const milliseconds = (value) => value === null ? '-' : number(value) + ' ms';

function badge(text, state = '') { $('run-status').textContent = text; $('run-status').dataset.state = state; }
function message(text) { $('run-message').textContent = text; $('run-message').classList.toggle('hidden', !text); }

async function connect() {
  try {
    const response = await fetch(base + '/api/load-simulation', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('Simulation endpoint unavailable. Restart the updated application.');
    const capabilities = await response.json();
    if (!capabilities.enabled) {
      badge('Disabled');
      $('connection-message').textContent = 'Load simulation is disabled on this server. Enable LOAD_SIMULATION_ENABLED and restart the application.';
      return;
    }
    $('configuration').disabled = false;
    badge('Ready');
    $('connection-message').textContent = 'Connected to ' + (base || location.origin);
    try {
      const response = await fetch(base + '/products/categories', { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error('Could not load categories.');
      const categories = await response.json();
      for (const category of categories) $('load-category').add(new Option(category, category));
    } catch (error) { message(error.message + ' Product-ID experiments are still available.'); }
  } catch (error) { badge('Unavailable', 'error'); $('connection-message').textContent = error.message; }
}

function updateBudget() {
  const total = Number($('load-count').value) * ($('load-mode').value === 'compare' ? 2 : 1);
  $('total-budget').textContent = Number.isFinite(total) ? number(total) : '-';
}

$('target-type').addEventListener('change', () => {
  const category = $('target-type').value === 'category';
  $('product-field').classList.toggle('hidden', category);
  $('category-field').classList.toggle('hidden', !category);
  $('load-product').disabled = category;
  $('load-category').disabled = !category;
  $('load-category').required = category;
  $('load-count').max = category ? LIMITS.categoryRequests : LIMITS.productRequests;
  $('load-concurrency').max = category ? LIMITS.categoryConcurrency : LIMITS.productConcurrency;
  $('load-count').value = category ? 10 : 10000;
  $('load-concurrency').value = category ? 2 : 5;
  updateBudget();
});
$('load-count').addEventListener('input', updateBudget);
$('load-mode').addEventListener('change', updateBudget);
$('stop-run').addEventListener('click', () => { controller?.abort(); $('stop-run').disabled = true; badge('Stopping'); });
window.addEventListener('pagehide', () => controller?.abort());
window.addEventListener('beforeunload', (event) => {
  if (controller) { event.preventDefault(); event.returnValue = ''; }
});

$('load-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (controller) return;
  let config;
  try {
    config = validateConfig({ target: $('target-type').value, mode: $('load-mode').value,
      value: $('target-type').value === 'product' ? $('load-product').value : $('load-category').value,
      count: Number($('load-count').value), concurrency: Number($('load-concurrency').value) });
    if (!$('load-ack').checked) throw new Error('Authorize this load before starting.');
  } catch (error) { message(error.message); return; }

  controller = new AbortController();
  const signal = controller.signal;
  results = []; lastConfig = { ...config, timestamp: new Date().toISOString() };
  $('configuration').disabled = true; $('stop-run').disabled = false; $('export-results').disabled = true;
  $('comparison-result').textContent = '';
  message(''); renderResults(); renderErrors();
  const phases = config.mode === 'compare' ? ['bypass', 'cached'] : [config.mode];
  let completedBefore = 0, bytesBefore = 0;
  const total = config.count * phases.length;
  showLive({ completed: 0, durationMs: 0, throughput: 0, successRate: 0, failed: 0 }, 0, total);
  try {
    badge('Checking target', 'running'); $('phase-title').textContent = 'Checking target';
    $('phase-detail').textContent = config.value;
    const sample = await readResponse(targetUrl(base, config, false), { signal });
    const payload = JSON.parse(new TextDecoder().decode(sample));
    if (config.target === 'category' && (!Array.isArray(payload) || !payload.length)) throw new Error('This category has no products. Choose a populated category.');
    const estimatedBytes = sample.byteLength * total;
    if (estimatedBytes > LIMITS.transferBytes) {
      const max = Math.floor(LIMITS.transferBytes / sample.byteLength / phases.length);
      throw new Error(`Projected response data exceeds 256 MiB. Use at most ${max} requests per run for this target.`);
    }
    for (const mode of phases) {
      if (signal.aborted) break;
      badge('Running', 'running');
      $('phase-title').textContent = labels[mode];
      const url = targetUrl(base, config, mode === 'cached');
      if (mode === 'cached') {
        $('phase-detail').textContent = 'Warming cache';
        for (let i = 0; i < 5; i++) await readResponse(url, { signal });
      }
      $('phase-detail').textContent = config.value + ' / ' + config.concurrency + ' concurrent';
      let live = { completed: 0, durationMs: 0, throughput: 0, successRate: 0, failed: 0 };
      const update = () => showLive(live, completedBefore, total);
      const result = await runPhase({ url, count: config.count, concurrency: config.concurrency, mode, signal,
        maxBytes: LIMITS.transferBytes - bytesBefore,
        onProgress: (snapshot) => { live = snapshot; update(); renderErrors(snapshot); } });
      results.push(result); renderResults(); renderErrors();
      completedBefore += result.completed; bytesBefore += result.bytes;
      if (result.status !== 'completed' || result.failed) {
        message(result.reason || 'This run had request errors. Comparison was not continued.');
        break;
      }
    }
    const allDone = results.length === phases.length && results.every((r) => r.status === 'completed' && !r.failed);
    badge(allDone ? 'Complete' : signal.aborted ? 'Stopped' : 'Incomplete', allDone ? '' : 'error');
    $('phase-title').textContent = allDone ? 'Experiment complete' : 'Experiment stopped';
    if (signal.aborted) message('Stopped. In-flight requests were cancelled; completed results are retained.');
    if (allDone && results.length === 2) {
      const ratio = results[1].throughput / results[0].throughput;
      $('comparison-result').textContent = `Cached throughput / bypass throughput: ${ratio.toFixed(2)}x. ${number(completedBefore)} measured requests completed.`;
    }
  } catch (error) {
    badge(signal.aborted ? 'Stopped' : 'Failed', 'error');
    $('phase-title').textContent = signal.aborted ? 'Experiment stopped' : results.length ? 'Experiment interrupted' : 'Experiment could not start';
    message(signal.aborted ? 'Stopped by user.' : error.message);
  } finally {
    controller = null; $('configuration').disabled = false; $('stop-run').disabled = true;
    $('export-results').disabled = !results.length; $('load-ack').checked = false;
  }
});

function showLive(snapshot, before, total) {
  $('run-progress').max = total; $('run-progress').value = before + snapshot.completed;
  $('progress-label').textContent = number(before + snapshot.completed) + ' / ' + number(total);
  $('metric-duration').textContent = (snapshot.durationMs / 1000).toFixed(1) + ' s';
  $('metric-throughput').textContent = number(snapshot.throughput) + ' req/s';
  $('metric-success').textContent = snapshot.successRate.toFixed(1) + '%';
  $('metric-errors').textContent = number(snapshot.failed);
}

function renderResults() {
  const body = $('results-body'); body.replaceChildren();
  if (!results.length) { const td = body.insertRow().insertCell(); td.colSpan = 7; td.className = 'no-results'; td.textContent = 'No results yet'; return; }
  for (const result of results) {
    const row = body.insertRow();
    for (const value of [labels[result.mode], number(result.completed), (result.durationMs / 1000).toFixed(2) + ' s',
      number(result.throughput), milliseconds(result.averageMs), milliseconds(result.p95Ms), result.successRate.toFixed(1) + '%']) row.insertCell().textContent = value;
    const detail = document.createElement('small'); detail.textContent = result.status + (result.cancelled ? ` / ${result.cancelled} cancelled` : ''); row.cells[0].append(detail);
  }
}

function renderErrors(live) {
  const entries = [...results, ...(live ? [live] : [])];
  const count = entries.reduce((sum, result) => sum + result.failed, 0);
  $('error-count').textContent = number(count) + ' errors';
  const list = $('error-log'); list.replaceChildren();
  if (!count) { const li = document.createElement('li'); li.className = 'no-errors'; li.textContent = 'No errors recorded'; list.append(li); }
  for (const result of entries) for (const error of result.errors) {
    const li = document.createElement('li'); li.textContent = `${labels[result.mode]} / request ${error.request}: ${error.message}`; list.append(li);
  }
}

$('export-results').addEventListener('click', () => {
  const columns = ['timestamp', 'target', 'value', 'concurrency', 'mode', 'status', 'requested', 'completed', 'succeeded', 'failed', 'cancelled', 'durationMs', 'throughput', 'averageMs', 'p95Ms', 'bytes', 'reason'];
  const csvCell = (value) => '"' + String(value ?? '').replace(/^[=+@-]/, "'$&").replaceAll('"', '""') + '"';
  const rows = results.map((result) => ({ ...lastConfig, ...result }));
  const csv = [columns.join(','), ...rows.map((row) => columns.map((key) => csvCell(row[key])).join(','))].join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = 'cache-experiment.csv'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});

connect();
