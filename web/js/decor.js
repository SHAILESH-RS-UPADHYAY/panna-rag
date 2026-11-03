// Small things floating in the air. One canvas, paused when the tab is hidden, still in calm mode.
import { prefs, onPrefs, reducedMotion } from './prefs.js';

const LOOK_DEFAULT = { register: 'dust', bubblegum: 'hearts', rose: 'sparkles', cottage: 'petals', y2k: 'sparkles', mochi: 'confetti', moonlit: 'stars', casefile: 'dust', quiet: 'off' };
const COUNT = { dust: 34, hearts: 15, bubbles: 16, petals: 15, sparkles: 22, stars: 40, confetti: 20, off: 0 };
const PALETTE = {
  dust: ['255,226,170'], hearts: ['255,105,170', '255,160,205', '255,70,130'], bubbles: ['255,255,255', '255,190,225'],
  petals: ['232,160,170', '245,200,190', '214,130,150'], sparkles: ['255,240,180', '255,255,255', '255,190,235'],
  stars: ['255,244,200', '205,215,255'], confetti: ['255,190,160', '160,230,200', '190,200,255', '255,225,140'],
};

const rand = (a, b) => a + Math.random() * (b - a);

export function startDecor() {
  const canvas = document.getElementById('floaties');
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, kind = 'off', items = [], raf = 0;

  const make = fresh => {
    const color = PALETTE[kind][Math.floor(Math.random() * PALETTE[kind].length)];
    const item = { x: rand(0, w), y: fresh ? rand(0, h) : (kind === 'petals' ? -20 : h + 20), r: rand(2, 5), a: rand(.25, .7), vx: rand(-.12, .12), vy: rand(-.4, -.14), rot: rand(0, 6.28), vr: rand(-.012, .012), ph: rand(0, 6.28), color };
    if (kind === 'dust') Object.assign(item, { r: rand(.6, 1.9), a: rand(.12, .5), vy: rand(-.1, -.02), vx: rand(-.07, .07) });
    if (kind === 'hearts') Object.assign(item, { r: rand(5, 11), a: rand(.28, .62) });
    if (kind === 'bubbles') Object.assign(item, { r: rand(4, 13), a: rand(.3, .6) });
    if (kind === 'petals') Object.assign(item, { r: rand(5, 9), vy: rand(.2, .55), vx: rand(.08, .3), a: rand(.4, .7) });
    if (kind === 'sparkles') Object.assign(item, { r: rand(2.5, 6), vx: rand(-.04, .04), vy: rand(-.05, .05) });
    if (kind === 'stars') Object.assign(item, { r: rand(.6, 2), vx: 0, vy: 0, a: rand(.4, 1) });
    if (kind === 'confetti') Object.assign(item, { r: rand(2.5, 5), vy: rand(.15, .4) });
    return item;
  };

  const shape = (p, t) => {
    ctx.save();
    ctx.translate(p.x, p.y);
    const twinkle = .35 + .65 * (.5 + .5 * Math.sin(t * .002 + p.ph));
    if (kind === 'hearts') {
      const s = p.r / 10;
      ctx.rotate(Math.sin(t * .001 + p.ph) * .25);
      ctx.scale(s, s);
      ctx.translate(0, -6);
      ctx.beginPath();
      ctx.moveTo(0, 2.5);
      ctx.bezierCurveTo(-1, -2, -8, -2, -8, 3);
      ctx.bezierCurveTo(-8, 7, -3, 9.5, 0, 12);
      ctx.bezierCurveTo(3, 9.5, 8, 7, 8, 3);
      ctx.bezierCurveTo(8, -2, 1, -2, 0, 2.5);
      ctx.fillStyle = `rgba(${p.color},${p.a})`;
      ctx.fill();
    } else if (kind === 'bubbles') {
      ctx.beginPath();
      ctx.arc(0, 0, p.r, 0, 6.3);
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = `rgba(${p.color},${p.a})`;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(-p.r * .35, -p.r * .35, p.r * .22, 0, 6.3);
      ctx.fillStyle = `rgba(255,255,255,${p.a})`;
      ctx.fill();
    } else if (kind === 'petals') {
      ctx.rotate(p.rot);
      ctx.beginPath();
      ctx.ellipse(0, 0, p.r, p.r * .52, 0, 0, 6.3);
      ctx.fillStyle = `rgba(${p.color},${p.a})`;
      ctx.fill();
    } else if (kind === 'sparkles') {
      const r = p.r, k = r * .26;
      ctx.globalAlpha = p.a * twinkle;
      ctx.beginPath();
      ctx.moveTo(0, -r); ctx.lineTo(k, -k); ctx.lineTo(r, 0); ctx.lineTo(k, k); ctx.lineTo(0, r); ctx.lineTo(-k, k); ctx.lineTo(-r, 0); ctx.lineTo(-k, -k);
      ctx.closePath();
      ctx.fillStyle = `rgb(${p.color})`;
      ctx.fill();
    } else if (kind === 'confetti') {
      ctx.rotate(p.rot);
      ctx.fillStyle = `rgba(${p.color},${p.a})`;
      ctx.fillRect(-p.r, -p.r * .5, p.r * 2, p.r);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, p.r, 0, 6.3);
      ctx.fillStyle = `rgba(${p.color},${kind === 'stars' ? p.a * twinkle : p.a})`;
      ctx.fill();
    }
    ctx.restore();
  };

  const draw = (t, move) => {
    ctx.clearRect(0, 0, w, h);
    items.forEach((p, i) => {
      if (move) {
        p.x += p.vx + Math.sin(t * .001 + p.ph) * (kind === 'dust' ? .05 : .18);
        p.y += p.vy;
        p.rot += p.vr;
        if (p.y < -30 || p.y > h + 30 || p.x < -30 || p.x > w + 30) items[i] = make(false);
      }
      shape(p, t);
    });
  };

  const loop = t => { if (!document.documentElement.hasAttribute('data-turning')) draw(t, true); raf = requestAnimationFrame(loop); };

  const restart = () => {
    cancelAnimationFrame(raf);
    raf = 0;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    w = innerWidth; h = innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    kind = prefs.floaties === 'auto' ? (LOOK_DEFAULT[prefs.look] || 'off') : prefs.floaties;
    items = Array.from({ length: COUNT[kind] || 0 }, () => make(true));
    if (!items.length) { ctx.clearRect(0, 0, w, h); return; }
    if (reducedMotion() || document.hidden) { draw(0, false); return; }
    raf = requestAnimationFrame(loop);
  };

  restart();
  addEventListener('resize', restart, { passive: true });
  document.addEventListener('visibilitychange', restart);
  onPrefs(changes => { if ('floaties' in changes || 'look' in changes || 'motion' in changes) restart(); });
}
