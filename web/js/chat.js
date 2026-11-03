// The Chat section. Left page: the companion, sources and index. Right page: the conversation.
import { ask, emit, getJSON, llmReady, on, status, toast } from './api.js';
import { current, icon, register, turnPage } from './book.js';
import { dayOf, greeting, longDate, mountClock, timeOf } from './clock.js';
import { createWriter, highlightBest, inkComposer, writeInstant } from './ink.js';
import { mountMascot, setMood } from './mascot.js';
import { prefs, reducedMotion, setPrefs } from './prefs.js';

const KEY = 'panna.pages.v1';
const load = () => {
  try { const saved = JSON.parse(localStorage.getItem(KEY)); if (saved?.pages?.length) return saved; } catch { /* start fresh */ }
  return { pages: [{ id: Date.now(), created: Date.now(), entries: [] }], open: 0 };
};
const notebook = load();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(notebook)); } catch { /* storage full or blocked */ } };
const page = () => notebook.pages[notebook.open];
const pageTitle = p => p.entries[0]?.q || 'A blank page';

const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };

const left = el(`<div class="chat-left">
  <header class="brand">
    <div class="brand-mascot" id="brand-mascot"></div>
    <div class="brand-text">
      <h1 class="brand-name" id="brand-name"></h1>
      <button type="button" class="llm-status" id="llm-status" data-state="off"><i class="dot"></i><span id="llm-text">Checking the lamp</span></button>
    </div>
  </header>
  <div class="seg left-tabs" role="group" aria-label="Left page">
    <button type="button" data-pane="sources" aria-pressed="true">Source text</button>
    <button type="button" data-pane="index" aria-pressed="false">Index of pages</button>
  </div>
  <div class="lamp-beam" aria-hidden="true"></div>
  <div class="scroll pane" data-pane="sources" id="pane-sources"><div class="scroll-inner" id="sources"></div></div>
  <div class="scroll pane" data-pane="index" id="pane-index" hidden><div class="scroll-inner" id="index"></div></div>
  <footer class="left-foot" id="left-foot"></footer>
</div>`);

const right = el(`<div class="chat-right">
  <header class="page-head">
    <div class="folio-no"><span class="print small">Page No.</span><b id="page-no"></b></div>
    <div id="clock"></div>
    <button type="button" class="btn new-page" id="new-page" title="Turn to a fresh page">${icon('plus')}<span>New page</span></button>
  </header>
  <div class="ledger-cols" aria-hidden="true"><span>Date</span><span>Particulars</span><span>Folio</span></div>
  <div class="scroll lined entries" id="entries-scroll"><div class="scroll-inner" id="entries" role="log" aria-live="polite" aria-label="Conversation"></div></div>
  <form class="composer" id="composer">
    <div class="c-tools">
      <div class="seg lang" role="group" aria-label="Answer language">
        <button type="button" data-lang="english" aria-pressed="false">English</button>
        <button type="button" data-lang="hinglish" aria-pressed="false">Hinglish</button>
        <button type="button" data-lang="hindi" aria-pressed="false">हिंदी</button>
      </div>
      <span class="c-doc" id="c-doc"></span>
    </div>
    <div class="c-line">
      <div class="c-field" id="c-field">
        <div class="mirror" id="mirror" aria-hidden="true"></div>
        <textarea id="q" rows="1" maxlength="2000" placeholder="Write your question on this line..." aria-label="Your question"></textarea>
      </div>
      <button type="submit" class="send" id="send" aria-label="Send">${icon('send')}</button>
    </div>
  </form>
</div>`);

const $ = (id) => (left.querySelector(`#${id}`) || right.querySelector(`#${id}`));
let writing = false, composer, suggestions = [];

// ── Rendering ──
function renderEntry(entry, index) {
  const when = new Date(entry.at);
  const node = el(`<article class="entry" data-i="${index}">
    <div class="e-date"><time></time><time></time></div>
    <div class="e-main">
      <div class="q"><span class="tag" aria-hidden="true">Q.</span><div class="q-text"></div></div>
      <div class="steps" hidden></div>
      <div class="a"><span class="tag" aria-hidden="true">A.</span><div class="a-text"></div></div>
      <div class="problem" hidden></div>
      <div class="slips"></div>
      <div class="e-meta"></div>
    </div>
    <div class="e-folio"></div>
  </article>`);
  const times = node.querySelectorAll('.e-date time');
  times[0].textContent = dayOf(when);
  times[1].textContent = timeOf(when);
  node.querySelector('.q-text').textContent = entry.q;
  return node;
}

function finishedEntry(entry, index) {
  const node = renderEntry(entry, index);
  const answer = node.querySelector('.a-text');
  if (entry.a) writeInstant(answer, entry.a);
  else node.querySelector('.a').hidden = true;
  if (entry.error) showProblem(node, entry.error);
  dressAnswer(node, entry, false);
  return node;
}

function refusalStamp(node, entry, animate) {
  const stamp = el(`<div class="refused ${animate ? 'thump' : ''}"><span>Not in the document</span></div>`);
  node.querySelector('.a').append(stamp);
  const note = entry.guard === 'score'
    ? `Stopped before the model: nothing in the document came close (best match ${entry.best?.toFixed(2)}).`
    : 'The model followed rule 2 of its prompt and refused.';
  node.querySelector('.e-meta').textContent = note;
}

function dressAnswer(node, entry, animate) {
  if (entry.refused) { refusalStamp(node, entry, animate); return; }
  if (!entry.a) return;
  const cited = new Set((entry.a.match(/\[(\d+(?:\s*,\s*\d+)*)\]/g) || []).flatMap(s => s.match(/\d+/g)).map(Number));
  const used = (entry.sources || []).filter(hit => hit.used);
  const shown = used.map((hit, i) => ({ hit, n: i + 1 })).filter(({ n }) => !cited.size || cited.has(n));
  const slips = node.querySelector('.slips');
  if (shown.length) slips.append(el(`<div class="print small slips-title">Source text used</div>`));
  shown.forEach(({ hit, n }, i) => {
    const slip = el(`<blockquote class="slip" data-n="${n}" style="--d:${i * 90}ms">
      <header><b class="slip-n">${n}</b><span class="slip-doc"></span><span class="slip-page"></span><span class="slip-score"></span></header>
      <p></p>
    </blockquote>`);
    slip.querySelector('.slip-doc').textContent = hit.doc;
    slip.querySelector('.slip-page').textContent = pageLabel(hit);
    slip.querySelector('.slip-score').textContent = `match ${hit.score.toFixed(2)}`;
    highlightBest(slip.querySelector('p'), hit.text, entry.a);
    slips.append(slip);
  });
  const folio = node.querySelector('.e-folio');
  [...new Set(shown.map(({ hit }) => hit.page))].forEach(number => {
    const tag = el(`<button type="button" class="folio-tag" title="See the source text">p.${number}</button>`);
    tag.addEventListener('click', () => slips.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'nearest' }));
    folio.append(tag);
  });
  const stats = entry.stats || {};
  const bits = [`${used.length} passage${used.length === 1 ? '' : 's'} read`];
  if (entry.ms) bits.push(`${(entry.ms / 1000).toFixed(1)} s`);
  if (stats.tokens_per_s) bits.push(`${stats.tokens_per_s} words a second`);
  if (entry.model) bits.push(entry.model);
  node.querySelector('.e-meta').textContent = bits.join(' · ');
}

const pageLabel = hit => hit.page_end && hit.page_end !== hit.page ? `pp. ${hit.page}-${hit.page_end}` : `p. ${hit.page}`;

function showProblem(node, problem) {
  const box = node.querySelector('.problem');
  box.hidden = false;
  box.replaceChildren();
  box.append(Object.assign(document.createElement('b'), { textContent: problem.message }));
  if (problem.hint) box.append(Object.assign(document.createElement('code'), { textContent: problem.hint }));
  const action = { model_missing: ['Pull it from Keys', 'keys'], ollama_down: ['See how in Keys', 'keys'], no_key: ['Open Keys', 'keys'], no_docs: ['Add a paper', 'papers'] }[problem.code];
  if (action) {
    const button = el(`<button type="button" class="btn small"></button>`);
    button.textContent = action[0];
    button.addEventListener('click', () => import('./book.js').then(({ go }) => go(action[1])));
    box.append(button);
  }
}

function welcome() {
  const hasDocs = status.index.docs > 0;
  const node = el(`<div class="welcome">
    <p class="w-hi"></p>
    <p class="w-when"></p>
    <p class="w-say"></p>
    <div class="w-chips"></div>
  </div>`);
  node.querySelector('.w-hi').textContent = greeting();
  node.querySelector('.w-when').textContent = `It is ${timeOf(new Date())} on ${longDate()}.`;
  node.querySelector('.w-say').textContent = hasDocs
    ? 'Ask me anything from your papers. I answer only from what is written in them, and I always show you where I read it.'
    : 'Slip a PDF or TXT between these pages and I will read it for you. I answer only from what is written there.';
  const chips = node.querySelector('.w-chips');
  if (hasDocs) suggestions.slice(0, 4).forEach((text, i) => {
    const chip = el(`<button type="button" class="ask-chip" style="--i:${i}"></button>`);
    chip.textContent = text;
    chip.addEventListener('click', () => { composer.set(text); $('q').focus(); send(); });
    chips.append(chip);
  });
  else {
    chips.append(el(`<button type="button" class="btn primary" data-act="sample">${icon('file')}<span>Use the sample handbook</span></button>`));
    chips.append(el(`<button type="button" class="btn" data-act="papers">${icon('clip')}<span>Add my own paper</span></button>`));
    chips.addEventListener('click', event => {
      const action = event.target.closest('[data-act]')?.dataset.act;
      if (action) import('./book.js').then(({ go }) => go('papers').then(() => { if (action === 'sample') emit('use-sample'); }));
    });
  }
  return node;
}

function renderIndex() {
  const host = $('index');
  host.replaceChildren();
  notebook.pages.forEach((p, i) => {
    const row = el(`<div class="toc-row ${i === notebook.open ? 'open' : ''}">
      <button type="button" class="toc-open"><b class="toc-no"></b><span class="toc-title"></span><i class="toc-dots"></i><time></time></button>
      <button type="button" class="toc-del" aria-label="Tear out this page" title="Tear out this page">${icon('x')}</button>
    </div>`);
    row.querySelector('.toc-no').textContent = i + 1;
    row.querySelector('.toc-title').textContent = pageTitle(p);
    row.querySelector('time').textContent = dayOf(new Date(p.created));
    row.querySelector('.toc-open').addEventListener('click', () => openPage(i));
    row.querySelector('.toc-del').addEventListener('click', () => tearOut(i));
    if (notebook.pages.length === 1 && !p.entries.length) row.querySelector('.toc-del').hidden = true;
    host.append(row);
  });
}

function renderSources(hits, threshold) {
  const host = $('sources');
  host.replaceChildren();
  if (!hits?.length) {
    host.append(el(`<div class="empty-note"><p class="hand-note">The passages I read will be clipped here.</p><p>Ask a question, and every piece of the document I looked at appears on this page, with how closely it matched.</p></div>`));
    return;
  }
  const head = el(`<p class="print small src-head"></p>`);
  head.textContent = `Retrieved context · needs ${threshold?.toFixed(2)} to be used`;
  host.append(head);
  hits.forEach((hit, i) => {
    const card = el(`<article class="clip-card ${hit.used ? '' : 'unused'}" style="--i:${i}">
      <svg class="clip" viewBox="0 0 24 64" aria-hidden="true"><path d="M7 14v34a5 5 0 0 0 10 0V10a4 4 0 0 0-8 0v36a2 2 0 0 0 4 0V16"/></svg>
      <header><b class="rank">${hit.rank}</b><span class="c-doc-name"></span><span class="c-page"></span></header>
      <div class="meter" role="img"><i style="--v:${Math.max(0, Math.min(1, hit.score))}"></i><u style="--v:${threshold || 0}"></u><em></em></div>
      <p></p>
      <footer></footer>
    </article>`);
    card.querySelector('.c-doc-name').textContent = hit.doc;
    card.querySelector('.c-page').textContent = pageLabel(hit);
    card.querySelector('em').textContent = hit.score.toFixed(3);
    card.querySelector('.meter').setAttribute('aria-label', `Match score ${hit.score.toFixed(3)}`);
    card.querySelector('p').textContent = hit.text;
    card.querySelector('footer').textContent = hit.used ? 'Sent to the model' : 'Too far away, not sent';
    host.append(card);
  });
}

function showPane(name) {
  left.querySelectorAll('.left-tabs button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.pane === name)));
  left.querySelectorAll('.pane').forEach(p => { p.hidden = p.dataset.pane !== name; });
}

function renderPage() {
  const host = $('entries');
  host.replaceChildren();
  const p = page();
  $('page-no').textContent = String(notebook.open + 1).padStart(3, '0');
  if (!p.entries.length) host.append(welcome());
  p.entries.forEach((entry, i) => host.append(finishedEntry(entry, i)));
  renderIndex();
  const last = p.entries[p.entries.length - 1];
  renderSources(last?.sources, last?.threshold);
  showPane(p.entries.length ? 'sources' : (notebook.pages.length > 1 ? 'index' : 'sources'));
  requestAnimationFrame(() => { $('entries-scroll').scrollTop = 1e6; });
}

// ── Moving between pages ──
function openPage(i) {
  if (i === notebook.open || writing) return;
  const dir = i > notebook.open ? 1 : -1;
  turnPage({ dir, leaves: Math.min(3, Math.abs(i - notebook.open)), update: () => { notebook.open = i; save(); renderPage(); } });
}

export function newPage() {
  if (writing) return;
  const here = page();
  if (!here.entries.length) {
    if (notebook.open === notebook.pages.length - 1) {
      // Already blank: give a small nudge rather than wasting paper.
      if (!reducedMotion()) $('entries-scroll').animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(3px)' }, { transform: 'none' }], { duration: 260 });
      $('q').focus();
      return;
    }
  }
  turnPage({
    dir: 1, leaves: 2,
    update: () => {
      notebook.pages.push({ id: Date.now(), created: Date.now(), entries: [] });
      notebook.open = notebook.pages.length - 1;
      save();
      renderPage();
    },
  }).then(() => { $('q').focus(); });
}

function tearOut(i) {
  if (writing) return;
  notebook.pages.splice(i, 1);
  if (!notebook.pages.length) notebook.pages.push({ id: Date.now(), created: Date.now(), entries: [] });
  notebook.open = Math.min(notebook.open, notebook.pages.length - 1);
  save();
  renderPage();
  showPane('index');
}

// ── Asking ──
const STEPS = {
  read: 'Reading your question',
  search: 'Searching the index',
  found: 'Choosing the right passages',
  ask: 'Asking the model',
};

function buildSteps(host) {
  host.hidden = false;
  host.innerHTML = Object.entries(STEPS).map(([key, text]) => `
    <div class="step" data-step="${key}" data-state="wait">
      <svg class="tick" viewBox="0 0 20 20" aria-hidden="true"><path d="M3 11l4.500 4.500L17 4.500" pathLength="1"/></svg>
      <span class="step-text">${text}</span><span class="step-note"></span>
    </div>`).join('');
  const set = (key, state, text, note) => {
    const step = host.querySelector(`[data-step="${key}"]`);
    step.dataset.state = state;
    if (text) step.querySelector('.step-text').textContent = text;
    if (note) step.querySelector('.step-note').textContent = note;
  };
  set('read', 'now');
  return set;
}

function flyIn(node) {
  if (reducedMotion()) return;
  const field = $('c-field').getBoundingClientRect(), target = node.querySelector('.q-text').getBoundingClientRect();
  const dx = field.left - target.left, dy = field.top - target.top;
  node.querySelector('.q').animate(
    [{ transform: `translate(${dx}px, ${dy}px)`, opacity: .6 }, { transform: 'translate(0, -6px)', opacity: 1, offset: .82 }, { transform: 'none', opacity: 1 }],
    { duration: 620, easing: 'cubic-bezier(.2, .75, .25, 1)' },
  );
  node.querySelector('.e-date').animate([{ opacity: 0, transform: 'scale(1.7) rotate(-6deg)' }, { opacity: 0, transform: 'scale(1.7) rotate(-6deg)', offset: .62 }, { opacity: 1, transform: 'none' }], { duration: 700, easing: 'cubic-bezier(.3, 1.4, .5, 1)' });
}

export async function send() {
  const question = $('q').value.trim();
  if (!question || writing) return;
  if (!status.index.docs) {
    toast('Add a paper first, so I have something to read.');
    import('./book.js').then(({ go }) => go('papers'));
    return;
  }
  writing = true;
  right.classList.add('busy');
  composer.clear();
  const here = page();
  const history = here.entries.filter(e => e.a && !e.refused).slice(-3).flatMap(e => [{ role: 'user', content: e.q }, { role: 'assistant', content: e.a }]);
  const entry = { q: question, at: Date.now(), language: prefs.language };
  here.entries.push(entry);
  $('entries').querySelector('.welcome')?.remove();
  const node = renderEntry(entry, here.entries.length - 1);
  $('entries').append(node);
  const scroller = $('entries-scroll');
  let stick = true;
  const toBottom = () => { if (stick) scroller.scrollTop = scroller.scrollHeight; };
  scroller.addEventListener('scroll', () => { stick = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 90; }, { passive: true });
  toBottom();
  flyIn(node);
  setMood('think');
  showPane('sources');
  left.classList.add('searching');

  const steps = node.querySelector('.steps');
  const setStep = buildSteps(steps);
  const answerHost = node.querySelector('.a-text');
  const answerBox = node.querySelector('.a');
  answerBox.hidden = true;
  const writer = createWriter(answerHost);
  let text = '', started = false;
  const run = { question, at: entry.at };

  await ask({
    question, history, language: prefs.language,
    onEvent: event => {
      if (event.type === 'stage' && event.stage === 'warming') setStep('read', 'now', 'Waking the reader up');
      if (event.type === 'stage' && event.stage === 'search') {
        setStep('read', 'done', 'Read your question', 'turned into 384 numbers');
        setStep('search', 'done', `Searched ${event.searched} passages`, `${event.ms} ms`);
        setStep('found', 'now');
        run.search = event;
      }
      if (event.type === 'sources') {
        entry.sources = event.hits;
        entry.threshold = event.threshold;
        entry.best = event.hits[0]?.score;
        renderSources(event.hits, event.threshold);
        left.classList.remove('searching');
        const count = event.hits.filter(hit => hit.used).length;
        setStep('found', event.passed ? 'done' : 'stop', event.passed ? `Found ${count} useful passage${count === 1 ? '' : 's'}` : 'Nothing close enough', `best match ${(event.hits[0]?.score ?? 0).toFixed(2)}`);
        if (event.passed) setStep('ask', 'now');
        run.sources = event;
        toBottom();
      }
      if (event.type === 'prompt') {
        setStep('ask', 'now', `Asking ${event.model}`, 'local, on this laptop');
        run.prompt = event;
        emit('run', run);
      }
      if (event.type === 'token') {
        if (!started) {
          started = true;
          steps.classList.add('done');
          answerBox.hidden = false;
          setMood('write');
        }
        text += event.text;
        writer.push(event.text);
        toBottom();
      }
      if (event.type === 'done') {
        Object.assign(entry, { a: event.answer, refused: event.refused, guard: event.guard, ms: event.ms, stats: event.stats, model: event.model });
        run.done = event;
      }
      if (event.type === 'error') {
        entry.error = { message: event.message, hint: event.hint, code: event.code };
        run.error = event;
      }
    },
  });

  await writer.finish();
  left.classList.remove('searching');
  steps.classList.add('done');
  if (entry.error) {
    steps.hidden = true;
    showProblem(node, entry.error);
    setMood('sad', 3000);
  } else {
    entry.a = entry.a ?? text;
    dressAnswer(node, entry, true);
    setMood(entry.refused ? 'sad' : 'happy', entry.refused ? 2600 : 1200);
  }
  emit('run', run);
  save();
  renderIndex();
  writing = false;
  right.classList.remove('busy');
  requestAnimationFrame(toBottom);
  $('q').focus();
}

// ── Status on the page ──
function paintStatus() {
  const { llm, index } = status;
  const pill = $('llm-status');
  const ready = llmReady();
  pill.dataset.state = ready ? 'on' : 'off';
  const text = llm.provider === 'ollama'
    ? (!llm.up ? 'Local LLM (Ollama): not running' : ready ? `Local LLM (Ollama) · ${llm.model}` : `Ollama is on · ${llm.model} not pulled`)
    : `${llm.provider} · ${llm.model}`;
  $('llm-text').textContent = text;
  const foot = $('left-foot');
  foot.textContent = `${index.docs} paper${index.docs === 1 ? '' : 's'} · ${index.vectors} passages in FAISS`;
  $('c-doc').textContent = index.docs ? `Reading ${index.docs} paper${index.docs === 1 ? '' : 's'}` : 'No paper yet';
  $('entries').querySelector('.welcome')?.replaceWith(welcome());
}

function paintName() { $('brand-name').textContent = prefs.botName || 'Panna'; }
function paintLang() { right.querySelectorAll('[data-lang]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === prefs.language))); }

export function askNow(question) {
  composer.set(question);
  return send();
}

export function startChat() {
  mountMascot($('brand-mascot'), 'large');
  mountClock($('clock'));
  composer = inkComposer($('q'), $('mirror'), $('c-field'));
  paintName(); paintLang();
  getJSON('/api/questions').then(list => { suggestions = list.map(item => item.q); if (current === 'chat' && !page().entries.length) renderPage(); }).catch(() => {});
  renderPage();

  left.querySelector('.left-tabs').addEventListener('click', event => {
    const name = event.target.closest('button')?.dataset.pane;
    if (name) { showPane(name); if (name === 'index') renderIndex(); }
  });
  $('llm-status').addEventListener('click', () => import('./book.js').then(({ go }) => go('keys')));
  $('new-page').addEventListener('click', newPage);
  $('composer').addEventListener('submit', event => { event.preventDefault(); send(); });
  $('q').addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); }
  });
  let idle = 0;
  $('q').addEventListener('input', () => {
    if (writing) return;
    setMood('listen');
    clearTimeout(idle);
    idle = setTimeout(() => { if (!writing) setMood('idle'); }, 1300);
  });
  right.querySelector('.lang').addEventListener('click', event => {
    const language = event.target.closest('[data-lang]')?.dataset.lang;
    if (language) setPrefs({ language });
    paintLang();
  });
  // A citation number or tag jumps to its source.
  $('entries').addEventListener('click', event => {
    const chip = event.target.closest('.cite');
    if (!chip) return;
    const slip = chip.closest('.entry').querySelector(`.slip[data-n="${chip.dataset.n}"]`);
    if (!slip) return;
    slip.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'nearest' });
    slip.classList.remove('flash');
    void slip.offsetWidth;
    slip.classList.add('flash');
  });
  on('status', paintStatus);
  paintStatus();
  register('chat', {
    left, right,
    enter: () => { paintStatus(); requestAnimationFrame(() => { $('entries-scroll').scrollTop = 1e6; }); },
    entered: () => { if (innerWidth > 1000) $('q').focus({ preventScroll: true }); },
  });
}
