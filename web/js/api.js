// Talking to the Python side, and the small event bus the sections share.

const bus = new EventTarget();
export const on = (name, fn) => bus.addEventListener(name, event => fn(event.detail));
export const emit = (name, detail) => bus.dispatchEvent(new CustomEvent(name, { detail }));

async function check(response) {
  if (response.ok) return response;
  const body = await response.json().catch(() => ({}));
  throw new Error(body.detail || body.message || `The server returned ${response.status}.`);
}

export const getJSON = url => fetch(url).then(check).then(r => r.json());

export const postJSON = (url, body = {}) => fetch(url, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
}).then(check).then(r => r.json());

export const del = url => fetch(url, { method: 'DELETE' }).then(check).then(r => r.json());

/** Read a stream of JSON lines (document progress, model downloads). */
export async function readLines(response, onEvent) {
  await check(response);
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    lines.filter(Boolean).forEach(line => onEvent(JSON.parse(line)));
  }
}

/** Ask a question through Gradio's queue. Each yield from Python arrives as one event. */
export async function ask({ question, history, language, onEvent }) {
  const { event_id: id } = await postJSON('/gradio_api/call/ask', { data: [question, history, language] });
  return new Promise(resolve => {
    const source = new EventSource(`/gradio_api/call/ask/${id}`);
    const finish = () => { source.close(); resolve(); };
    source.addEventListener('generating', event => onEvent(JSON.parse(event.data)[0]));
    source.addEventListener('complete', finish);
    source.addEventListener('error', event => {
      // Gradio sends its own "error" event; EventSource fires the same name when the line drops.
      onEvent({ type: 'error', code: 'server', message: 'The connection to the server dropped.', hint: event.data && event.data !== 'null' ? String(event.data).slice(0, 200) : 'Is run.py still running?' });
      finish();
    });
  });
}

// ── Live status, kept fresh for everyone ──
export const status = { llm: { up: false, models: [], provider: 'ollama', model: '' }, embed: {}, index: { vectors: 0, docs: 0 }, online: false };

export async function refreshStatus() {
  try {
    Object.assign(status, await getJSON('/api/status'), { online: true });
  } catch {
    status.online = false;
  }
  emit('status', status);
  return status;
}

export function startStatus() {
  refreshStatus();
  setInterval(() => { if (!document.hidden) refreshStatus(); }, 7000);
}

/** The model is usable when Ollama has it, or an optional provider is selected. */
export function llmReady() {
  const { llm } = status;
  if (llm.provider !== 'ollama') return true;
  return llm.up && llm.models.some(name => name === llm.model || name.split(':')[0] === llm.model.split(':')[0]);
}

export function toast(message, kind = '') {
  const host = document.getElementById('toasts');
  const note = document.createElement('div');
  note.className = `toast ${kind}`;
  note.textContent = message;
  host.append(note);
  setTimeout(() => note.classList.add('out'), 3600);
  setTimeout(() => note.remove(), 4100);
}
