'use strict';

/* ---------- Card model ---------- */

const SUITS = ['♠', '♥', '♦', '♣'];
const RED_SUITS = new Set(['♥', '♦']);
const RANK_LABELS = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };

function rankLabel(rank) {
  return RANK_LABELS[rank] || String(rank);
}

function createDeck() {
  const deck = [];
  let id = 0;
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank++) {
      deck.push({
        id: id++,
        suit,
        rank,
        color: RED_SUITS.has(suit) ? 'red' : 'black',
        faceUp: false,
      });
    }
  }
  return deck;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* ---------- Game state ---------- */

let state = null;

function newGameState() {
  const deck = shuffle(createDeck());
  const columns = [[], [], [], [], [], [], []];
  let cursor = 0;
  for (let c = 0; c < 7; c++) {
    for (let r = 0; r <= c; r++) {
      const card = deck[cursor++];
      card.faceUp = r === c;
      columns[c].push(card);
    }
  }
  const stock = deck.slice(cursor).map((c) => ({ ...c, faceUp: false }));

  return {
    stock,
    waste: [],
    foundations: [[], [], [], []],
    columns,
    history: [],
    moves: 0,
    score: 0,
    startTime: null,
    elapsed: 0,
    timerInterval: null,
    won: false,
  };
}

function cloneState(s) {
  return {
    stock: s.stock.map((c) => ({ ...c })),
    waste: s.waste.map((c) => ({ ...c })),
    foundations: s.foundations.map((p) => p.map((c) => ({ ...c }))),
    columns: s.columns.map((p) => p.map((c) => ({ ...c }))),
    moves: s.moves,
    score: s.score,
  };
}

function pushHistory() {
  state.history.push(cloneState(state));
  if (state.history.length > 200) state.history.shift();
}

/* ---------- Timer ---------- */

function fmtTime(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function startTimerIfNeeded() {
  if (state.startTime !== null) return;
  state.startTime = Date.now();
  state.timerInterval = setInterval(() => {
    const el = document.getElementById('timer');
    if (el) el.textContent = fmtTime((Date.now() - state.startTime) / 1000 + state.elapsed);
  }, 1000);
}

function stopTimer() {
  if (!state) return;
  if (state.timerInterval) clearInterval(state.timerInterval);
  state.timerInterval = null;
}

/* ---------- Rules ---------- */

function canPlaceOnFoundation(card, pile) {
  if (pile.length === 0) return card.rank === 1;
  const top = pile[pile.length - 1];
  return card.suit === top.suit && card.rank === top.rank + 1;
}

function canPlaceOnColumn(card, pile) {
  if (pile.length === 0) return card.rank === 13;
  const top = pile[pile.length - 1];
  return card.color !== top.color && card.rank === top.rank - 1;
}

function pileRef(pileId) {
  if (pileId === 'stock') return state.stock;
  if (pileId === 'waste') return state.waste;
  if (pileId.startsWith('foundation-')) return state.foundations[+pileId.split('-')[1]];
  if (pileId.startsWith('column-')) return state.columns[+pileId.split('-')[1]];
  return null;
}

function isFoundation(pileId) { return pileId.startsWith('foundation-'); }
function isColumn(pileId) { return pileId.startsWith('column-'); }

/* Returns the draggable group (array of cards) starting at a card in a pile, or null. */
function getDragGroup(pileId, cardIndex) {
  const pile = pileRef(pileId);
  if (!pile) return null;
  if (pileId === 'waste') {
    return cardIndex === pile.length - 1 ? [pile[cardIndex]] : null;
  }
  if (isFoundation(pileId)) {
    return cardIndex === pile.length - 1 ? [pile[cardIndex]] : null;
  }
  if (isColumn(pileId)) {
    if (!pile[cardIndex].faceUp) return null;
    return pile.slice(cardIndex);
  }
  return null;
}

function tryMove(fromPileId, cardIndex, toPileId) {
  const group = getDragGroup(fromPileId, cardIndex);
  if (!group || group.length === 0) return false;
  if (fromPileId === toPileId) return false;

  const fromPile = pileRef(fromPileId);
  const toPile = pileRef(toPileId);
  if (!toPile) return false;

  const movingCard = group[0];

  if (isFoundation(toPileId)) {
    if (group.length !== 1) return false;
    if (!canPlaceOnFoundation(movingCard, toPile)) return false;
  } else if (isColumn(toPileId)) {
    if (!canPlaceOnColumn(movingCard, toPile)) return false;
  } else {
    return false;
  }

  pushHistory();
  startTimerIfNeeded();

  fromPile.splice(cardIndex, group.length);
  toPile.push(...group);

  let gained = 0;
  if (isFoundation(toPileId)) {
    gained += fromPileId === 'waste' ? 10 : 10;
  } else if (fromPileId === 'waste') {
    gained += 5;
  } else if (isFoundation(fromPileId)) {
    gained -= 10;
  }

  if (isColumn(fromPileId) && fromPile.length > 0 && !fromPile[fromPile.length - 1].faceUp) {
    fromPile[fromPile.length - 1].faceUp = true;
    gained += 5;
  }

  state.score = Math.max(0, state.score + gained);
  state.moves++;
  render();
  checkWin();
  return true;
}

function tryAutoMoveToFoundation(pileId, cardIndex) {
  const pile = pileRef(pileId);
  if (!pile) return false;
  if (cardIndex !== pile.length - 1) return false;
  for (let f = 0; f < 4; f++) {
    if (tryMove(pileId, cardIndex, `foundation-${f}`)) return true;
  }
  return false;
}

function drawStock() {
  pushHistory();
  startTimerIfNeeded();
  if (state.stock.length > 0) {
    const card = state.stock.pop();
    card.faceUp = true;
    state.waste.push(card);
  } else if (state.waste.length > 0) {
    while (state.waste.length) {
      const card = state.waste.pop();
      card.faceUp = false;
      state.stock.push(card);
    }
  } else {
    state.history.pop();
    return;
  }
  state.moves++;
  render();
}

function checkWin() {
  const total = state.foundations.reduce((n, p) => n + p.length, 0);
  if (total === 52 && !state.won) {
    state.won = true;
    stopTimer();
    document.getElementById('winStats').textContent =
      `Tempo: ${fmtTime((Date.now() - state.startTime) / 1000 + state.elapsed)} · Jogadas: ${state.moves} · Pontos: ${state.score}`;
    document.getElementById('winOverlay').classList.remove('hidden');
    launchConfetti();
  }
}

function undo() {
  if (state.history.length === 0) return;
  const snap = state.history.pop();
  state.stock = snap.stock;
  state.waste = snap.waste;
  state.foundations = snap.foundations;
  state.columns = snap.columns;
  state.moves = snap.moves;
  state.score = snap.score;
  render();
}

/* ---------- Rendering ---------- */

function cardEl(card, faceUp) {
  const el = document.createElement('div');
  el.className = `card ${faceUp ? card.color : 'face-down'}`;
  el.dataset.cardId = card.id;
  if (faceUp) {
    const top = document.createElement('div');
    top.className = 'corner';
    top.innerHTML = `<div>${rankLabel(card.rank)}</div><div class="pip">${card.suit}</div>`;
    const center = document.createElement('div');
    center.className = 'center-suit';
    center.textContent = card.suit;
    const bottom = document.createElement('div');
    bottom.className = 'corner bottom';
    bottom.innerHTML = `<div>${rankLabel(card.rank)}</div><div class="pip">${card.suit}</div>`;
    el.appendChild(top);
    el.appendChild(center);
    el.appendChild(bottom);
  }
  return el;
}

function getOffsets() {
  const ch = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--card-h'));
  return { down: ch * 0.18, up: ch * 0.28 };
}

function render() {
  const { down, up } = getOffsets();

  // Stock
  const stockEl = document.getElementById('stock');
  stockEl.innerHTML = '';
  if (state.stock.length > 0) {
    const back = cardEl(state.stock[state.stock.length - 1], false);
    back.style.position = 'absolute';
    back.dataset.pile = 'stock';
    back.dataset.index = state.stock.length - 1;
    stockEl.appendChild(back);
  } else {
    const icon = document.createElement('div');
    icon.className = 'refresh-icon';
    icon.textContent = '↺';
    stockEl.appendChild(icon);
  }

  // Waste
  const wasteEl = document.getElementById('waste');
  wasteEl.innerHTML = '';
  if (state.waste.length > 0) {
    const card = state.waste[state.waste.length - 1];
    const el = cardEl(card, true);
    el.style.position = 'absolute';
    el.dataset.pile = 'waste';
    el.dataset.index = state.waste.length - 1;
    wasteEl.appendChild(el);
  }

  // Foundations
  for (let f = 0; f < 4; f++) {
    const pileEl = document.getElementById(`foundation-${f}`);
    const cards = pileEl.querySelectorAll('.card');
    cards.forEach((c) => c.remove());
    const pile = state.foundations[f];
    if (pile.length > 0) {
      const card = pile[pile.length - 1];
      const el = cardEl(card, true);
      el.style.position = 'absolute';
      el.dataset.pile = `foundation-${f}`;
      el.dataset.index = pile.length - 1;
      pileEl.appendChild(el);
    }
  }

  // Columns
  for (let c = 0; c < 7; c++) {
    const pileEl = document.getElementById(`column-${c}`);
    pileEl.innerHTML = '';
    const pile = state.columns[c];
    let offset = 0;
    pile.forEach((card, idx) => {
      const el = cardEl(card, card.faceUp);
      el.style.top = `${offset}px`;
      el.dataset.pile = `column-${c}`;
      el.dataset.index = idx;
      pileEl.appendChild(el);
      offset += card.faceUp ? up : down;
    });
    pileEl.style.height = `${Math.max(offset + (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--card-h'))), parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--card-h')))}px`;
  }

  document.getElementById('moves').textContent = state.moves;
  document.getElementById('score').textContent = state.score;
  document.getElementById('undoBtn').disabled = state.history.length === 0;
}

/* ---------- Pointer-based drag & drop ---------- */

let drag = null;

function setupInteraction() {
  const board = document.querySelector('.board');

  board.addEventListener('pointerdown', (e) => {
    const cardTarget = e.target.closest('.card');
    if (!cardTarget) {
      const stockPile = e.target.closest('#stock');
      if (stockPile) drawStock();
      return;
    }
    const pileId = cardTarget.dataset.pile;
    const index = +cardTarget.dataset.index;
    if (pileId === 'stock') { drawStock(); return; }

    const group = getDragGroup(pileId, index);
    if (!group) return;

    const groupEls = [];
    if (isColumn(pileId)) {
      const pileEl = document.getElementById(pileId);
      for (let i = index; i < state.columns[+pileId.split('-')[1]].length; i++) {
        const el = pileEl.querySelector(`.card[data-index="${i}"]`);
        if (el) groupEls.push(el);
      }
    } else {
      groupEls.push(cardTarget);
    }

    const rects = groupEls.map((el) => el.getBoundingClientRect());

    drag = {
      pileId,
      index,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      els: groupEls,
      originRects: rects,
      startTime: Date.now(),
    };

    groupEls.forEach((el, i) => {
      const r = rects[i];
      el.style.position = 'fixed';
      el.style.left = `${r.left}px`;
      el.style.top = `${r.top}px`;
      el.style.margin = '0';
      el.style.zIndex = 1000 + i;
      el.classList.add('dragging');
      document.body.appendChild(el);
    });

    board.setPointerCapture(e.pointerId);
  });

  board.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) drag.moved = true;
    drag.els.forEach((el, i) => {
      const r = drag.originRects[i];
      el.style.left = `${r.left + dx}px`;
      el.style.top = `${r.top + dy}px`;
    });
  });

  board.addEventListener('pointerup', (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const d = drag;
    drag = null;

    const wasClick = !d.moved && Date.now() - d.startTime < 400;

    if (wasClick) {
      d.els.forEach((el) => el.remove());
      render();
      tryAutoMoveToFoundation(d.pileId, d.index);
      return;
    }

    d.els.forEach((el) => (el.style.pointerEvents = 'none'));
    const target = document.elementFromPoint(e.clientX, e.clientY);
    d.els.forEach((el) => (el.style.pointerEvents = ''));

    const pileEl = target ? target.closest('.pile') : null;
    let moved = false;
    if (pileEl && (pileEl.id.startsWith('foundation-') || pileEl.id.startsWith('column-'))) {
      moved = tryMove(d.pileId, d.index, pileEl.id);
    }
    d.els.forEach((el) => el.remove());
    if (!moved) render();
  });

  board.addEventListener('pointercancel', () => {
    if (drag) drag.els.forEach((el) => el.remove());
    drag = null;
    render();
  });

  document.getElementById('undoBtn').addEventListener('click', undo);
  document.getElementById('newGameBtn').addEventListener('click', startNewGame);
  document.getElementById('winNewGameBtn').addEventListener('click', () => {
    document.getElementById('winOverlay').classList.add('hidden');
    startNewGame();
  });
}

/* ---------- Confetti ---------- */

function launchConfetti() {
  const canvas = document.getElementById('confetti');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');
  const colors = ['#e8c766', '#c0392b', '#2f8b5e', '#f0ead6', '#2662aa'];
  const particles = Array.from({ length: 160 }, () => ({
    x: Math.random() * canvas.width,
    y: -20 - Math.random() * canvas.height,
    r: 4 + Math.random() * 6,
    c: colors[Math.floor(Math.random() * colors.length)],
    vy: 2 + Math.random() * 3,
    vx: -2 + Math.random() * 4,
    rot: Math.random() * Math.PI,
    vr: -0.1 + Math.random() * 0.2,
  }));
  let frames = 0;
  function tick() {
    frames++;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.6);
      ctx.restore();
    });
    if (frames < 260) requestAnimationFrame(tick);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  tick();
}

/* ---------- Boot ---------- */

function startNewGame() {
  stopTimer();
  state = newGameState();
  document.getElementById('timer').textContent = '00:00';
  document.getElementById('winOverlay').classList.add('hidden');
  render();
}

window.addEventListener('resize', () => {
  const canvas = document.getElementById('confetti');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  if (state) render();
});

document.addEventListener('DOMContentLoaded', () => {
  setupInteraction();
  startNewGame();
});
