// Shared helpers. Every game pushes { id, title, blurb, rules, thumb, mount(root, ctx) } into GAMES.
// mount must set ctx.apply(action): every move (local or from the online friend) goes through it,
// so both browsers run the same moves in the same order. Board layouts use ctx.rng (shared seed).
const GAMES = [];
const NS = 'http://www.w3.org/2000/svg';
const rnd = (n, r = Math.random) => 1 + Math.floor(r() * n);
const shuffle = (a, r = Math.random) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
// names can come from the other player over the network, so always escape before putting in HTML
const esc = str => String(str).replace(/[&<>"']/g, ch => `&#${ch.charCodeAt(0)};`);
const who = (name, color) => `<b style="color:${color}">${esc(name)}</b>`;
const newSeed = () => Math.floor(Math.random() * 2 ** 32);
// mulberry32: same seed gives the same board on both computers
function seeded(seed) {
  return () => {
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
// pip positions on a 3x3 grid (0..8) for each die face
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) k.startsWith('on') ? e.addEventListener(k.slice(2), v) : e.setAttribute(k, v);
  e.append(...kids);
  return e;
}

function s(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}

const svgRoot = (w, ht, cls = '') => s('svg', { viewBox: `0 0 ${w} ${ht}`, class: 'board ' + cls });

function text(parent, x, y, str, attrs = {}) {
  const t = s('text', { x, y, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: '#2b2b2b', stroke: 'none', 'font-size': 22, ...attrs }, parent);
  t.textContent = str;
  return t;
}

// pen X that draws itself in
function inkX(parent, x, y, r, color, w = 4) {
  return s('path', { d: `M${x - r} ${y - r}L${x + r} ${y + r}M${x + r} ${y - r}L${x - r} ${y + r}`, stroke: color, 'stroke-width': w, 'stroke-linecap': 'round', fill: 'none', pathLength: 1, class: 'drawn' }, parent);
}

// comic "POW" burst + board jolt, used by every game on a hit
function boom(parent, x, y, color, r = 30) {
  const g = s('g', { transform: `translate(${x} ${y})`, 'pointer-events': 'none' }, parent);
  const b = s('g', { class: 'boom' }, g);
  let d = '';
  for (let i = 0; i < 16; i++) {
    const a = i * Math.PI / 8, k = i % 2 ? r * .45 : r;
    d += (i ? 'L' : 'M') + (Math.cos(a) * k).toFixed(1) + ' ' + (Math.sin(a) * k).toFixed(1);
  }
  s('path', { d: d + 'Z', fill: '#ffd23f', stroke: color, 'stroke-width': 3, 'stroke-linejoin': 'round' }, b);
  s('circle', { r: r * .3, fill: '#ff7a1a', stroke: 'none' }, b);
  // Web Animations API, not a CSS class: games rewrite the board's class list and would cancel it
  parent.closest('svg').animate([{ transform: 'none' }, { transform: 'translate(-4px, 2px)' }, { transform: 'translate(3px, -2px)' }, { transform: 'translate(-2px, 1px)' }, { transform: 'none' }], 300);
  setTimeout(() => g.remove(), 650);
}

function statusLine() {
  const p = h('p', { class: 'status', 'aria-live': 'polite' });
  p.set = html => { p.innerHTML = html; };
  return p;
}

// die.roll(n) tumbles for a moment and lands on n (n is decided by whoever rolled, then shared)
function makeDie() {
  const d = h('div', { class: 'die', role: 'img' });
  const show = n => {
    d.replaceChildren(...[...Array(9)].map((_, k) => h('i', { class: PIPS[n].includes(k) ? 'p' : '' })));
    d.setAttribute('aria-label', 'die showing ' + n);
  };
  d.roll = n => new Promise(res => {
    d.classList.add('rolling');
    let i = 0;
    const t = setInterval(() => {
      show(rnd(6));
      if (++i < 9) return;
      clearInterval(t);
      d.classList.remove('rolling');
      show(n);
      res(n);
    }, 60);
  });
  show(rnd(6));
  return d;
}
