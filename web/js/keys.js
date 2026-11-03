// The Keys section: Ollama (the default, no key) on the left, optional free-tier keys on the right.
import { getJSON, on, postJSON, del, readLines, refreshStatus, status, toast } from './api.js';
import { icon, register } from './book.js';

const el = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };

const left = el(`<div class="sec">
  <header><h2 class="page-title">Keys</h2><p class="page-sub">No key is needed. Ollama runs the model on this laptop, for free.</p></header>
  <article class="card" id="ollama">
    <div class="row-between"><b class="print">Ollama</b><span class="llm-status" id="o-state"><i class="dot"></i><span></span></span></div>
    <ol class="guide" id="o-guide">
      <li>Install it from <code>ollama.com/download</code></li>
      <li>Download a model: <code>ollama pull llama3.2</code></li>
      <li>On a slow laptop use <code>llama3.2:1b</code></li>
    </ol>
    <div class="row"><input class="field" id="o-model" list="o-models" aria-label="Ollama model"><datalist id="o-models"></datalist>
      <button type="button" class="btn" id="o-pull">Pull</button><button type="button" class="btn primary" id="o-use">Use</button></div>
    <div class="bar" id="o-bar" hidden><i></i></div>
    <small class="note" id="o-note"></small>
  </article>
  <article class="locked-note"><svg class="padlock" viewBox="0 0 40 46" aria-hidden="true"><path class="shackle" d="M11 21V13a9 9 0 0 1 18 0v8"/><rect x="5" y="20" width="30" height="23" rx="5"/><circle cx="20" cy="31" r="3.5"/></svg>
    <p>Keys stay on this laptop in <code>data/keys.json</code>. The page only ever sees the last four characters.</p></article>
</div>`);

const right = el(`<div class="sec">
  <h2 class="print">Optional online providers</h2>
  <div class="scroll grow"><div class="scroll-inner" id="providers"></div></div>
</div>`);

const $ = id => left.querySelector(`#${id}`) || right.querySelector(`#${id}`);

function paintOllama() {
  const { llm } = status;
  const state = $('o-state');
  state.dataset.state = llm.up ? 'on' : 'off';
  state.querySelector('span').textContent = llm.up ? 'Running' : 'Not running';
  $('o-models').innerHTML = '';
  llm.models.forEach(name => $('o-models').append(Object.assign(document.createElement('option'), { value: name })));
  if (!$('o-model').value) $('o-model').value = llm.provider === 'ollama' ? llm.model : 'llama3.2';
  $('o-note').textContent = llm.provider === 'ollama' ? `In use now: ${llm.model}` : `In use now: ${llm.provider}, ${llm.model}`;
}

async function useProvider(provider, model) {
  if (!model) { toast('Choose a model first.', 'bad'); return; }
  await postJSON('/api/settings', { provider, model });
  await refreshStatus();
  toast(`Now answering with ${model}.`);
  loadProviders();
}

async function pull() {
  const model = $('o-model').value.trim();
  if (!model) return;
  const bar = $('o-bar');
  bar.hidden = false;
  try {
    await readLines(await fetch('/api/pull', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model }) }), line => {
      if (line.error) throw new Error(line.error);
      if (line.total) bar.firstElementChild.style.transform = `scaleX(${(line.completed || 0) / line.total})`;
      $('o-note').textContent = line.status || '';
    });
    await refreshStatus();
    toast(`${model} is ready.`);
  } catch (err) { toast(err.message, 'bad'); }
  bar.hidden = true;
}

function card(id, info) {
  const node = el(`<article class="card key-tag ${info.saved ? 'sealed' : ''}">
    <div class="row-between"><b class="print"></b><small class="note free"></small></div>
    <ol class="guide"></ol>
    ${info.needs_base ? '<input class="field base" placeholder="https://your-provider/v1" aria-label="Base URL">' : ''}
    <div class="row"><input class="field secret" type="password" autocomplete="off" aria-label="API key">
      <button type="button" class="btn primary save">Save</button></div>
    <div class="row used" ${info.saved ? '' : 'hidden'}><input class="field model" placeholder="Model name" aria-label="Model"><datalist></datalist>
      <button type="button" class="btn use">Use</button><button type="button" class="icon-btn remove" aria-label="Remove key">${icon('trash')}</button></div>
    <small class="note msg-line"></small>
  </article>`);
  node.querySelector('b').textContent = info.name;
  node.querySelector('.free').textContent = info.free;
  info.steps.forEach(step => node.querySelector('.guide').append(Object.assign(document.createElement('li'), { textContent: step })));
  const secret = node.querySelector('.secret'), message = node.querySelector('.msg-line'), modelBox = node.querySelector('.model'), options = node.querySelector('datalist');
  options.id = `models-${id}`;
  modelBox.setAttribute('list', options.id);
  secret.placeholder = info.saved ? `Saved, ending in ${info.last4}` : 'Paste your key';
  if (info.needs_base) node.querySelector('.base').value = info.base;
  if (status.llm.provider === id) modelBox.value = status.llm.model;
  const fill = models => {
    options.replaceChildren(...(models || []).map(value => Object.assign(document.createElement('option'), { value })));
    if (!modelBox.value && models?.length) modelBox.value = models[0];
  };
  node.querySelector('.save').addEventListener('click', async () => {
    const response = await fetch(`/api/keys/${id}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: secret.value, base: node.querySelector('.base')?.value || '' }) });
    const result = await response.json();
    if (!response.ok) { message.textContent = `${result.message} ${result.hint || ''}`; return; }
    secret.value = '';
    secret.placeholder = 'Saved';
    message.textContent = result.message;
    node.classList.add('sealed', 'sealing');
    node.querySelector('.used').hidden = false;
    fill(result.models);
  });
  node.querySelector('.use').addEventListener('click', () => useProvider(id, modelBox.value.trim()));
  node.querySelector('.remove').addEventListener('click', async () => {
    await del(`/api/keys/${id}`);
    await refreshStatus();
    loadProviders();
  });
  return node;
}

async function loadProviders() {
  const all = await getJSON('/api/keys');
  $('providers').replaceChildren(...Object.entries(all).map(([id, info]) => card(id, info)));
}

export function startKeys() {
  $('o-pull').addEventListener('click', pull);
  $('o-use').addEventListener('click', () => useProvider('ollama', $('o-model').value.trim()));
  on('status', paintOllama);
  register('keys', { left, right, prepare: () => loadProviders().catch(() => {}), enter: paintOllama });
}
