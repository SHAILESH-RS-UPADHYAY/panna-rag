// The page turn. A page is cut into vertical strips, each hinged on the one before, so it can
// truly bend. Text stays real text while it turns. See docs/ARD.md (D9).
// Smoothness rules: only transform and opacity change per frame, the clock starts after the
// layers are painted, and the floating decoration rests while a page is in the air.
import { prefs } from './prefs.js';

const STRIPS = 10, BLANK_STRIPS = 6;
const BASE_MS = 680, GAP_MS = 80;
const ease = t => .5 - .5 * Math.cos(Math.PI * t);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** A copy of a sheet that looks the same, without ids, scrollbars or running animations. */
export function snapshot(sheet) {
  const copy = sheet.cloneNode(true);
  copy.classList.add('frozen');
  copy.removeAttribute('id');
  copy.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
  copy.querySelectorAll('animate, animateMotion').forEach(el => el.remove());
  const sources = sheet.querySelectorAll('.scroll');
  copy.querySelectorAll('.scroll').forEach((scroller, i) => {
    const source = sources[i], inner = scroller.firstElementChild;
    if (!inner || !source?.firstElementChild) return;
    const top = source.scrollTop, height = source.clientHeight;
    // Copy only what can be seen. Long pages would otherwise be cloned once per strip.
    let hiddenAbove = 0;
    [...inner.children].forEach((child, n) => {
      const from = source.firstElementChild.children[n];
      if (!from) return;
      const y = from.offsetTop - source.firstElementChild.offsetTop, h = from.offsetHeight;
      if (y + h < top) { hiddenAbove = y + h; child.remove(); } else if (y > top + height) child.remove();
    });
    inner.style.transform = `translateY(${hiddenAbove - top}px)`;
    scroller.style.overflow = 'hidden';
  });
  const fields = sheet.querySelectorAll('input, textarea, select');
  copy.querySelectorAll('input, textarea, select').forEach((field, i) => { field.value = fields[i]?.value ?? ''; });
  return copy;
}

function buildLeaf(front, back, w, h, strips) {
  const sw = w / strips;
  const leaf = document.createElement('div');
  leaf.className = 'leaf';
  leaf.style.cssText = `width:${w}px;height:${h}px`;
  const parts = [];
  let parent = leaf;
  for (let i = 0; i < strips; i++) {
    const strip = document.createElement('div');
    strip.className = 'strip';
    strip.style.cssText = `width:${sw}px;left:${i ? sw : 0}px`;
    const makeFace = (sheet, cls, offset) => {
      const face = document.createElement('div');
      face.className = `face ${cls}`;
      const slice = document.createElement('div');
      slice.className = 'slice';
      slice.style.cssText = `width:${w}px;height:${h}px;left:${-offset}px`;
      slice.append(sheet.cloneNode(true));
      const shade = document.createElement('i');
      shade.className = 'shade';
      face.append(slice, shade);
      strip.append(face);
      return shade;
    };
    const shadeF = makeFace(front, 'f', i * sw);
    const shadeB = back ? makeFace(back, 'b', w - (i + 1) * sw) : null;
    parent.append(strip);
    parts.push({ strip, shadeF, shadeB });
    parent = strip;
  }
  return { leaf, parts };
}

function poseLeaf(parts, root, tip) {
  const n = parts.length, step = (tip - root) / (n - 1);
  parts.forEach((part, i) => {
    part.strip.style.transform = `rotateY(${(i ? step : root).toFixed(2)}deg)`;
    const light = Math.abs(Math.sin((root + step * i) * Math.PI / 180));
    part.shadeF.style.opacity = (light * .2).toFixed(3);
    if (part.shadeB) part.shadeB.style.opacity = (light * .16).toFixed(3);
  });
}

/**
 * Run one or more leaves. `leaves` is a list of { front, back } sheets (null means blank).
 * dir 1 turns right to left (forward), dir -1 turns left to right (back).
 * single: only one page is showing, so the leaf swings away rather than landing on the left.
 */
export function animateLeaves({ stage, leaves, dir, w, h, blank, single }) {
  const root = document.documentElement;
  root.setAttribute('data-turning', '');
  const speed = prefs.speed || 1, duration = BASE_MS / speed, gap = GAP_MS / speed;
  const end = single ? -112 : -180;
  const items = leaves.map((sheets, i) => {
    const holder = document.createElement('div');
    holder.className = 'leaf-stage';
    const { leaf, parts } = buildLeaf(sheets.front || blank, single ? null : (sheets.back || blank), w, h, sheets.front && !single ? STRIPS : BLANK_STRIPS);
    leaf.style.left = single ? '0' : '50%';
    poseLeaf(parts, dir > 0 ? 0 : end, dir > 0 ? 0 : end);
    holder.append(leaf);
    stage.append(holder);
    return { holder, parts, delay: i * gap, seed: i };
  });
  const castR = stage.querySelector('.cast-r'), castL = stage.querySelector('.cast-l');
  const total = duration + gap * (items.length - 1);

  return new Promise(resolve => {
    // Two frames first: the browser paints every strip now, so the turn never starts with a hitch.
    requestAnimationFrame(() => requestAnimationFrame(start => {
      const frame = now => {
        let lead = null;
        items.forEach(item => {
          const t = clamp((now - start - item.delay) / duration, 0, 1);
          const e = ease(t);
          const angle = dir > 0 ? end * e : end * (1 - e);
          // the free edge leads on the way up and trails on the way down, as paper does
          const bend = 46 * Math.sin(2 * Math.PI * t) * (single ? .5 : 1);
          const flutter = item.seed ? 5 * Math.sin(5 * Math.PI * t + item.seed) * Math.sin(Math.PI * t) : 0;
          poseLeaf(item.parts, angle, angle - dir * bend + flutter);
          const passed = dir > 0 ? angle < -90 : angle > -90;
          item.holder.style.zIndex = passed ? 100 + item.seed : 100 - item.seed;
          if (single) item.holder.style.opacity = dir > 0 ? clamp(1.5 - e * 1.5, 0, 1) : clamp(e * 1.6, 0, 1);
          if (t > 0 && t < 1) lead = angle;
        });
        if (lead !== null && !single) {
          const cos = Math.cos(lead * Math.PI / 180), sin = Math.abs(Math.sin(lead * Math.PI / 180));
          castR.style.opacity = lead > -90 ? (sin * .34).toFixed(3) : 0;
          castR.style.transform = `scaleX(${clamp(cos, 0, 1).toFixed(3)})`;
          castL.style.opacity = lead <= -90 ? (sin * .34).toFixed(3) : 0;
          castL.style.transform = `scaleX(${clamp(-cos, 0, 1).toFixed(3)})`;
        }
        if (now - start < total) { requestAnimationFrame(frame); return; }
        items.forEach(item => item.holder.remove());
        castR.style.opacity = castL.style.opacity = 0;
        root.removeAttribute('data-turning');
        resolve();
      };
      frame(start);
    }));
  });
}
