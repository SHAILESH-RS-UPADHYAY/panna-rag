// The Engine section: the last question's real journey, a Retrieval Lab, a map of the index and the prompt.
import { getJSON, on, postJSON, status, toast } from './api.js';
import { icon, register } from './book.js';

const el = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };

const NODES = [
  ['question', 'Your question', 'Waiting for one'],
  ['embed', 'Embedding', 'all-MiniLM-L6-v2'],
  ['faiss', 'FAISS search', 'IndexFlatIP, cosine similarity'],
  ['gate', 'Score gate', 'Guard 1: is anything close enough?'],
  ['prompt', 'Prompt', 'Guard 2: the rules plus the passages'],
  ['model', 'Language model', 'Ollama by default'],
  ['answer', 'Answer', 'Written with citations'],
];

const left = el(`<div class="sec">
  <header><h2 class="page-title">Engine</h2><p class="page-sub">What happened to your last question, with real numbers.</p></header>
  <div class="scroll grow"><ol class="scroll-inner flow" id="flow">
    ${NODES.map(([id, name, note]) => `<li class="node" data-node="${id}"><i></i><div><b>${name}</b><small data-v>${note}</small></div></li>`).join('')}
  </ol></div>
  <div class="knobs">
    <label class="knob"><span>Top-k <b id="k-v"></b></span><input type="range" id="k" min="1" max="10" step="1"></label>
    <label class="knob"><span>Score gate <b id="gate-v"></b></span><input type="range" id="gate" min="0" max=".8" step=".01"></label>
    <label class="knob"><span>Temperature <b id="temp-v"></b></span><input type="range" id="temp" min="0" max="1" step=".05"></label>
  </div>
</div>`);

const right = el(`<div class="sec">
  <div class="seg" id="views" role="group" aria-label="Engine views">
    <button type="button" data-view="lab" aria-pressed="true">Retrieval Lab</button>
    <button type="button" data-view="map" aria-pressed="false">Index map</button>
    <button type="button" data-view="prompt" aria-pressed="false">The prompt</button>
  </div>
  <section class="view" data-view="lab">
    <form class="row" id="lab-form">
      <input class="field" id="lab-q" value="What is the fine for returning a book late?" aria-label="Question for the Retrieval Lab">
      <button class="btn primary" type="submit">${icon('search')}<span>Search</span></button>
    </form>
    <div class="scroll grow"><div class="scroll-inner" id="lab-out"></div></div>
  </section>
  <section class="view" data-view="map" hidden>
    <p class="note">Each dot is one chunk: 384 numbers squeezed flat with PCA. Nearby dots mean similar text. The star is your last search.</p>
    <div class="map-wrap" id="map-wrap"></div>
  </section>
  <section class="view" data-view="prompt" hidden>
    <div class="scroll grow"><div class="scroll-inner">
      <p class="print small">What the model was told last</p>
      <div id="prompt-box"></div>
    </div></div>
  </section>
</div>`);

const $ = id => left.querySelector(`#${id}`) || right.querySelector(`#${id}`);
let lastRun = null, defaults = '', lastMap = null, lastHits = [];

function setNode(id, value, state = 'done') {
  const row = $('flow').querySelector(`[data-node="${id}"]`);
  row.dataset.state = state;
  if (value) row.querySelector('[data-v]').textContent = value;
}

function paintRun() {
  const run = lastRun;
  if (!run) { setNode('faiss', `${status.index.vectors} vectors in IndexFlatIP`, ''); return; }
  setNode('question', `"${run.question.slice(0, 70)}"`);
  setNode('embed', `${status.embed.model?.split('/').pop()} · ${status.embed.dim} numbers`);
  if (run.search) setNode('faiss', `Searched ${run.search.searched} vectors in ${run.search.ms} ms`);
  if (run.sources) {
    const best = run.sources.hits[0]?.score ?? 0, used = run.sources.hits.filter(hit => hit.used).length;
    setNode('gate', `Best ${best.toFixed(3)} against ${run.sources.threshold.toFixed(2)}: ${run.sources.passed ? `${used} passed` : 'stopped here'}`, run.sources.passed ? 'done' : 'stop');
    if (!run.sources.passed) { setNode('prompt', 'Not needed', 'skip'); setNode('model', 'Not called', 'skip'); }
  }
  if (run.prompt) {
    setNode('prompt', `${run.prompt.messages.length} messages · temperature ${run.prompt.temperature}`);
    setNode('model', run.prompt.model, run.error ? 'stop' : 'done');
  }
  if (run.done) setNode('answer', run.done.refused ? `Refused by the ${run.done.guard} guard` : `${run.done.answer.split(/\s+/).length} words in ${(run.done.ms / 1000).toFixed(1)} s`, run.done.refused ? 'stop' : 'done');
  if (run.error) setNode('answer', run.error.message, 'stop');
}

async function runLab(event) {
  event?.preventDefault();
  const q = $('lab-q').value.trim(), host = $('lab-out');
  if (!q) return;
  if (!status.index.vectors) { host.replaceChildren(el('<p class="note">Add a paper first, so there is something to search.</p>')); return; }
  let data;
  try { data = await postJSON('/api/search', { q, k: 8 }); } catch (err) { toast(err.message, 'bad'); return; }
  host.replaceChildren();
  const max = Math.max(...data.vector.map(Math.abs)) || 1;
  const strip = el(`<div class="vector" role="img" aria-label="The ${data.vector.length} numbers of this question"></div>`);
  strip.innerHTML = data.vector.map(value => `<i class="${value < 0 ? 'neg' : 'pos'}" style="opacity:${(Math.abs(value) / max).toFixed(2)}"></i>`).join('');
  host.append(el(`<p class="print small">Your question as ${data.vector.length} numbers</p>`), strip, el('<p class="print small">Nearest chunks by cosine similarity</p>'));
  data.hits.forEach((hit, i) => {
    const used = i < data.top_k && hit.score >= data.threshold;
    const row = el(`<article class="chunk ${used ? '' : 'faded'}"><header><b>${hit.rank}</b><span></span><em></em></header>
      <div class="meter"><i style="--v:${Math.max(0, hit.score)}"></i><u style="--v:${data.threshold}"></u><em></em></div><p></p></article>`);
    row.querySelector('span').textContent = `${hit.doc} · page ${hit.page}`;
    row.querySelector('header em').textContent = used ? 'goes to the model' : (i >= data.top_k ? `past top ${data.top_k}` : 'under the gate');
    row.querySelector('.meter em').textContent = hit.score.toFixed(3);
    row.querySelector('p').textContent = hit.text;
    host.append(row);
  });
  lastMap = data.map;
  lastHits = data.hits.slice(0, data.top_k);
  drawMap();
}

function drawMap() {
  const wrap = $('map-wrap');
  if (!lastMap?.points?.length) { wrap.replaceChildren(el('<p class="note">Add a paper to see its map.</p>')); return; }
  const px = x => 200 + x * 175, py = y => 130 - y * 110;
  const near = new Set(lastHits.map(hit => hit.id)), query = lastMap.query;
  const lines = query ? lastHits.map(hit => { const p = lastMap.points[hit.id]; return p ? `<line x1="${px(query.x)}" y1="${py(query.y)}" x2="${px(p.x)}" y2="${py(p.y)}"/>` : ''; }).join('') : '';
  const dots = lastMap.points.map(p => `<circle class="${near.has(p.id) ? 'near' : ''}" cx="${px(p.x)}" cy="${py(p.y)}" r="${near.has(p.id) ? 6.5 : 4.5}"/>`).join('');
  const mark = query ? `<path class="q-star" transform="translate(${px(query.x)} ${py(query.y)})" d="M0 -12L3.2 -3.6L12 -3.6L5 1.8L7.4 10.4L0 5.4L-7.4 10.4L-5 1.8L-12 -3.6L-3.2 -3.6Z"/>` : '';
  wrap.innerHTML = `<svg class="map" viewBox="0 0 400 260" role="img" aria-label="Map of ${lastMap.points.length} chunks">${lines}${dots}${mark}</svg>`;
}

function paintPrompt() {
  const box = $('prompt-box');
  box.replaceChildren();
  const messages = lastRun?.prompt?.messages || [{ role: 'system', content: defaults }];
  messages.forEach(message => {
    const block = el('<div class="msg"><span class="print small"></span><pre></pre></div>');
    block.querySelector('span').textContent = message.role;
    const pre = block.querySelector('pre');
    message.content.split('\n').forEach(line => {
      if (message.role === 'system' && /only|never|exactly|could not find/i.test(line)) {
        const mark = document.createElement('mark');
        mark.textContent = line;
        pre.append(mark, '\n');
      } else pre.append(`${line}\n`);
    });
    box.append(block);
  });
}

export function showView(name) {
  right.querySelectorAll('#views button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === name)));
  right.querySelectorAll('.view').forEach(v => { v.hidden = v.dataset.view !== name; });
  if (name === 'map') drawMap();
  if (name === 'prompt') paintPrompt();
  if (name === 'lab' && !$('lab-out').children.length) runLab();
}

function paintKnobs() {
  $('k-v').textContent = $('k').value;
  $('gate-v').textContent = Number($('gate').value).toFixed(2);
  $('temp-v').textContent = Number($('temp').value).toFixed(2);
}

async function prepare() {
  const settings = await getJSON('/api/settings');
  defaults = settings.default_system_prompt.replace('{refusal}', 'I could not find this in the document.');
  $('k').value = settings.top_k;
  $('gate').value = settings.min_score;
  $('temp').value = settings.temperature;
  paintKnobs();
  if (!lastMap?.query) lastMap = await getJSON('/api/map');
  paintRun();
  paintPrompt();
  drawMap();
  if (!$('lab-out').children.length) await runLab();
}

export function startEngine() {
  right.querySelector('#views').addEventListener('click', event => {
    const view = event.target.closest('button')?.dataset.view;
    if (view) showView(view);
  });
  $('lab-form').addEventListener('submit', runLab);
  let timer = 0;
  ['k', 'gate', 'temp'].forEach(id => $(id).addEventListener('input', () => {
    paintKnobs();
    clearTimeout(timer);
    timer = setTimeout(() => postJSON('/api/settings', { top_k: Number($('k').value), min_score: Number($('gate').value), temperature: Number($('temp').value) }).catch(err => toast(err.message, 'bad')), 250);
  }));
  on('run', run => { lastRun = run; paintRun(); paintPrompt(); });
  on('docs-changed', () => { lastMap = null; lastHits = []; $('lab-out').replaceChildren(); });
  register('engine', { left, right, prepare: () => prepare().catch(() => {}) });
}
