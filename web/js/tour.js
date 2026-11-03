// The Guide: five pages. Two on using the app, three on how the RAG and chatbot backend work.
import { go, icon, register, turnPage } from './book.js';
import { mascotSVG } from './mascot.js';

const el = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };

const flow = steps => `<ol class="t-flow">${steps.map(([name, note], i) => `<li style="--i:${i}"><b>${name}</b><small>${note}</small></li>`).join('')}</ol>`;

const PAGES = [
  { title: 'Hello, I am Panna', say: 'A little robot who reads your document and answers only from what is written in it.', art: 'bot',
    body: flow([['Add a paper', 'A PDF or TXT, in the Papers tab'], ['Ask a question', 'Type on the line, press Enter'], ['Read the answer', 'With the source text underneath']]) },
  { title: 'How to chat', say: 'Every answer shows where it came from. If the document does not say it, I refuse.', art: 'bot',
    body: flow([['New page', 'Turns to a fresh chat'], ['Numbered tags', 'Click one to jump to its source'], ['Red stamp', 'Means: not in the document'], ['Studio tab', 'Change the looks, fonts and motion']]) },
  { title: 'Backend: reading a paper', say: 'This happens once, when a document is added. Code: rag/ingest.py and rag/store.py.',
    body: flow([['Extract', 'pypdf pulls out the text of each page'], ['Chunk', 'Split into 500 characters, 80 shared with the piece before'], ['Embed', 'all-MiniLM-L6-v2 turns each chunk into 384 numbers'], ['Store', 'FAISS keeps the vectors for searching']]) },
  { title: 'Backend: finding the answer', say: 'This happens on every question. Code: rag/pipeline.py.',
    body: flow([['Embed the question', 'The same model, the same 384 numbers'], ['Search', 'FAISS finds the nearest chunks by cosine similarity'], ['Score gate', 'Guard 1: if nothing is close enough, refuse without calling the model']]) },
  { title: 'Backend: writing the answer', say: 'The model only sees the passages found. Code: rag/prompt.py, rag/llm.py and rag/server.py.',
    body: flow([['Build the prompt', 'Guard 2: use only the context, or give the refusal sentence'], ['Local model', 'Ollama runs it on this laptop, with no paid key'], ['Stream', 'Gradio queue sends words to the page as they are written'], ['Show sources', 'The text used appears under the answer']]) },
];

const left = el('<div class="sec tour-left"><div class="tour-art" id="t-art"></div><h2 class="page-title" id="t-title"></h2><p class="w-say" id="t-say"></p></div>');
const right = el(`<div class="sec tour-right">
  <div class="scroll grow"><div class="scroll-inner" id="t-body"></div></div>
  <div class="row-between">
    <button type="button" class="btn" id="t-prev">${icon('left')}<span>Back</span></button>
    <span class="dots" id="t-dots"></span>
    <button type="button" class="btn primary" id="t-next"><span>Next</span>${icon('right')}</button>
  </div>
</div>`);

const $ = id => left.querySelector(`#${id}`) || right.querySelector(`#${id}`);
let page = 0;

function render() {
  const data = PAGES[page];
  $('t-title').textContent = data.title;
  $('t-say').textContent = data.say;
  $('t-art').innerHTML = mascotSVG();
  $('t-body').innerHTML = data.body;
  $('t-dots').textContent = `Page ${page + 1} of ${PAGES.length}`;
  $('t-prev').disabled = page === 0;
  $('t-next').querySelector('span').textContent = page === PAGES.length - 1 ? 'Start chatting' : 'Next';
}

function move(by) {
  if (page + by >= PAGES.length) { go('chat'); return; }
  if (page + by < 0) return;
  turnPage({ dir: by, update: () => { page += by; render(); } });
}

export function startTour() {
  $('t-prev').addEventListener('click', () => move(-1));
  $('t-next').addEventListener('click', () => move(1));
  register('tour', { left, right, prepare: () => { page = 0; render(); } });
}
