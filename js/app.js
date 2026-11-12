// Menu, routing, and online play (PeerJS / WebRTC, host = player 1, friend = player 2).
const ROOM_PREFIX = 'papergames-';
let session = null;  // { peer, conn } while online
let current = null;  // ctx of the game on screen

function menu(app) {
  document.title = 'Paper Games';
  const cards = h('div', { class: 'cards' });
  for (const g of GAMES) {
    const a = h('a', { href: '#' + g.id, class: 'card' });
    a.innerHTML = `<svg viewBox="0 0 100 70" class="thumb ink" aria-hidden="true">${g.thumb}</svg><h2>${g.title}</h2><p>${g.blurb}</p>`;
    cards.append(a);
  }
  app.append(h('header', { class: 'slip' }, h('h1', {}, 'Paper Games'), h('p', {}, 'One sheet of paper, one die, two players. Play on one device or send a link to a friend.')), cards);
}

function route() {
  const app = document.getElementById('app');
  const g = GAMES.find(x => '#' + x.id === location.hash);
  const room = new URLSearchParams(location.search).get('room');
  if (session && !(g && room)) { session.peer.destroy(); session = null; }
  current = null;
  app.replaceChildren();
  scrollTo(0, 0);
  if (!g) {
    if (room) history.replaceState(null, '', location.pathname);
    return menu(app);
  }
  document.title = g.title + ' · Paper Games';
  const bar = h('div', { class: 'netbar' }), area = h('div');
  turnBar = { el: h('div', { class: 'players', 'aria-live': 'polite' }), me: null, turn: 0, over: false, C: ['#333', '#333'], N: ['Player 1', 'Player 2'] };
  app.append(h('a', { href: location.pathname + '#', class: 'back' }, '← all games'),
    h('section', { class: 'sheet' }, h('h1', {}, g.title), h('p', { class: 'rules' }, g.rules), bar, turnBar.el, area));
  if (room) return join(room, g, bar, area);
  names = [load('pg-name'), load('pg-name2')];
  bar.replaceChildren(h('span', {}, 'Playing on this device.'), ...nameInputs(null, null),
    h('button', { onclick: () => host(g, bar, area) }, 'Play online with a friend'));
  play(g, area, newSeed(), null, null);
}

// ---- player names + whose-turn bar ----
let names = ['', ''];  // '' means "use the game's colour name"
let turnBar = null;    // { el, me, turn, over, C, N }
const load = k => { try { return localStorage.getItem(k) || ''; } catch { return ''; } };
const store = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

function paintTurn() {
  const { el, me, turn, over, C, N } = turnBar;
  el.replaceChildren(...[0, 1].map(p => h('span', { class: 'chip' + (p === turn && !over ? ' on' : ''), style: `--c:${C[p]}` },
    (names[p] || N[p]) + (me === p ? ' (you)' : '') + (p === turn && !over ? "'s turn" : ''))));
}

function nameInputs(me, conn) {
  return (me == null ? [0, 1] : [me]).map(p => h('input', {
    class: 'name', maxlength: 16, value: names[p], 'aria-label': me == null ? `Player ${p + 1} name` : 'Your name',
    placeholder: me == null ? `Player ${p + 1} name` : 'Your name',
    oninput: e => {
      names[p] = e.target.value.trim().slice(0, 16);
      store(me == null && p === 1 ? 'pg-name2' : 'pg-name', names[p]);
      paintTurn();
      conn?.send({ t: 'name', p, name: names[p] });
    },
  }));
}

function play(g, area, seed, me, conn) {
  let queue = Promise.resolve();
  turnBar.me = me;
  const ctx = {
    me, rng: seeded(seed),
    mine: p => me == null || me === p,
    who: (name, color, p) => who(names[p] || name, color) + (me === p ? ' (you)' : ''),
    // games call this whenever the turn changes so the players bar stays right
    turn(turn, C, N, over) { Object.assign(turnBar, { turn, C, N, over }); paintTurn(); },
    dispatch(a, remote) {
      if (!remote && conn) conn.send(a);
      queue = queue.then(() => ctx.apply(a));
    },
    restart() {
      const s2 = newSeed();
      if (conn) conn.send({ t: 'restart', seed: s2 });
      play(g, area, s2, me, conn);
    },
  };
  current = ctx;
  area.replaceChildren();
  g.mount(area, ctx);
}

function host(g, bar, area) {
  if (!window.Peer) return bar.replaceChildren('Online play could not load. Check your internet connection.');
  const code = Math.random().toString(36).slice(2, 8);
  const peer = new Peer(ROOM_PREFIX + code);
  session = { peer };
  const link = location.href.split(/[?#]/)[0] + '?room=' + code + '#' + g.id;
  const copy = h('button', { onclick: () => navigator.clipboard?.writeText(link).then(() => { copy.textContent = 'Copied!'; }) }, 'Copy');
  bar.replaceChildren(h('p', {}, 'Send this link to your friend:'), h('input', { value: link, readonly: '', onclick: e => e.target.select() }), copy,
    h('p', {}, 'Waiting for your friend to open it…'));
  peer.on('connection', conn => {
    if (session.conn) return conn.close(); // room already has two players
    conn.on('open', () => {
      wire(g, bar, area, peer, conn, 0);
      const seed = newSeed();
      conn.send({ t: 'restart', seed });
      play(g, area, seed, 0, conn);
    });
  });
  peer.on('error', e => bar.replaceChildren(`Online connection problem (${e.type}). Reload the page to try again.`));
}

function join(code, g, bar, area) {
  if (!window.Peer) return bar.replaceChildren('Online play could not load. Check your internet connection.');
  const peer = new Peer();
  session = { peer };
  bar.replaceChildren('Connecting to your friend…');
  peer.on('open', () => wire(g, bar, area, peer, peer.connect(ROOM_PREFIX + code, { reliable: true }), 1));
  peer.on('error', e => bar.replaceChildren(e.type === 'peer-unavailable'
    ? 'That game room is closed. Ask your friend for a new link.'
    : `Online connection problem (${e.type}). Reload the page to try again.`));
}

// moves from the friend: 'restart' starts a fresh board with their seed, everything else is a game move
function wire(g, bar, area, peer, conn, me) {
  session.conn = conn;
  names = ['', ''];
  names[me] = load('pg-name');
  conn.on('data', d => {
    if (d.t === 'restart') return play(g, area, d.seed, me, conn);
    if (d.t === 'name') { names[1 - me] = String(d.name ?? '').slice(0, 16); return paintTurn(); } // friend can only rename themselves
    current?.dispatch(d, true);
  });
  const hello = () => conn.send({ t: 'name', p: me, name: names[me] });
  conn.open ? hello() : conn.on('open', hello);
  conn.on('close', () => bar.replaceChildren('Your friend left the game.', h('a', { href: location.pathname + '#' + g.id }, 'Start a new one')));
  bar.replaceChildren(h('span', { class: 'you' }, `Online! You are player ${me + 1}.`), ...nameInputs(me, conn), voice(peer, conn.peer));
}

// optional voice chat over the same WebRTC link
function voice(peer, friendId) {
  const audio = h('audio', { autoplay: '' });
  let call = null, incoming = null, mic = null;
  const btn = h('button', { onclick: toggle }, 'Start voice chat');
  peer.on('call', c => { incoming = c; if (!call) btn.textContent = 'Your friend is talking: join voice'; });

  async function toggle() {
    if (call) return call.close();
    try { mic = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch { btn.textContent = 'Microphone blocked'; return; }
    if (incoming) { incoming.answer(mic); call = incoming; incoming = null; }
    else call = peer.call(friendId, mic);
    btn.textContent = 'End voice chat';
    call.on('stream', st => { audio.srcObject = st; audio.play().catch(() => {}); });
    call.on('close', () => { mic.getTracks().forEach(t => t.stop()); call = null; btn.textContent = 'Start voice chat'; });
  }
  return h('span', {}, btn, audio);
}

addEventListener('hashchange', route);
route();
