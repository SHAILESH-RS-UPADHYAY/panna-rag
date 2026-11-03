// Every look choice lives here: the data behind the Studio, and applying it to <html>.
// CSS reads the attributes and tokens. Nothing else in the app sets colours or fonts.

const FONT_GROUPS = {
  Handwriting: ['Kalam', 'Handlee', 'Gochi Hand', 'Reenie Beanie', 'Nanum Pen Script', 'Homemade Apple', 'La Belle Aurore', 'Cedarville Cursive', 'Mansalva', 'Playpen Sans', 'Delius', 'Gloria Hallelujah'],
  Typewriter: ['Special Elite', 'Cutive Mono', 'Courier Prime', 'Silkscreen'],
  'Old print': ['IM Fell English', 'IM Fell English SC', 'Old Standard TT'],
  Cute: ['Fredoka', 'Baloo 2', 'Chewy', 'DynaPuff', 'Sour Gummy', 'Cherry Bomb One', 'Mochiy Pop One', 'Pacifico'],
  Elegant: ['Cormorant Garamond', 'Playfair Display', 'Dancing Script', 'Parisienne', 'Italiana'],
  'Easy reading': ['Atkinson Hyperlegible', 'Literata', 'Lexend'],
};
export const FONTS = FONT_GROUPS;

// Some fonts draw small or large for their size. These bring them to a similar reading size.
const FONT_SCALE = {
  'Reenie Beanie': 1.42, 'Nanum Pen Script': 1.36, 'La Belle Aurore': 1.16, 'Homemade Apple': .82, 'Gloria Hallelujah': .88,
  'Cedarville Cursive': .96, Parisienne: 1.14, 'Dancing Script': 1.16, Silkscreen: .84, Italiana: 1.05, 'Cormorant Garamond': 1.12,
  'Gochi Hand': 1.1, Pacifico: .96, 'Cherry Bomb One': .98, Mansalva: .96,
};

// ink: [id, name, on light paper, on dark paper]
export const INKS = [
  ['blueblack', 'Blue-black', '#1d2a55', '#cfd9ff'], ['royal', 'Royal blue', '#1f3fb0', '#9db5ff'], ['sepia', 'Sepia', '#5a3a1c', '#e9c99a'],
  ['carbon', 'Carbon', '#1f1c19', '#f3efe6'], ['teacher', 'Teacher red', '#a8232f', '#ff9ba3'], ['forest', 'Forest', '#1f5a3c', '#9fe6bd'],
  ['plum', 'Plum', '#6d2178', '#e0aef0'], ['bubble', 'Bubblegum', '#d02b84', '#ff9ccd'], ['teal', 'Sea glass', '#0f6b6d', '#8fe3e0'],
];
export const MARKERS = [['butter', 'Butter', '#f6dd6e'], ['pink', 'Pink', '#ffb3d9'], ['mint', 'Mint', '#aff0cc'], ['sky', 'Sky', '#b5e3ff'], ['peach', 'Peach', '#ffc9a0'], ['lilac', 'Lilac', '#d6c6ff']];

// [id, name, one-line description]
export const OPTIONS = {
  paper: [['ledger', 'Ledger columns', 'Date, particulars, folio'], ['ruled', 'Ruled', 'Plain school lines'], ['squared', 'Maths squares', 'A small square grid'], ['dotted', 'Dot grid', 'For neat little dots'], ['blank', 'Blank', 'Nothing but paper']],
  desk: [['sky', 'Bright sky', 'Sunny blue and pink'], ['walnut', 'Dark walnut', 'A heavy old table'], ['teak', 'Teak', 'Warm, oiled and lighter'], ['cork', 'Cork board', 'With pinholes'], ['linen', 'Sage linen', 'Soft woven cloth'], ['gingham', 'Pink gingham', 'A picnic cloth'], ['marble', 'Blush marble', 'Veined and glossy'], ['mint', 'Mint squares', 'A pastel cutting mat'], ['holo', 'Holographic', 'It shifts as it glows'], ['night', 'Night sky', 'Stars above the book'], ['slate', 'Steel filing desk', 'Cold grey metal']],
  entry: [['ledger', 'Ledger lines', 'Written right on the rules'], ['note', 'Sticky notes', 'Little squares stuck on'], ['slip', 'Torn slips', 'Pasted strips of paper'], ['bubble', 'Puffy bubbles', 'Round and soft'], ['card', 'Index cards', 'With a red top line'], ['telegram', 'Telegram', 'Typed strips, STOP']],
  reveal: [['pen', 'Fountain pen', 'A nib writes each word'], ['type', 'Typewriter', 'Letters strike one by one'], ['bleed', 'Ink bleed', 'Words soak into the paper'], ['pop', 'Sticker pop', 'Words bounce in'], ['fade', 'Soft fade', 'Quiet and calm'], ['none', 'All at once', 'No animation']],
  typing: [['ink', 'Wet ink', 'Letters soak in as you type'], ['typewriter', 'Typewriter', 'Letters strike the page'], ['bounce', 'Bouncy', 'Letters hop into place'], ['off', 'Plain', 'No animation']],
  turn: [['curl', 'Paper curl', 'One page, turned by hand'], ['riffle', 'Riffle', 'A few pages flutter past'], ['slide', 'Slide', 'A quick sideways slide'], ['fade', 'Fade', 'A soft cross-fade']],
  floaties: [['auto', "The look's own", 'Whatever suits this look'], ['dust', 'Dust motes', 'Lit by the lamp'], ['hearts', 'Hearts', 'Floating up'], ['bubbles', 'Bubbles', 'Wobbling up'], ['petals', 'Petals', 'Drifting down'], ['sparkles', 'Sparkles', 'Twinkling'], ['stars', 'Stars', 'A quiet night'], ['confetti', 'Confetti', 'Tiny paper dots'], ['off', 'Nothing', 'Keep the desk still']],
  companion: [['panna', 'Panna', 'The blue robot reading its book'], ['gulabo', 'Gulabo', 'A pink robot with a bow'], ['moti', 'Moti', 'A soft peach robot'], ['chanda', 'Chanda', 'A midnight robot with a moon'], ['tinker', 'Tinker', 'A square little tin robot']],
  bookmode: [['spread', 'Open register', 'Two facing pages'], ['single', 'Single page', 'One page, sources on a side sheet']],
  size: [['roomy', 'Roomy', 'Fills the desk'], ['snug', 'Snug', 'More desk around the book']],
  density: [['cozy', 'Cozy', 'Generous spacing'], ['compact', 'Compact', 'More on each page']],
  clock: [['stamp', 'Rolling stamp', 'An office date stamp'], ['hand', 'Handwritten', 'Noted by hand'], ['hidden', 'Hidden', 'No clock on the page']],
  hour: [['auto', 'Automatic', 'From your device'], ['h12', '12 hour', '9:30 pm'], ['h24', '24 hour', '21:30']],
  motion: [['full', 'Full', 'All the animation'], ['calm', 'Calm', 'Only quiet fades']],
};

// A look is a set of choices. Everything stays changeable afterwards.
export const LOOKS = [
  { id: 'register', name: 'Purana Register', note: 'Thick, old and torn, in bright cheerful colours',
    set: { paper: 'ledger', desk: 'sky', fontHead: 'IM Fell English SC', fontQ: 'Kalam', fontA: 'Kalam', inkQ: 'royal', inkA: 'blueblack', marker: 'butter', entry: 'ledger', reveal: 'pen', typing: 'ink', floaties: 'auto', companion: 'panna', age: 70 } },
  { id: 'bubblegum', name: 'Bubblegum', note: 'A puffy pink sticker diary with hearts everywhere',
    set: { paper: 'dotted', desk: 'gingham', fontHead: 'Cherry Bomb One', fontQ: 'Sour Gummy', fontA: 'Fredoka', inkQ: 'bubble', inkA: 'plum', marker: 'pink', entry: 'bubble', reveal: 'pop', typing: 'bounce', floaties: 'auto', companion: 'gulabo', age: 0 } },
  { id: 'rose', name: 'Rose Gold Planner', note: 'Blush marble, gold foil and a fine script',
    set: { paper: 'ruled', desk: 'marble', fontHead: 'Parisienne', fontQ: 'Dancing Script', fontA: 'Cormorant Garamond', inkQ: 'teacher', inkA: 'sepia', marker: 'peach', entry: 'note', reveal: 'bleed', typing: 'ink', floaties: 'auto', companion: 'panna', age: 0 } },
  { id: 'cottage', name: 'Pressed Flowers', note: 'Linen, dried petals and a slow afternoon',
    set: { paper: 'blank', desk: 'linen', fontHead: 'Playfair Display', fontQ: 'Handlee', fontA: 'Literata', inkQ: 'forest', inkA: 'sepia', marker: 'mint', entry: 'slip', reveal: 'bleed', typing: 'ink', floaties: 'auto', companion: 'moti', age: 18 } },
  { id: 'y2k', name: 'Gel Pen Y2K', note: 'Glitter gel, butterflies and a holographic cover',
    set: { paper: 'squared', desk: 'holo', fontHead: 'DynaPuff', fontQ: 'Gloria Hallelujah', fontA: 'Baloo 2', inkQ: 'plum', inkA: 'royal', marker: 'lilac', entry: 'bubble', reveal: 'pop', typing: 'bounce', floaties: 'auto', companion: 'gulabo', age: 0 } },
  { id: 'mochi', name: 'Mochi Stationery', note: 'Soft pastel paper and tiny smiling stickers',
    set: { paper: 'squared', desk: 'mint', fontHead: 'Mochiy Pop One', fontQ: 'Playpen Sans', fontA: 'Playpen Sans', inkQ: 'teal', inkA: 'sepia', marker: 'peach', entry: 'note', reveal: 'pop', typing: 'bounce', floaties: 'auto', companion: 'moti', age: 0 } },
  { id: 'moonlit', name: 'Moonlit Journal', note: 'Midnight paper, gold ink and the real moon phase',
    set: { paper: 'ruled', desk: 'night', fontHead: 'Italiana', fontQ: 'Handlee', fontA: 'Cormorant Garamond', inkQ: 'blueblack', inkA: 'carbon', marker: 'lilac', entry: 'ledger', reveal: 'bleed', typing: 'ink', floaties: 'auto', companion: 'chanda', age: 0 } },
  { id: 'casefile', name: 'Case File', note: 'Manila folders, typed notes and paper clips',
    set: { paper: 'blank', desk: 'slate', fontHead: 'Special Elite', fontQ: 'Courier Prime', fontA: 'Special Elite', inkQ: 'carbon', inkA: 'carbon', marker: 'butter', entry: 'card', reveal: 'type', typing: 'typewriter', floaties: 'auto', companion: 'tinker', age: 52 } },
  { id: 'quiet', name: 'Quiet Ledger', note: 'Clean paper, one red line, nothing to distract',
    set: { paper: 'ruled', desk: 'teak', fontHead: 'Old Standard TT', fontQ: 'Literata', fontA: 'Atkinson Hyperlegible', inkQ: 'royal', inkA: 'carbon', marker: 'butter', entry: 'ledger', reveal: 'fade', typing: 'off', floaties: 'off', companion: 'panna', age: 0 } },
];

const DEFAULTS = {
  look: 'register', ...LOOKS[0].set,
  turn: 'curl', bookmode: 'spread', size: 'roomy', density: 'cozy', clock: 'stamp', hour: 'auto', motion: 'full',
  speed: 1, textSize: 17, language: 'english', botName: 'Panna',
};

const KEY = 'panna.prefs.v1';
const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
const write = () => { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* storage blocked: keep working */ } };

export const prefs = { ...DEFAULTS, ...read() };

const ATTRS = ['look', 'paper', 'desk', 'entry', 'reveal', 'typing', 'turn', 'bookmode', 'size', 'density', 'clock', 'motion'];
const listeners = new Set();
export const onPrefs = fn => listeners.add(fn);

const fontStack = name => `'${name}', 'Kalam', 'Nirmala UI', serif`;
export const fontScale = name => FONT_SCALE[name] || 1;

export function isDarkPaper() {
  return prefs.look === 'moonlit';
}

export function reducedMotion() {
  return prefs.motion === 'calm' || matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function paint() {
  const root = document.documentElement, style = root.style;
  ATTRS.forEach(key => root.setAttribute(`data-${key}`, prefs[key]));
  root.toggleAttribute('data-calm', reducedMotion());
  style.setProperty('--font-head', fontStack(prefs.fontHead));
  style.setProperty('--font-q', fontStack(prefs.fontQ));
  style.setProperty('--font-a', fontStack(prefs.fontA));
  style.setProperty('--scale-head', fontScale(prefs.fontHead));
  style.setProperty('--scale-q', fontScale(prefs.fontQ));
  style.setProperty('--scale-a', fontScale(prefs.fontA));
  const inkOf = id => { const ink = INKS.find(item => item[0] === id) || INKS[0]; return ink[isDarkPaper() ? 3 : 2]; };
  style.setProperty('--ink-q', inkOf(prefs.inkQ));
  style.setProperty('--ink-a', inkOf(prefs.inkA));
  style.setProperty('--marker', (MARKERS.find(item => item[0] === prefs.marker) || MARKERS[0])[2]);
  style.setProperty('--text', `${prefs.textSize}px`);
  style.setProperty('--age', prefs.age / 100);
  style.setProperty('--turn-speed', prefs.speed);
}

export function setPrefs(changes) {
  Object.assign(prefs, changes);
  write();
  paint();
  listeners.forEach(fn => fn(changes));
}

export const setLook = id => setPrefs({ look: id, ...LOOKS.find(look => look.id === id).set });

export function resetPrefs() {
  setPrefs({ ...DEFAULTS });
}

export function surprise() {
  const others = LOOKS.filter(look => look.id !== prefs.look);
  const pick = list => list[Math.floor(Math.random() * list.length)];
  const look = pick(others);
  setPrefs({ look: look.id, ...look.set, turn: pick(['curl', 'riffle']) });
  return look;
}
