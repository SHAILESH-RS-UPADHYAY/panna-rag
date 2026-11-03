// Start everything: paint the look, wake the robot, open the book.
import { startStatus } from './api.js';
import { go, openCover, startBook } from './book.js';
import { startChat } from './chat.js';
import { startDecor } from './decor.js';
import { startEngine } from './engine.js';
import { startKeys } from './keys.js';
import { startMarks } from './marks.js';
import { startPapers } from './papers.js';
import { startStudio } from './studio.js';
import { startTour } from './tour.js';
import { mascotSVG, redrawMascots, startFavicon, startMascots } from './mascot.js';
import { onPrefs, paint, prefs, reducedMotion } from './prefs.js';

/** First opening in a tab: the robot boots up, says hello, and the cover lifts. */
function wakeUp() {
  return new Promise(resolve => {
    const seen = (() => { try { return sessionStorage.getItem('panna.awake'); } catch { return '1'; } })();
    if (seen || reducedMotion()) { resolve(); return; }
    try { sessionStorage.setItem('panna.awake', '1'); } catch { /* fine */ }
    const screen = document.createElement('div');
    screen.className = 'wake';
    screen.innerHTML = `<div class="bot mascot-host">${mascotSVG(prefs.companion)}</div>
      <div class="word"></div><div class="sub">your little robot who reads every page</div>`;
    screen.querySelector('.word').textContent = prefs.botName || 'Panna';
    document.body.append(screen);
    const end = () => {
      if (screen.classList.contains('bye')) return;
      screen.classList.add('bye');
      resolve();
      setTimeout(() => screen.remove(), 450);
    };
    screen.addEventListener('click', end);
    setTimeout(() => screen.classList.add('on'), 200);
    setTimeout(end, 1650);
  });
}

async function start() {
  paint();
  document.documentElement.setAttribute('data-ready', '');
  startMascots();
  startBook();
  startDecor();
  startFavicon();
  startStatus();
  startChat();
  [startTour, startPapers, startEngine, startStudio, startKeys, startMarks].forEach(begin => begin());
  const toggle = Object.assign(document.createElement('button'), { type: 'button', className: 'btn small side-toggle', textContent: 'Other page' });
  toggle.addEventListener('click', () => document.getElementById('book').classList.toggle('show-left'));
  document.getElementById('book').append(toggle);
  onPrefs(changes => { if ('companion' in changes || 'look' in changes) redrawMascots(); });
  await go('chat', { instant: true });
  await wakeUp();
  await openCover();
  const first = (() => { try { const seen = localStorage.getItem('panna.toured'); localStorage.setItem('panna.toured', '1'); return !seen; } catch { return false; } })();
  if (first) go('tour');
}

start();
