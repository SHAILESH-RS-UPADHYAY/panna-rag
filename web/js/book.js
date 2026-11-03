// The book itself: stacked page edges, torn paper, index tabs and moving between sections.
import { animateLeaves, snapshot } from './flip.js';
import { prefs, onPrefs, reducedMotion } from './prefs.js';

const $ = (selector, root = document) => root.querySelector(selector);

// A real book has an order. Tabs before the open page sit on its left, tabs after it on its right.
export const TABS = [
  { id: 'tour', label: 'Guide', icon: 'book', depth: .06 },
  { id: 'chat', label: 'Chat', icon: 'chat', depth: .26 },
  { id: 'papers', label: 'Papers', icon: 'file', depth: .44 },
  { id: 'engine', label: 'Engine', icon: 'gear', depth: .58 },
  { id: 'studio', label: 'Studio', icon: 'palette', depth: .72 },
  { id: 'keys', label: 'Keys', icon: 'key', depth: .84 },
  { id: 'marks', label: 'Marks', icon: 'seal', depth: .95 },
];

const sections = {};
const sheetL = () => $('#sheet-l'), sheetR = () => $('#sheet-r');
const bodyL = () => $('#body-l'), bodyR = () => $('#body-r');

export let current = null;
let busy = false, queued = null;
const singleMode = () => prefs.bookmode === 'single' || innerWidth < 1000;

export const icon = name => `<svg class="i" aria-hidden="true"><use href="/web/img/icons.svg#i-${name}"/></svg>`;

export function register(id, section) {
  sections[id] = section; // { left, right, enter?, leave? }
}

// ── Torn edges ──
function seeded(seed) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

/** Walk one edge with big wobbles and fine fibres added together. */
function edge(from, to, steps, amp, rand, normal) {
  const pts = [];
  let drift = 0;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    drift = drift * .86 + (rand() - .5) * amp * .55;
    const fine = (rand() - .5) * amp * .5;
    const off = Math.abs(drift + fine);
    pts.push([from[0] + (to[0] - from[0]) * t + normal[0] * off, from[1] + (to[1] - from[1]) * t + normal[1] * off]);
  }
  return pts;
}

/** A rip into the page: a jagged V cut in from the edge. */
function rip(y, depth, height, rand, w) {
  const pts = [];
  const steps = 9;
  for (let i = 0; i <= steps; i++) pts.push([w - depth * (i / steps) - rand() * 3, y - height / 2 + (height / 2) * (i / steps) + (rand() - .5) * 2.5]);
  for (let i = steps; i >= 0; i--) pts.push([w - depth * (i / steps) - rand() * 3, y + (height / 2) * ((steps - i) / steps) + (rand() - .5) * 2.5]);
  return pts;
}

function tearSheet(sheet, side, age) {
  const w = sheet.offsetWidth, h = sheet.offsetHeight;
  if (!w || !h) return;
  const under = sheet.previousElementSibling;
  if (age < .05) {
    sheet.style.clipPath = '';
    if (under) under.style.clipPath = '';
    return;
  }
  const amp = 1.6 + age * 5.4;
  const build = (seed, grow) => {
    const rand = seeded(seed);
    let right;
    const top = edge([0, grow], [w, grow], Math.round(w / 15), amp * .7, rand, [0, 1]);
    const foreSteps = Math.round(h / 12);
    const fore = edge([w - grow, 0], [w - grow, h], foreSteps, amp, rand, [-1, 0]);
    const bottom = edge([w, h - grow], [0, h - grow], Math.round(w / 15), amp, rand, [0, -1]);
    right = [];
    // a rip on the fore edge, and a corner that has fallen off
    if (age > .4) {
      const ripY = h * (side === 'r' ? .67 : .31), depth = (side === 'r' ? 46 : 22) * age, height = (side === 'r' ? 30 : 16) * age;
      fore.forEach(p => {
        if (Math.abs(p[1] - ripY) > height / 2) right.push(p);
        else if (!right.ripped) { right.push(...rip(ripY, depth, height, rand, p[0] + grow)); right.ripped = true; }
      });
    } else right = fore;
    const cut = age > .55 ? (side === "r" ? 14 : 18) + 30 * age : 0;
    const finalFore = cut ? right.filter(p => p[1] < h - cut) : right;
    const finalBottom = cut ? bottom.filter(p => p[0] < w - cut) : bottom;
    const corner = cut ? edge([w - grow - 3, h - cut], [w - cut, h - grow - 3], 9, amp * .8, rand, [-.7, -.7]) : [];
    return [...top, ...finalFore, ...corner, ...finalBottom];
  };
  // Mirror for the left page, so its outer edge is the torn one and the spine stays straight.
  const toPolygon = pts => `polygon(${pts.map(([x, y]) => `${(side === 'r' ? x : w - x).toFixed(1)}px ${y.toFixed(1)}px`).join(',')})`;
  const seed = side === 'r' ? 40961 : 28411;
  sheet.style.clipPath = toPolygon(build(seed, 0));
  if (under) under.style.clipPath = toPolygon(build(seed, -2));
}

export function tearPages() {
  const age = prefs.age / 100;
  ['l', 'r'].forEach(side => tearSheet($(`#sheet-${side}`), side, age));
  const rect = $('#sheet-r');
  const repair = $('#repair');
  if (repair && rect) repair.style.top = `${rect.offsetHeight * .67 - 44}px`;
}

// ── Stacks of pages ──
function buildStack(host, sheets, axis) {
  const rand = seeded(axis === 'x' ? 77 : 311);
  let html = '';
  for (let i = 0; i < sheets; i++) {
    const a = (rand() * 8).toFixed(1), b = (rand() * 10).toFixed(1), tone = rand();
    const shade = tone > .78 ? 'd' : tone < .3 ? 'l' : '';
    const cross = axis === 'x' ? `left:${(i / sheets * 100).toFixed(2)}%;top:${a}px;bottom:${b}px` : `top:${(i / sheets * 100).toFixed(2)}%;left:${a}px;right:${b}px`;
    html += `<i class="${shade}" style="${cross}"></i>`;
  }
  host.innerHTML = html;
}

function setDepth(depth) {
  const book = $('#book');
  book.style.setProperty('--depth-l', (.22 + depth * .78).toFixed(3));
  book.style.setProperty('--depth-r', (.22 + (1 - depth) * .78).toFixed(3));
}

// ── Tabs ──
function buildTabs() {
  $('#tabs').innerHTML = TABS.map((tab, i) => `
    <button type="button" class="tab" data-tab="${tab.id}" style="--i:${i}" data-side="right">
      ${icon(tab.icon)}<span>${tab.label}</span>
    </button>`).join('');
  $('#tabs').addEventListener('click', event => {
    const tab = event.target.closest('.tab');
    if (tab) go(tab.dataset.tab);
  });
}

function placeTabs(activeIndex) {
  document.querySelectorAll('.tab').forEach((el, i) => {
    const side = !singleMode() && i < activeIndex ? 'left' : 'right';
    el.classList.toggle('active', i === activeIndex);
    if (i === activeIndex) el.setAttribute('aria-current', 'page');
    else el.removeAttribute('aria-current');
    if (el.dataset.side === side) return;
    el.classList.add('moving');
    setTimeout(() => {
      el.dataset.side = side;
      requestAnimationFrame(() => el.classList.remove('moving'));
    }, 240 / (prefs.speed || 1));
  });
}

// ── Turning ──
/**
 * The one way to change what the book shows. `update()` changes the DOM to the new state.
 * Copies taken before and after become the turning page, so every change looks physical.
 */
export async function turnPage({ dir = 1, leaves = 1, update, style = prefs.turn }) {
  if (reducedMotion() || style === 'fade' || style === 'slide') {
    const pages = [sheetL(), sheetR()];
    const out = style === 'slide' && !reducedMotion() ? [{ transform: 'none', opacity: 1 }, { transform: `translateX(${-dir * 26}px)`, opacity: 0 }] : [{ opacity: 1 }, { opacity: 0 }];
    await Promise.all(pages.map(page => page.animate(out, { duration: 150, easing: 'ease-in' }).finished));
    update();
    pages.forEach(page => page.animate(style === 'slide' && !reducedMotion() ? [{ transform: `translateX(${dir * 26}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }] : [{ opacity: 0 }, { opacity: 1 }], { duration: 240, easing: 'ease-out' }));
    return;
  }
  const book = $('#book'), stage = $('#flip-stage'), single = singleMode();
  const riffle = style === 'riffle' ? 4 : 0;
  const count = Math.max(1, leaves) + riffle;
  const oldL = snapshot(sheetL()), oldR = snapshot(sheetR());
  update();
  const newL = snapshot(sheetL()), newR = snapshot(sheetR());
  const w = sheetR().offsetWidth, h = sheetR().offsetHeight;

  // The blank is a clean sheet of the same paper.
  const blank = sheetR().cloneNode(false);
  blank.classList.add('frozen');
  blank.removeAttribute('id');
  const blankBack = sheetL().cloneNode(false);
  blankBack.classList.add('frozen');
  blankBack.removeAttribute('id');

  // Keep the side the leaf has not reached yet looking unchanged, under a copy.
  const cover = dir > 0 ? oldL : oldR;
  const coverHost = dir > 0 ? $('#page-l') : $('#page-r');
  cover.classList.add('turn-cover');
  if (!single) coverHost.append(cover);

  const list = [];
  for (let i = 0; i < count; i++) {
    const first = i === 0, last = i === count - 1;
    if (dir > 0) list.push({ front: first ? oldR : blank, back: last ? newL : blankBack });
    else list.push({ front: last ? newR : blank, back: first ? oldL : blankBack });
  }
  book.classList.add('turning');
  await animateLeaves({ stage, leaves: list, dir, w, h, blank, single });
  cover.remove();
  book.classList.remove('turning');
}

export async function go(id, { instant = false, leaves } = {}) {
  if (!sections[id] || id === current) return;
  if (busy) { queued = id; return; }
  busy = true;
  try {
    const from = TABS.findIndex(tab => tab.id === current), to = TABS.findIndex(tab => tab.id === id);
    const dir = to >= from ? 1 : -1;
    const previous = current;
    await sections[id].prepare?.();
    const update = () => {
      if (previous) sections[previous].leave?.();
      bodyL().replaceChildren(sections[id].left);
      bodyR().replaceChildren(sections[id].right);
      document.documentElement.dataset.section = id;
      current = id;
      sections[id].enter?.();
    };
    placeTabs(to);
    setDepth(TABS[to].depth);
    const steps = leaves ?? Math.min(3, Math.max(1, Math.abs(to - Math.max(from, 0))));
    if (instant || previous === null) update();
    else await turnPage({ dir, leaves: steps, update });
    sections[id].entered?.();
  } finally {
    busy = false;
    if (queued) {
      const next = queued;
      queued = null;
      go(next);
    }
  }
}

export function refreshBook() {
  tearPages();
  const index = TABS.findIndex(tab => tab.id === current);
  placeTabs(index);
}

export function startBook() {
  buildStack($('#stack-l'), 26, 'x');
  buildStack($('#stack-r'), 26, 'x');
  buildStack($('#stack-bl'), 8, 'y');
  buildStack($('#stack-br'), 8, 'y');
  buildTabs();
  tearPages();
  new ResizeObserver(() => tearPages()).observe($('#sheet-r'));
  onPrefs(changes => {
    if ('age' in changes || 'look' in changes) tearPages();
    if ('bookmode' in changes) refreshBook();
  });
  addEventListener('resize', () => {
    document.documentElement.toggleAttribute('data-narrow', innerWidth < 1000);
  });
  document.documentElement.toggleAttribute('data-narrow', innerWidth < 1000);
}

/** Lift the front cover: the book opens on its first page. */
export async function openCover() {
  const book = $('#book'), stage = $('#flip-stage');
  if (reducedMotion() || singleMode()) { book.classList.remove('closed'); return; }
  const w = sheetR().offsetWidth, h = sheetR().offsetHeight;
  const front = $('#cover-art').cloneNode(true);
  front.removeAttribute('id');
  book.classList.add('opening');
  const pending = animateLeaves({ stage, leaves: [{ front, back: snapshot(sheetL()) }], dir: 1, w, h, blank: front, single: false });
  await new Promise(resolve => setTimeout(resolve, 300 / (prefs.speed || 1)));
  book.classList.remove('closed');
  await pending;
  book.classList.remove('opening');
}
