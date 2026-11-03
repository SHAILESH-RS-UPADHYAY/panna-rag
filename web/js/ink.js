// Ink: how typing a question and writing an answer look.
import { prefs, reducedMotion } from './prefs.js';

const NIB = `<svg class="nib" viewBox="0 0 32 32" aria-hidden="true"><path class="nib-body" d="M3 29l3.800 -11.500L22 2.300a2 2 0 0 1 2.800 0l4.900 4.900a2 2 0 0 1 0 2.800L14.500 25.200z"/><path class="nib-slit" d="M3 29l7.500 -7.500"/><circle class="nib-hole" cx="11.500" cy="20.500" r="1.800"/></svg>`;

// ── The question being typed ──
export function inkComposer(textarea, mirror, field) {
  field.insertAdjacentHTML('beforeend', NIB);
  const nib = field.querySelector('.nib');
  let previous = '', settle = 0;

  const placeNib = () => {
    const show = document.activeElement === textarea && textarea.value && textarea.selectionStart === textarea.value.length;
    nib.classList.toggle('on', Boolean(show));
    if (!show) return;
    const range = document.createRange();
    range.selectNodeContents(mirror);
    range.collapse(false);
    const rect = range.getClientRects()[0] || mirror.lastElementChild?.getBoundingClientRect();
    if (!rect) return;
    const box = field.getBoundingClientRect();
    nib.style.transform = `translate(${rect.right - box.left}px, ${rect.top - box.top - 12}px)`;
  };

  const plain = () => { mirror.textContent = textarea.value; mirror.scrollTop = textarea.scrollTop; placeNib(); };

  const grow = () => {
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
    mirror.style.height = textarea.style.height;
  };

  textarea.addEventListener('input', () => {
    const value = textarea.value, style = prefs.typing;
    const appended = value.startsWith(previous) && value.length > previous.length && value.length - previous.length < 40;
    if (style !== 'off' && !reducedMotion() && appended) {
      for (const char of value.slice(previous.length)) {
        if (char.trim()) {
          const span = document.createElement('span');
          span.className = 'typed';
          span.textContent = char;
          mirror.append(span);
        } else mirror.append(char);
      }
      if (style === 'typewriter') field.animate([{ transform: 'translateY(1.2px)' }, { transform: 'none' }], { duration: 90 });
      clearTimeout(settle);
      settle = setTimeout(plain, 750);
    } else plain();
    previous = value;
    grow();
    mirror.scrollTop = textarea.scrollTop;
    placeNib();
  });
  textarea.addEventListener('scroll', () => { mirror.scrollTop = textarea.scrollTop; });
  ['focus', 'blur', 'keyup', 'click'].forEach(name => textarea.addEventListener(name, placeNib));

  return {
    clear() { textarea.value = ''; previous = ''; mirror.textContent = ''; grow(); placeNib(); },
    set(text) { textarea.value = text; previous = text; plain(); grow(); },
    grow,
  };
}

// ── The answer being written ──
const TOKEN = /\n+|[ \t]+|\[\d+(?:\s*,\s*\d+)*\]|[^\s[]+|\[/g;
const WORDS_PER_SECOND = { pen: 13, type: 16, bleed: 18, pop: 15, fade: 24, none: 1000 };

/**
 * Streams text into `target` word by word, safely: only ever textContent, never HTML,
 * because this text comes from a model reading a document anyone could have written.
 */
export function createWriter(target) {
  const instant = reducedMotion() || prefs.reveal === 'none';
  target.insertAdjacentHTML('beforeend', instant || prefs.reveal !== 'pen' ? '' : NIB);
  const nib = target.querySelector('.nib');
  let pending = '', queue = [], block = null, list = null, atLineStart = true, bold = false;
  let running = false, finished = false, lastTime = 0, credit = 0, resolveDone = null;

  const openBlock = (bullet, marker) => {
    if (bullet) {
      if (!list) { list = document.createElement('ul'); target.insertBefore(list, nib); }
      block = document.createElement('li');
      if (marker) block.dataset.marker = marker;
      list.append(block);
    } else {
      list = null;
      block = document.createElement('p');
      target.insertBefore(block, nib);
    }
    atLineStart = false;
  };

  const addWord = text => {
    if (atLineStart) {
      if (/^[-*•]$/.test(text)) { openBlock(true); return; }
      if (/^\d+[.)]$/.test(text)) { openBlock(true, text); return; }
      openBlock(false);
    }
    text.split('**').forEach((piece, i) => {
      if (i > 0) bold = !bold;
      if (!piece) return;
      const word = document.createElement('span');
      word.className = bold ? 'w b' : 'w';
      word.style.setProperty('--chars', [...piece].length);
      word.textContent = piece;
      block.append(word);
      moveNib(word);
    });
  };

  const addCite = token => {
    if (atLineStart) openBlock(false);
    for (const n of token.match(/\d+/g)) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'cite';
      chip.dataset.n = n;
      chip.textContent = n;
      chip.setAttribute('aria-label', `Source ${n}`);
      block.append(chip);
    }
  };

  const moveNib = word => {
    if (!nib) return;
    nib.classList.add('on');
    nib.style.transform = `translate(${word.offsetLeft + word.offsetWidth}px, ${word.offsetTop - 12}px)`;
  };

  const apply = token => {
    if (token[0] === '\n') { atLineStart = true; block = null; if (token.length > 1) list = null; return; }
    if (token === ' ' || !token.trim()) { if (block) block.append(' '); return; }
    if (/^\[\d/.test(token) && token.endsWith(']')) addCite(token);
    else addWord(token);
  };

  const loop = now => {
    const rate = Math.max(WORDS_PER_SECOND[prefs.reveal] || 16, queue.length * 2.2);
    credit += (now - (lastTime || now)) / 1000 * rate;
    lastTime = now;
    while (queue.length && (credit >= 1 || instant || !queue[0].trim())) {
      const token = queue.shift();
      apply(token);
      if (token.trim()) credit -= 1;
    }
    if (credit > 2) credit = 2;
    if (queue.length) { requestAnimationFrame(loop); return; }
    running = false;
    lastTime = 0;
    if (finished) { nib?.classList.remove('on'); resolveDone?.(); }
  };

  const drain = final => {
    const hold = final ? -1 : pending.search(/\[[\d,\s]*$/);
    const text = hold >= 0 ? pending.slice(0, hold) : pending;
    let consumed = 0, match;
    TOKEN.lastIndex = 0;
    while ((match = TOKEN.exec(text))) {
      const end = match.index + match[0].length;
      if (!final && end === text.length && match[0].trim()) break; // the word may not be complete yet
      queue.push(match[0]);
      consumed = end;
    }
    pending = pending.slice(consumed);
    if (queue.length && !running) { running = true; requestAnimationFrame(loop); }
  };

  return {
    push(text) { pending += text; drain(false); },
    finish() {
      finished = true;
      drain(true);
      return new Promise(resolve => {
        resolveDone = resolve;
        if (!running && !queue.length) { nib?.classList.remove('on'); resolve(); }
      });
    },
  };
}

/** Write text straight away, for pages opened from history. */
export function writeInstant(target, text) {
  let block = null, list = null, bold = false;
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) { list = null; continue; }
    const bullet = trimmed.match(/^([-*•]|\d+[.)])\s+(.*)$/);
    if (bullet) {
      if (!list) { list = document.createElement('ul'); target.append(list); }
      block = document.createElement('li');
      if (/\d/.test(bullet[1])) block.dataset.marker = bullet[1];
      list.append(block);
    } else {
      list = null;
      block = document.createElement('p');
      target.append(block);
    }
    const content = bullet ? bullet[2] : trimmed;
    let match;
    TOKEN.lastIndex = 0;
    while ((match = TOKEN.exec(content))) {
      const token = match[0];
      if (!token.trim()) { block.append(' '); continue; }
      if (/^\[\d/.test(token) && token.endsWith(']')) {
        for (const n of token.match(/\d+/g)) {
          const chip = document.createElement('button');
          chip.type = 'button';
          chip.className = 'cite';
          chip.dataset.n = n;
          chip.textContent = n;
          chip.setAttribute('aria-label', `Source ${n}`);
          block.append(chip);
        }
        continue;
      }
      token.split('**').forEach((piece, i) => {
        if (i > 0) bold = !bold;
        if (!piece) return;
        const word = document.createElement('span');
        word.className = bold ? 'w settled b' : 'w settled';
        word.textContent = piece;
        block.append(word);
      });
    }
  }
}

/** Mark the sentence of a source that overlaps the answer most, with a highlighter sweep. */
export function highlightBest(host, text, answer) {
  const answerWords = new Set((answer.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || []));
  const sentences = text.match(/[^.!?\n]+[.!?]*\s*/g) || [text];
  let best = -1, bestScore = 0;
  sentences.forEach((sentence, i) => {
    const words = sentence.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || [];
    const score = words.filter(word => answerWords.has(word)).length;
    if (score > bestScore) { bestScore = score; best = i; }
  });
  sentences.forEach((sentence, i) => {
    if (i === best && bestScore >= 2) {
      const mark = document.createElement('mark');
      mark.textContent = sentence;
      host.append(mark);
    } else host.append(sentence);
  });
}
