// The Papers section: upload, each stage of reading with real numbers, and the Chunk Explorer.
import { del, emit, getJSON, on, postJSON, readLines, refreshStatus, toast } from './api.js';
import { go, icon, register } from './book.js';
import { setMood } from './mascot.js';

const el = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };

const left = el(`<div class="sec">
  <header><h2 class="page-title">Papers</h2><p class="page-sub">Add one PDF or TXT with at least two pages. It is read on this laptop.</p></header>
  <label class="tray" id="tray">
    <input type="file" id="file" accept=".pdf,.txt" class="sr">
    ${icon('clip')}<b>Drop a paper here</b><span>or click to choose a PDF or TXT, up to 25 MB</span>
  </label>
  <button type="button" class="btn" id="sample">${icon('file')}<span>Use the sample handbook</span></button>
  <p class="print small">In this register</p>
  <div class="scroll grow"><ul class="scroll-inner" id="doc-list"></ul></div>
</div>`);

const right = el(`<div class="sec">
  <h2 class="print">How the paper is read</h2>
  <ol class="stages" id="stages">
    ${[['extract', 'Extract', 'Text, page by page'], ['chunk', 'Chunk', 'Overlapping pieces'], ['embed', 'Embed', 'Sentence Transformers'], ['store', 'Store', 'FAISS index']].map(([id, name, what], i) => `
      <li class="stage" data-stage="${id}" data-state="wait"><span class="stage-n">${i + 1}</span><div><b>${name}</b><small>${what}</small></div><div class="stage-num"><strong data-num></strong> <small data-unit></small><small data-ms></small></div></li>`).join('')}
  </ol>
  <div class="knobs">
    <label class="knob"><span>Chunk size <b id="size-v"></b></span><input type="range" id="size" min="200" max="1500" step="50"></label>
    <label class="knob"><span>Overlap <b id="over-v"></b></span><input type="range" id="over" min="0" max="300" step="10"></label>
    <button type="button" class="btn small" id="rechunk">${icon('refresh')}<span>Cut again</span></button>
  </div>
  <div class="row-between"><h3 class="print" id="explorer-title">Chunk Explorer</h3><small class="note"><mark>highlighted</mark> text is shared with the piece before</small></div>
  <div class="scroll grow" id="explorer"><div class="scroll-inner" id="chunks"></div></div>
</div>`);

const $ = id => left.querySelector(`#${id}`) || right.querySelector(`#${id}`);
let docs = [], selected = null, busy = false;

function setStage(id, state, num, unit, ms) {
  const row = $('stages').querySelector(`[data-stage="${id}"]`);
  row.dataset.state = state;
  if (num !== undefined) row.querySelector('[data-num]').textContent = num.toLocaleString();
  if (unit !== undefined) row.querySelector('[data-unit]').textContent = unit;
  if (ms !== undefined) row.querySelector('[data-ms]').textContent = ` · ${ms} ms`;
}

function handleEvent(event) {
  if (event.stage === 'start') {
    ['extract', 'chunk', 'embed', 'store'].forEach(id => setStage(id, 'wait', '', '', ''));
    $('stages').querySelectorAll('[data-ms]').forEach(node => { node.textContent = ''; });
    setStage('extract', 'now');
  }
  if (event.stage === 'extract') { setStage('extract', 'done', event.pages, event.pages === 1 ? 'page' : 'pages', event.ms); setStage('chunk', 'now'); }
  if (event.stage === 'chunk') { setStage('chunk', 'done', event.chunks, 'chunks', event.ms); setStage('embed', 'now'); }
  if (event.stage === 'embed') { setStage('embed', 'done', event.dim, 'numbers each', event.ms); setStage('store', 'now'); }
  if (event.stage === 'store') setStage('store', 'done', event.total, 'vectors', event.ms);
}

async function ingest(request, label) {
  if (busy) return;
  busy = true;
  setMood('think');
  let finished = null, problem = null;
  try {
    await readLines(await request(), event => {
      handleEvent(event);
      if (event.stage === 'done') finished = event.doc;
      if (event.stage === 'error') problem = event.message;
    });
  } catch (err) { problem = err.message; }
  busy = false;
  if (problem) { setMood('sad', 2500); toast(problem, 'bad'); return; }
  setMood('happy', 1200);
  if (finished) selected = finished.id;
  await loadDocs();
  await refreshStatus();
  emit('docs-changed');
  toast(label);
}

function uploadFile(file) {
  const form = new FormData();
  form.append('file', file);
  ingest(() => fetch('/api/docs', { method: 'POST', body: form }), `${file.name} is in the register.`);
}

function renderDocs() {
  const list = $('doc-list');
  list.replaceChildren();
  if (!docs.length) list.append(el('<li class="note">Nothing here yet.</li>'));
  docs.forEach(doc => {
    const row = el(`<li class="doc ${doc.id === selected ? 'on' : ''}">
      <button type="button" class="doc-open"><span class="doc-icon">${doc.suffix === '.pdf' ? 'PDF' : 'TXT'}</span><span class="doc-text"><b></b><small></small></span></button>
      <button type="button" class="icon-btn" aria-label="Remove this paper">${icon('trash')}</button>
    </li>`);
    row.querySelector('b').textContent = doc.name;
    row.querySelector('small').textContent = `${doc.pages} page${doc.pages === 1 ? '' : 's'} · ${doc.chunks} chunks · ${Math.ceil(doc.size / 1024)} KB${doc.pages < 2 ? ' · the brief asks for two pages' : ''}`;
    row.querySelector('.doc-open').addEventListener('click', () => { selected = doc.id; renderDocs(); loadChunks(); });
    row.querySelector('.icon-btn').addEventListener('click', async () => {
      await del(`/api/docs/${doc.id}`);
      await loadDocs();
      await refreshStatus();
      emit('docs-changed');
    });
    list.append(row);
  });
}

async function loadChunks() {
  const host = $('chunks');
  host.replaceChildren();
  $('explorer-title').textContent = 'Chunk Explorer';
  if (!selected) { host.append(el('<p class="note">Add a paper and its chunks appear here.</p>')); return; }
  const chunks = await getJSON(`/api/docs/${selected}/chunks`);
  $('explorer-title').textContent = `Chunk Explorer · ${chunks.length} pieces`;
  chunks.forEach((chunk, i) => {
    const card = el('<article class="chunk"><header><b></b><span></span><em></em></header><p></p></article>');
    card.querySelector('b').textContent = `#${i + 1}`;
    card.querySelector('span').textContent = chunk.page_end !== chunk.page ? `pages ${chunk.page}-${chunk.page_end}` : `page ${chunk.page}`;
    card.querySelector('em').textContent = `${chunk.text.length} chars`;
    const body = card.querySelector('p');
    if (chunk.overlap > 0) {
      const shared = document.createElement('mark');
      shared.textContent = chunk.text.slice(0, chunk.overlap);
      body.append(shared, chunk.text.slice(chunk.overlap));
    } else body.textContent = chunk.text;
    host.append(card);
  });
}

async function loadDocs() {
  docs = await getJSON('/api/docs');
  if (!docs.some(doc => doc.id === selected)) selected = docs[docs.length - 1]?.id ?? null;
  renderDocs();
  await loadChunks();
}

function paintKnobs() {
  $('size-v').textContent = $('size').value;
  $('over-v').textContent = $('over').value;
}

async function prepare() {
  const settings = await getJSON('/api/settings');
  $('size').value = settings.chunk_size;
  $('over').value = settings.chunk_overlap;
  paintKnobs();
  await loadDocs();
}

export function startPapers() {
  $('file').addEventListener('change', event => { if (event.target.files[0]) uploadFile(event.target.files[0]); event.target.value = ''; });
  const useSample = () => ingest(() => fetch('/api/docs/sample', { method: 'POST' }), 'The sample handbook is in the register.');
  $('sample').addEventListener('click', useSample);
  on('use-sample', useSample);
  addEventListener('dragover', event => { event.preventDefault(); $('tray').classList.add('over'); });
  addEventListener('dragleave', event => { if (!event.relatedTarget) $('tray').classList.remove('over'); });
  addEventListener('drop', event => {
    event.preventDefault();
    $('tray').classList.remove('over');
    const file = event.dataTransfer?.files[0];
    if (file) go('papers').then(() => uploadFile(file));
  });
  $('size').addEventListener('input', paintKnobs);
  $('over').addEventListener('input', paintKnobs);
  $('rechunk').addEventListener('click', async () => {
    try {
      await postJSON('/api/settings', { chunk_size: Number($('size').value), chunk_overlap: Number($('over').value) });
    } catch (err) { toast(err.message, 'bad'); return; }
    ingest(() => fetch('/api/reindex', { method: 'POST' }), 'Every paper has been cut again.');
  });
  register('papers', { left, right, prepare: () => prepare().catch(() => {}) });
}
