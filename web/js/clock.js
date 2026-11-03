// The date and time, detected from the device: an office date stamp with rolling bands.
import { prefs, onPrefs } from './prefs.js';

const zone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const uses12h = () => prefs.hour === 'auto' ? Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hour12 !== false : prefs.hour === 'h12';
const pad = n => String(n).padStart(2, '0');
const MONTHS = Array.from({ length: 12 }, (_, m) => new Date(2024, m, 1).toLocaleString(undefined, { month: 'short' }).toUpperCase());

const band = (key, labels) => `<span class="band" data-band="${key}" style="--n:0"><span class="reel">${labels.map(label => `<b>${label}</b>`).join('')}</span></span>`;
const digit = key => band(key, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

export function timeOf(date) {
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: uses12h() });
}
export function dayOf(date) {
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
}

/** The moon's age in days, from a known new moon. Accurate enough to draw the right shape. */
function moonPhase(date) {
  const synodic = 29.530588853, knownNew = Date.UTC(2000, 0, 6, 18, 14);
  const age = (((date - knownNew) / 86400000) % synodic + synodic) % synodic;
  return age / synodic;
}

function moonSVG(phase) {
  const r = 8, x = Math.cos(phase * 2 * Math.PI) * r;
  const waxing = phase < .5;
  const path = `M9 1a8 8 0 0 ${waxing ? 1 : 0} 0 16a${Math.abs(x).toFixed(2)} 8 0 0 ${(waxing ? x > 0 : x < 0) ? 0 : 1} 0 -16z`;
  return `<svg class="moon-phase" viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="8" class="moon-dark"/><path d="${path}" class="moon-lit"/></svg>`;
}

export function greeting(date = new Date()) {
  const h = date.getHours();
  return h < 5 ? 'Still up?' : h < 12 ? 'Good morning.' : h < 17 ? 'Good afternoon.' : h < 21 ? 'Good evening.' : 'Good night.';
}

export function longDate(date = new Date()) {
  return date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}

export function mountClock(host) {
  host.className = 'clock';
  host.title = `Detected from your device: ${zone()}`;
  host.innerHTML = `
    <div class="stamp-face" aria-hidden="true">
      <span class="moon-slot"></span>
      <span class="s-group">${digit('d1')}${digit('d2')}</span>
      ${band('month', MONTHS)}
      <span class="s-group">${digit('y1')}${digit('y2')}</span>
      <span class="s-sep"></span>
      <span class="s-group">${digit('h1')}${digit('h2')}</span><i class="colon">:</i>
      <span class="s-group">${digit('m1')}${digit('m2')}</span><i class="colon">:</i>
      <span class="s-group">${digit('s1')}${digit('s2')}</span>
      <span class="ampm"></span>
    </div>
    <div class="hand-face"><span class="hand-date"></span><span class="hand-time"></span></div>
    <span class="sr live-time"></span>`;

  const setBand = (key, n) => {
    const el = host.querySelector(`[data-band="${key}"]`);
    if (el.style.getPropertyValue('--n') !== String(n)) el.style.setProperty('--n', n);
  };

  const tick = () => {
    if (!host.isConnected) { setTimeout(tick, 1000); return; }
    const now = new Date();
    const twelve = uses12h();
    const hours = twelve ? (now.getHours() % 12 || 12) : now.getHours();
    const d = pad(now.getDate()), y = pad(now.getFullYear() % 100), h = pad(hours), m = pad(now.getMinutes()), s = pad(now.getSeconds());
    setBand('d1', d[0]); setBand('d2', d[1]); setBand('month', now.getMonth());
    setBand('y1', y[0]); setBand('y2', y[1]); setBand('h1', h[0]); setBand('h2', h[1]);
    setBand('m1', m[0]); setBand('m2', m[1]); setBand('s1', s[0]); setBand('s2', s[1]);
    host.querySelector('.ampm').textContent = twelve ? (now.getHours() < 12 ? 'AM' : 'PM') : '';
    host.querySelector('.hand-date').textContent = longDate(now);
    host.querySelector('.hand-time').textContent = now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: twelve });
    host.querySelector('.moon-slot').innerHTML = prefs.look === 'moonlit' ? moonSVG(moonPhase(now)) : '';
    setTimeout(tick, 1000 - (Date.now() % 1000));
  };
  tick();
  onPrefs(() => { if (host.isConnected) host.querySelector('.moon-slot').innerHTML = prefs.look === 'moonlit' ? moonSVG(moonPhase(new Date())) : ''; });
}
