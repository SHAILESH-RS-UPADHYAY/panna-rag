// The logo: Panna, a small round robot who floats over an open book and reads every page.
// It blinks, follows your cursor, turns its pages and has moods: idle, listen, think, write, happy, sad.
// mascot.css turns each mood into motion. Companions are the same robot in other colours and costumes.
import { prefs } from './prefs.js';

const KINDS = {
  panna: { shell: ['#ffffff', '#d3e2ff'], dark: '#a9c0f4', accent: '#3f7bff', glass: ['#172460', '#0a1138'], glow: '#5ff0ff', cheek: '#ff86ad', book: '#ffd23f', bookEdge: '#eeb015', rx: 26 },
  gulabo: { shell: ['#ffffff', '#ffd6e8'], dark: '#ffb0d0', accent: '#ff4f9f', glass: ['#54123f', '#2e0a2c'], glow: '#ffa6e6', cheek: '#ff6fa8', book: '#8fe3ff', bookEdge: '#55c3ea', rx: 28 },
  moti: { shell: ['#fffdf6', '#ffe6c9'], dark: '#ffc99e', accent: '#ff8f5e', glass: ['#46301f', '#241510'], glow: '#ffe27a', cheek: '#ff8f7f', book: '#93e6c8', bookEdge: '#5fc9a4', rx: 30 },
  chanda: { shell: ['#454d94', '#20265a'], dark: '#2c3370', accent: '#f2cd7c', glass: ['#060819', '#0d1236'], glow: '#ffeeb0', cheek: '#e78bb4', book: '#f2cd7c', bookEdge: '#c79f4f', rx: 26 },
  tinker: { shell: ['#f1f4f8', '#b6bfcb'], dark: '#8e98a6', accent: '#ef4444', glass: ['#23282e', '#101316'], glow: '#7dffae', cheek: '#ff9f9f', book: '#ffd84d', bookEdge: '#d9ab1b', rx: 13 },
};

const star = (x, y, r) => `M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z`;
const heart = (x, y, s) => `M${x} ${y + s * .9}C${x - s * 1.5} ${y - s * .1} ${x - s * .7} ${y - s * 1.1} ${x} ${y - s * .25}C${x + s * .7} ${y - s * 1.1} ${x + s * 1.5} ${y - s * .1} ${x} ${y + s * .9}Z`;

const eye = (cx, c) => `
  <g class="r-eye" style="transform-origin:${cx}px 44px">
    <ellipse cx="${cx}" cy="44" rx="10.5" ry="11.5" fill="${c.glow}" opacity=".2"/>
    <ellipse cx="${cx}" cy="44" rx="6.4" ry="7.8" fill="${c.glow}"/>
    <circle cx="${cx + 2.2}" cy="40.8" r="1.9" fill="#fff"/>
  </g>`;

const ACCESSORY = {
  gulabo: c => `<g class="r-bow"><path d="M78 19C70 9 62 12 63 20C62 28 70 30 78 22Z" fill="${c.accent}"/><path d="M78 19C86 9 95 12 94 20C95 28 86 30 78 22Z" fill="${c.accent}"/><circle cx="78" cy="20.5" r="3.6" fill="#fff"/></g>`,
  chanda: c => `<path d="M77 20a9 9 0 1 0 9 12a7.5 7.5 0 0 1 -9 -12z" fill="${c.accent}"/>`,
  tinker: c => `<g fill="${c.dark}"><circle cx="31" cy="23" r="2"/><circle cx="89" cy="23" r="2"/><circle cx="31" cy="67" r="2"/><circle cx="89" cy="67" r="2"/></g>`,
};

function head(kind, c) {
  return `
    <g class="r-antenna" style="transform-origin:60px 18px">
      <path d="M60 18V9" fill="none" stroke="${c.dark}" stroke-width="3" stroke-linecap="round"/>
      <circle class="r-ball-glow" cx="60" cy="6" r="9" fill="${c.accent}" opacity=".26"/><circle class="r-ball" cx="60" cy="6" r="4.8" fill="${c.accent}"/><circle cx="58.5" cy="4.5" r="1.4" fill="#fff" opacity=".9"/>
    </g>
    <rect x="14" y="36" width="12" height="23" rx="6" fill="${c.accent}"/>
    <rect x="94" y="36" width="12" height="23" rx="6" fill="${c.accent}"/>
    <rect x="23" y="17" width="74" height="56" rx="${c.rx}" fill="url(#r-shell-${kind})" stroke="${c.dark}" stroke-width="1.2"/>
    <ellipse cx="43" cy="24.5" rx="13" ry="3.8" fill="#fff" opacity=".85" transform="rotate(-10 43 24.5)"/>
    <rect x="30.5" y="26.5" width="59" height="37" rx="${Math.min(c.rx - 8, 18)}" fill="url(#r-glass-${kind})"/>
    <path d="M38 34C41 31 45 30 50 30" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" opacity=".28"/>
    <ellipse class="r-cheek" cx="39" cy="54" rx="4.8" ry="2.8" fill="${c.cheek}"/>
    <ellipse class="r-cheek" cx="81" cy="54" rx="4.8" ry="2.8" fill="${c.cheek}"/>
    <g class="r-eyes">
      <g class="r-open">${eye(48, c)}${eye(72, c)}</g>
      <g class="r-happy" fill="none" stroke="${c.glow}" stroke-width="3.6" stroke-linecap="round"><path d="M41 47Q48 36 55 47"/><path d="M65 47Q72 36 79 47"/></g>
      <g class="r-sad" fill="none" stroke="${c.glow}" stroke-width="3.3" stroke-linecap="round"><path d="M41 41Q49 49 55 45"/><path d="M79 41Q71 49 65 45"/></g>
      <g class="r-dots" fill="${c.glow}"><circle cx="48" cy="44" r="3.8"/><circle cx="60" cy="44" r="3.8"/><circle cx="72" cy="44" r="3.8"/></g>
    </g>
    <path class="r-mouth r-smile" d="M54 54Q60 59.5 66 54" fill="none" stroke="${c.glow}" stroke-width="2.4" stroke-linecap="round"/>
    <ellipse class="r-mouth r-o" cx="60" cy="55.5" rx="3" ry="3.4" fill="${c.glow}"/>
    <path class="r-mouth r-frown" d="M54.5 58Q60 53 65.5 58" fill="none" stroke="${c.glow}" stroke-width="2.4" stroke-linecap="round"/>
    ${ACCESSORY[kind]?.(c) || ''}`;
}

function robot(kind) {
  const c = KINDS[kind];
  return `
    <ellipse class="r-shadow" cx="60" cy="123.5" rx="27" ry="3.8"/>
    <g class="r-float">
      <g fill="${c.accent}">
        <path class="r-spark" style="--d:0s" d="${star(9, 30, 5.5)}"/>
        <path class="r-spark" style="--d:.8s" d="${star(110, 22, 4.5)}"/>
        <path class="r-spark" style="--d:1.5s" d="${star(112, 72, 3.5)}"/>
        <path class="r-spark" style="--d:2.1s" d="${star(6, 76, 3)}"/>
      </g>
      <g class="r-hearts" fill="#ff5c93">
        <path class="r-h" style="--x:-22px;--d:0s" d="${heart(46, 12, 4.5)}"/>
        <path class="r-h" style="--x:20px;--d:.16s" d="${heart(76, 10, 3.8)}"/>
        <path class="r-h" style="--x:0px;--d:.3s" d="${heart(60, 8, 3.2)}"/>
      </g>
      <ellipse class="r-jet" cx="60" cy="113" rx="13" ry="6" fill="${c.accent}"/>
      <rect x="41" y="68" width="38" height="44" rx="18" fill="url(#r-shell-${kind})" stroke="${c.dark}" stroke-width="1.2"/>
      <path class="r-chest" d="${heart(60, 79, 4.2)}" fill="${c.accent}" style="transform-origin:60px 79px"/>
      <path d="M43 81C35 83 31 89 31 96" fill="none" stroke="${c.dark}" stroke-width="7" stroke-linecap="round"/>
      <g class="r-arm" style="transform-origin:77px 81px">
        <path d="M77 81C85 83 89 89 89 96" fill="none" stroke="${c.dark}" stroke-width="7" stroke-linecap="round"/>
        <circle cx="89" cy="100" r="5.8" fill="url(#r-shell-${kind})" stroke="${c.dark}" stroke-width="1.2"/>
      </g>
      <g class="r-head-track"><g class="r-head" style="transform-origin:60px 70px">${head(kind, c)}</g></g>
      <g class="r-book" style="transform-origin:60px 102px">
        <path d="M28 91L60 96L92 91V111L60 116L28 111Z" fill="${c.book}" stroke="${c.bookEdge}" stroke-width="1.4" stroke-linejoin="round"/>
        <path d="M32 90C42 88.5 53 90.5 60 95V112C53 107.5 42 106 32 107.5Z" fill="#fff" stroke="#dfe5f4"/>
        <path d="M88 90C78 88.5 67 90.5 60 95V112C67 107.5 78 106 88 107.5Z" fill="#fff" stroke="#dfe5f4"/>
        <path d="M37 95C43 94.5 49 95.5 55 98M37 100C43 99.5 49 100.5 55 103M83 95C77 94.5 71 95.5 65 98M83 100C77 99.5 71 100.5 65 103" fill="none" stroke="#b5c4e8" stroke-width="1.3" stroke-linecap="round"/>
        <path class="r-turn" d="M88 90C78 88.5 67 90.5 60 95V112C67 107.5 78 106 88 107.5Z" fill="#fbfcff" stroke="#c9d4ee" style="transform-origin:60px 100px"/>
      </g>
      <circle cx="31" cy="100" r="5.8" fill="url(#r-shell-${kind})" stroke="${c.dark}" stroke-width="1.2"/>
    </g>`;
}

const DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
  ${Object.entries(KINDS).map(([kind, c]) => `
    <linearGradient id="r-shell-${kind}" x1=".2" y1="0" x2=".7" y2="1"><stop offset="0" stop-color="${c.shell[0]}"/><stop offset="1" stop-color="${c.shell[1]}"/></linearGradient>
    <linearGradient id="r-glass-${kind}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.glass[0]}"/><stop offset="1" stop-color="${c.glass[1]}"/></linearGradient>`).join('')}
</defs></svg>`;

export function mascotSVG(kind = prefs.companion, cls = '') {
  const known = KINDS[kind] ? kind : 'panna'; // a preference saved before a companion was renamed
  return `<svg class="mascot ${cls}" data-kind="${known}" data-mood="idle" viewBox="0 0 120 128" aria-hidden="true">${robot(known)}</svg>`;
}

const live = new Set(); // every robot on the page that should react to moods
let current = 'idle', timer = 0;

export function mountMascot(host, cls = '') {
  host.innerHTML = mascotSVG(prefs.companion, cls);
  host.classList.add('mascot-host');
  live.add(host);
  host.addEventListener('click', () => celebrate(host));
  return host;
}

const setMoodOn = (host, mood) => host.querySelector('.mascot')?.setAttribute('data-mood', mood);

export function setMood(mood, holdMs = 0) {
  current = mood;
  clearTimeout(timer);
  live.forEach(host => setMoodOn(host, mood));
  if (holdMs) timer = setTimeout(() => setMood('idle'), holdMs);
}

function celebrate(host) {
  setMoodOn(host, 'happy');
  setTimeout(() => setMoodOn(host, current), 1300);
}

export function redrawMascots() {
  live.forEach(host => {
    const cls = [...(host.querySelector('.mascot')?.classList || [])].filter(c => c !== 'mascot').join(' ');
    host.innerHTML = mascotSVG(prefs.companion, cls);
    setMoodOn(host, current);
  });
}

// The eyes follow the cursor and the head leans a little after them.
let pendingEvent = null;
function trackEyes() {
  const event = pendingEvent;
  pendingEvent = null;
  if (!event) return;
  live.forEach(host => {
    if (!host.isConnected) return;
    const box = host.getBoundingClientRect();
    if (!box.width) return;
    const dx = event.clientX - (box.left + box.width / 2), dy = event.clientY - (box.top + box.height / 3);
    const reach = Math.min(1, Math.hypot(dx, dy) / 300), angle = Math.atan2(dy, dx);
    host.style.setProperty('--look-x', `${(Math.cos(angle) * 3 * reach).toFixed(2)}px`);
    host.style.setProperty('--look-y', `${(Math.sin(angle) * 2.2 * reach).toFixed(2)}px`);
    host.style.setProperty('--tilt', `${(Math.cos(angle) * 5 * reach).toFixed(2)}deg`);
  });
}

export function startMascots() {
  document.body.insertAdjacentHTML('afterbegin', DEFS);
  addEventListener('pointermove', event => {
    if (!pendingEvent) requestAnimationFrame(trackEyes);
    pendingEvent = event;
  }, { passive: true });
}

// The browser tab's little robot blinks too.
export function startFavicon() {
  const link = document.querySelector('link[rel="icon"]');
  const canvas = Object.assign(document.createElement('canvas'), { width: 32, height: 32 });
  const ctx = canvas.getContext('2d');
  const draw = (open, glow) => {
    ctx.clearRect(0, 0, 32, 32);
    ctx.fillStyle = '#3f7bff';
    ctx.fillRect(14.8, 2, 2.4, 5);
    ctx.beginPath(); ctx.arc(16, 3.2, glow ? 3 : 2.4, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.roundRect(0, 12, 4, 10, 2); ctx.roundRect(28, 12, 4, 10, 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#a9c0f4';
    ctx.beginPath(); ctx.roundRect(2.5, 6, 27, 24, 10); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#121c50';
    ctx.beginPath(); ctx.roundRect(5.5, 10, 21, 15, 7); ctx.fill();
    ctx.fillStyle = '#5ff0ff';
    [11.5, 20.5].forEach(x => { ctx.beginPath(); ctx.ellipse(x, 17, 2.6, open ? 3.2 : .5, 0, 0, 7); ctx.fill(); });
    link.href = canvas.toDataURL();
  };
  let tick = 0;
  setInterval(() => {
    if (document.hidden || !link) return;
    tick = (tick + 1) % 16;
    draw(tick % 8 !== 7, tick % 4 < 2);
  }, 300);
}
