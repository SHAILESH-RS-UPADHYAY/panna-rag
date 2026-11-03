// The Studio: looks on the left, every finer choice in clear sections on the right.
import { icon, register, turnPage } from './book.js';
import { FONTS, INKS, LOOKS, MARKERS, OPTIONS, prefs, resetPrefs, setLook, setPrefs, surprise } from './prefs.js';

const el = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };

const left = el(`<div class="sec">
  <header><h2 class="page-title">Studio</h2><p class="page-sub">Pick a look. Everything stays changeable afterwards.</p></header>
  <div class="row"><button type="button" class="btn primary" id="surprise">${icon('shuffle')}<span>Surprise me</span></button>
    <button type="button" class="btn" id="reset">${icon('refresh')}<span>Reset</span></button></div>
  <div class="scroll grow"><div class="scroll-inner look-grid" id="looks"></div></div>
</div>`);

const SECTIONS = {
  Paper: [['paper', 'Paper'], ['desk', 'Desk'], ['slider:age', 'How old and torn', 0, 100, 1]],
  Writing: [['font:fontHead', 'Heading font'], ['font:fontQ', 'Question font'], ['font:fontA', 'Answer font'], ['ink:inkQ', 'Question ink'], ['ink:inkA', 'Answer ink'], ['marker', 'Highlighter'], ['slider:textSize', 'Text size', 14, 22, 1]],
  Motion: [['turn', 'Page turn'], ['slider:speed', 'Turn speed', .5, 2, .1], ['reveal', 'How answers appear'], ['typing', 'How typing looks'], ['floaties', 'Floating things'], ['motion', 'Overall']],
  Layout: [['entry', 'Entry style'], ['bookmode', 'Book'], ['size', 'Book size'], ['density', 'Spacing'], ['clock', 'Clock'], ['hour', 'Time format']],
  Robot: [['companion', 'Companion'], ['text:botName', 'Its name']],
};

const right = el(`<div class="sec">
  <div class="seg" id="tabs-studio" role="group" aria-label="Studio sections">${Object.keys(SECTIONS).map((name, i) => `<button type="button" data-s="${name}" aria-pressed="${!i}">${name}</button>`).join('')}</div>
  <div class="scroll grow"><div class="scroll-inner" id="options"></div></div>
</div>`);

const $ = id => left.querySelector(`#${id}`) || right.querySelector(`#${id}`);
let section = 'Paper';

function renderLooks() {
  $('looks').replaceChildren(...LOOKS.map(look => {
    const card = el(`<button type="button" class="look" data-look="${look.id}" aria-pressed="${prefs.look === look.id}">
      <span class="thumb"><i></i><i></i></span><b></b><small></small></button>`);
    card.querySelector('b').textContent = look.name;
    card.querySelector('small').textContent = look.note;
    card.addEventListener('click', () => turnPage({ update: () => { setLook(look.id); renderLooks(); renderOptions(); } }));
    return card;
  }));
}

function group(label, body) {
  const node = el('<div class="opt-group"><h4 class="print small"></h4></div>');
  node.firstElementChild.textContent = label;
  node.append(body);
  return node;
}

function control([spec, label, min, max, step]) {
  const [kind, key] = spec.includes(':') ? spec.split(':') : ['pick', spec];
  if (kind === 'slider') {
    const input = el(`<input type="range" min="${min}" max="${max}" step="${step}" aria-label="${label}">`);
    input.value = prefs[key];
    input.addEventListener('input', () => setPrefs({ [key]: Number(input.value) }));
    return group(label, input);
  }
  if (kind === 'text') {
    const input = el(`<input class="field" maxlength="24" aria-label="${label}">`);
    input.value = prefs[key];
    input.addEventListener('input', () => setPrefs({ [key]: input.value }));
    return group(label, input);
  }
  if (kind === 'font') {
    const select = el(`<select class="field" aria-label="${label}"></select>`);
    Object.entries(FONTS).forEach(([name, list]) => {
      const box = document.createElement('optgroup');
      box.label = name;
      list.forEach(font => box.append(Object.assign(document.createElement('option'), { value: font, textContent: font })));
      select.append(box);
    });
    select.value = prefs[key];
    select.addEventListener('change', () => setPrefs({ [key]: select.value }));
    return group(label, select);
  }
  if (kind === 'ink' || key === 'marker') {
    const list = key === 'marker' ? MARKERS : INKS;
    const row = el('<div class="swatches"></div>');
    list.forEach(([id, name, color]) => {
      const dot = el(`<button type="button" class="swatch" style="--c:${color}" title="${name}" aria-label="${name}" aria-pressed="${prefs[key] === id}"></button>`);
      dot.addEventListener('click', () => { setPrefs({ [key]: id }); renderOptions(); });
      row.append(dot);
    });
    return group(label, row);
  }
  const row = el('<div class="picks"></div>');
  OPTIONS[key].forEach(([id, name, note]) => {
    const pick = el(`<button type="button" class="pick" aria-pressed="${prefs[key] === id}"><b></b><small></small></button>`);
    pick.querySelector('b').textContent = name;
    pick.querySelector('small').textContent = note;
    pick.addEventListener('click', () => { setPrefs({ [key]: id }); renderOptions(); });
    row.append(pick);
  });
  return group(label, row);
}

function renderOptions() {
  right.querySelectorAll('#tabs-studio button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.s === section)));
  $('options').replaceChildren(...SECTIONS[section].map(control));
}

export function startStudio() {
  $('tabs-studio').addEventListener('click', event => {
    const name = event.target.closest('button')?.dataset.s;
    if (name) { section = name; renderOptions(); }
  });
  $('surprise').addEventListener('click', () => turnPage({ update: () => { surprise(); renderLooks(); renderOptions(); } }));
  $('reset').addEventListener('click', () => turnPage({ update: () => { resetPrefs(); renderLooks(); renderOptions(); } }));
  register('studio', { left, right, prepare: () => { renderLooks(); renderOptions(); } });
}
