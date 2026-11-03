// The Marks section: the rubric with live evidence and a Show me button, and the five-question Test Bench.
import { ask, getJSON, on, postJSON, status, toast } from './api.js';
import { go, icon, register } from './book.js';
import { showView } from './engine.js';

const el = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };

const RUBRIC = [
  { name: 'Chatbot Interface', marks: 3, tab: 'chat', spot: '#composer', evidence: () => 'Gradio Server with this page; stock Gradio chat at /classic' },
  { name: 'Document Processing', marks: 4, tab: 'papers', spot: '#stages', evidence: () => `${status.index.docs} paper(s), ${status.index.vectors} chunks` },
  { name: 'Embeddings and Retrieval', marks: 5, tab: 'engine', view: 'lab', spot: '#lab-out', evidence: () => `${status.embed.model?.split('/').pop()}, ${status.embed.dim} numbers, FAISS IndexFlatIP` },
  { name: 'RAG Prompt and Response Generation', marks: 5, tab: 'engine', view: 'prompt', spot: '#prompt-box', evidence: () => `Model: ${status.llm.model}. Two refusal guards` },
  { name: 'Testing and Demonstration', marks: 3, spot: '#bench', evidence: () => 'Five questions below, one not in the document' },
];

const left = el(`<div class="sec">
  <header><h2 class="page-title">Marks</h2><p class="page-sub">Every row of the rubric, and where to see it working.</p></header>
  <div class="scroll grow"><table class="rubric scroll-inner"><thead><tr><th>Parameter</th><th>Marks</th><th></th></tr></thead><tbody id="rubric"></tbody>
    <tfoot><tr><th>Total</th><th>20</th><th></th></tr></tfoot></table></div>
  <a class="btn" href="/classic/" target="_blank" rel="noopener">${icon('chat')}<span>Open the stock Gradio chat</span></a>
</div>`);

const right = el(`<div class="sec">
  <div class="row-between"><h2 class="print">Test Bench</h2>
    <div class="row"><button type="button" class="btn primary" id="run">${icon('play')}<span>Run all five</span></button>
    <button type="button" class="btn" id="save" disabled>${icon('check')}<span>Save report</span></button></div></div>
  <p class="note" id="bench-note">Uses the current model and your papers. The questions suit the sample handbook.</p>
  <div class="scroll grow"><ol class="scroll-inner" id="bench"></ol></div>
</div>`);

const $ = id => left.querySelector(`#${id}`) || right.querySelector(`#${id}`);
let questions = [], results = [];

const isStandIn = () => status.llm.model.startsWith('stand-in');

export function circle(target) {
  const layer = document.getElementById('spot');
  const box = target.getBoundingClientRect();
  layer.innerHTML = `<svg width="100%" height="100%"><ellipse class="pencil" cx="${box.left + box.width / 2}" cy="${box.top + box.height / 2}" rx="${box.width / 2 + 16}" ry="${box.height / 2 + 14}" pathLength="1"/></svg>`;
  setTimeout(() => { layer.innerHTML = ''; }, 2600);
}

function renderRubric() {
  $('rubric').replaceChildren(...RUBRIC.map(row => {
    const tr = el(`<tr><td><b></b><small></small></td><td class="num">${row.marks}</td><td><button type="button" class="btn small">${icon('eye')}<span>Show me</span></button></td></tr>`);
    tr.querySelector('b').textContent = row.name;
    tr.querySelector('small').textContent = row.evidence();
    tr.querySelector('button').addEventListener('click', async () => {
      if (row.tab) await go(row.tab);
      if (row.view) showView(row.view);
      const target = document.querySelector(row.spot);
      if (target) circle(target);
    });
    return tr;
  }));
}

function renderBench() {
  $('bench').replaceChildren(...questions.map((question, i) => {
    const row = el(`<li class="test" data-i="${i}" data-state="wait"><div class="row-between"><b></b><span class="verdict"></span></div><p class="test-a"></p></li>`);
    row.querySelector('b').textContent = `${i + 1}. ${question.q}`;
    row.querySelector('.test-a').textContent = question.answerable ? '' : 'Not in the document: it should refuse.';
    return row;
  }));
}

async function runAll() {
  if (!status.index.docs) { toast('Add a paper first.', 'bad'); return; }
  $('run').disabled = true;
  $('save').disabled = true;
  results = [];
  renderBench();
  for (const [i, question] of questions.entries()) {
    const row = $('bench').children[i], out = row.querySelector('.test-a');
    row.dataset.state = 'now';
    out.textContent = '';
    let done = null, failure = null, sources = [];
    await ask({
      question: question.q, history: [], language: 'english',
      onEvent: event => {
        if (event.type === 'sources') sources = event.hits.filter(hit => hit.used);
        if (event.type === 'token') out.textContent += event.text;
        if (event.type === 'done') done = event;
        if (event.type === 'error') failure = event;
      },
    });
    if (failure) {
      row.dataset.state = 'fail';
      out.textContent = `${failure.message} ${failure.hint || ''}`;
      row.querySelector('.verdict').textContent = 'STOPPED';
      $('run').disabled = false;
      return;
    }
    const { passed } = await postJSON('/api/verdict', { question, answer: done.answer, refused: done.refused });
    row.dataset.state = passed ? 'pass' : 'fail';
    row.querySelector('.verdict').textContent = passed ? 'PASS' : 'FAIL';
    results.push({ ...question, answer: done.answer, passed, guard: done.guard, sources });
  }
  $('run').disabled = false;
  $('save').disabled = isStandIn();
  $('bench-note').textContent = isStandIn()
    ? 'This ran on the stand-in, not a real model, so it cannot be saved as a report.'
    : `Passed ${results.filter(r => r.passed).length} of ${results.length}.`;
}

export function startMarks() {
  $('run').addEventListener('click', runAll);
  $('save').addEventListener('click', async () => {
    const { path } = await postJSON('/api/report', { results, model: status.llm.model });
    toast(`Saved to ${path}`);
  });
  on('status', renderRubric);
  register('marks', {
    left, right,
    prepare: async () => { if (!questions.length) { questions = await getJSON('/api/questions').catch(() => []); renderBench(); } renderRubric(); },
  });
}
