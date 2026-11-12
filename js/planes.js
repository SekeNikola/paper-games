GAMES.push({
  id: 'planes',
  title: 'Plane Duel',
  blurb: 'Grow your missiles square by square. Down two planes first.',
  rules: 'Every plane has two guns. Roll the die, pick one of your guns, and its missile flies that many squares straight ahead. Missiles keep going on later turns, so a far target takes a few rolls. The guns sit on the wings, and the missile has to touch the enemy plane itself (wing, body or tail) to shoot it down. A missile that flies off the paper is gone. Destroy two planes to win.',
  thumb: `<path d="M0 10H100M0 20H100M0 30H100M0 40H100M0 50H100M0 60H100M10 0V70M20 0V70M30 0V70M40 0V70M50 0V70M60 0V70M70 0V70M80 0V70M90 0V70" stroke="#c4d3e3" stroke-width=".8"/>
    <g fill="#fff" stroke="#222" stroke-width="1.2"><path d="M30 4c3 0 4 4 4 8v8c0 3-8 3-8 0v-8c0-4 1-8 4-8z"/><path d="M70 66c-3 0-4-4-4-8v-8c0-3 8-3 8 0v8c0 4-1 8-4 8z"/></g>
    <path d="M26 11l-12 6M34 11l12 6M66 59l-12-6M74 59l12-6" stroke="#222" stroke-width="1.2"/>
    <path d="M24 22v20" stroke="#d23c35" stroke-width="2.4" stroke-linecap="round"/><path d="M76 48v-34" stroke="#2448b8" stroke-width="2.4" stroke-linecap="round"/>`,

  mount(root, ctx) {
    const COLS = 18, ROWS = 24, S = 25, C = ['#d23c35', '#2448b8'], N = ['Red', 'Blue'];
    const name = p => ctx.who(N[p], C[p], p);
    let turn = 0, roll = 0, over = false;
    const status = statusLine(), die = makeDie();
    const btn = h('button', { onclick: () => over ? ctx.restart() : ctx.mine(turn) && !roll && ctx.dispatch({ t: 'roll', n: rnd(6) }) }, 'Roll');
    const svg = svgRoot(COLS * S, ROWS * S, 'board-planes');
    root.append(status, h('div', { class: 'controls' }, die, btn), svg);

    let grid = '';
    for (let i = 0; i <= COLS; i++) grid += `M${i * S} 0V${ROWS * S}`;
    for (let j = 0; j <= ROWS; j++) grid += `M0 ${j * S}H${COLS * S}`;
    s('path', { d: grid, stroke: '#a9bdd3', 'stroke-width': 1, fill: 'none' }, svg);
    const ink = s('g', { class: 'ink' }, svg);
    s('rect', { width: COLS * S, height: ROWS * S, fill: 'none', stroke: '#2b2b2b', 'stroke-width': 2.5 }, ink);

    // plane drawn nose-up in a 5x4-cell box (125x100); guns sit on columns 1 and 3
    function drawPlane(g, color) {
      const o = { fill: '#fff', stroke: '#222', 'stroke-width': 2.2, 'stroke-linejoin': 'round' };
      s('path', { ...o, d: 'M56 44L4 66V74L56 62ZM69 44L121 66V74L69 62Z' }, g);
      s('path', { ...o, d: 'M62.5 78L42 96H83Z' }, g);
      s('path', { ...o, d: 'M62.5 4C72 4 74 20 74 34V80C74 90 51 90 51 80V34C51 20 53 4 62.5 4Z' }, g);
      s('path', { stroke: color, 'stroke-width': 5, 'stroke-linecap': 'round', d: 'M62.5 28V70M16 66L44 56M109 66L81 56M55 10L62.5 15L70 10' }, g);
      s('path', { ...o, fill: color, d: 'M33 58h9v12h-9zM83 58h9v12h-9z' }, g);
    }

    const spread = () => {
      for (;;) {
        const xs = [0, 0, 0].map(() => Math.floor(ctx.rng() * (COLS - 4))).sort((a, b) => a - b);
        if (xs[1] - xs[0] >= 5 && xs[2] - xs[1] >= 5) return xs;
      }
    };
    const planes = [], guns = [];
    for (const p of [0, 1]) for (const x of spread()) {
      const stagger = ctx.rng() < .5 ? 2 : 0, y = p ? ROWS - 4 - stagger : stagger;
      const pl = { p, x, y, alive: true };
      drawPlane(s('g', { transform: `translate(${x * S} ${y * S})${p ? '' : ' rotate(180 62.5 50)'}` }, ink), C[p]);
      pl.guns = [1, 3].map(dx => {
        const gun = { i: guns.length, pl, c: x + dx, len: 0, spent: false };
        const gx = (gun.c + .5) * S, gy = y * S + (p ? 64 : 36); // on the wing engine
        gun.line = s('line', { x1: gx, x2: gx, y1: gy, y2: gy, stroke: C[p], 'stroke-width': 4, 'stroke-linecap': 'round' }, ink);
        gun.dot = s('circle', { cx: gx, cy: gy, r: 9, fill: C[p], stroke: '#222', 'stroke-width': 1.5, class: 'gun' }, svg);
        gun.dot.addEventListener('click', () => ready(gun) && ctx.mine(turn) && ctx.dispatch({ t: 'fire', i: gun.i }));
        guns.push(gun);
        return gun;
      });
      planes.push(pl);
    }

    // cells a plane really covers in its 5x4 box (nose-up): body column, wing row, tail row
    function occupies(q, c, r) {
      if (c < q.x || c > q.x + 4 || r < q.y || r > q.y + 3) return false;
      const lc = c - q.x, lr = q.p ? r - q.y : 3 - (r - q.y);
      return lc === 2 || lr === 2 || (lr === 3 && lc >= 1 && lc <= 3);
    }
    const usable = p => guns.filter(g => g.pl.p === p && g.pl.alive && !g.spent);
    const ready = g => roll > 0 && g.pl.p === turn && g.pl.alive && !g.spent;
    const kills = p => planes.filter(q => q.p !== p && !q.alive).length;
    function sync() {
      btn.disabled = !over && (roll > 0 || !ctx.mine(turn));
      for (const g of guns) {
        g.dot.classList.toggle('ready', ready(g));
        g.dot.classList.toggle('off', !g.pl.alive || g.spent);
      }
      ctx.turn(turn, C, N, over);
    }
    const prompt = pre => { status.set(`${pre || ''}${name(turn)}'s turn. Roll the die!`); sync(); };
    prompt();

    function tween(line, to) {
      const from = +line.getAttribute('y2'), t0 = performance.now();
      (function step(t) {
        const k = Math.min(1, (t - t0) / 350);
        line.setAttribute('y2', from + (to - from) * k);
        if (k < 1) requestAnimationFrame(step);
      })(t0);
    }

    function nextTurn(msg) {
      turn = 1 - turn;
      if (!usable(turn).length) {
        if (!usable(1 - turn).length) {
          over = true; btn.textContent = 'Play again';
          const k0 = kills(0), k1 = kills(1);
          status.set(`${msg}<br>Out of missiles! ` + (k0 === k1 ? "It's a draw." : `${name(k0 > k1 ? 0 : 1)} downed more planes and wins!`));
          return sync();
        }
        msg += `<br>${name(turn)} has no missiles left and skips.`;
        turn = 1 - turn;
      }
      prompt(msg + '<br>');
    }

    ctx.apply = async a => {
      if (a.t === 'roll') {
        btn.disabled = true;
        roll = await die.roll(a.n);
        status.set(`${name(turn)} rolled <b>${roll}</b>. Click a glowing gun to fire.`);
        return sync();
      }
      // 'fire': the missile leaves the wing and flies toward the enemy one cell at a time
      const gun = guns[a.i], pl = gun.pl, dir = pl.p ? -1 : 1, start = pl.p ? pl.y + 1 : pl.y + 2;
      const next = () => start + dir * gun.len;
      const offPaper = () => next() < 0 || next() >= ROWS;
      let downed = null, row = 0;
      for (let k = 0; k < roll && !downed && !offPaper(); k++) {
        row = next();
        gun.len++;
        downed = planes.find(q => q.p !== pl.p && q.alive && occupies(q, gun.c, row));
      }
      tween(gun.line, pl.p ? (start - gun.len + 1) * S : (start + gun.len) * S);
      let msg = `The missile flies ${roll} square${roll > 1 ? 's' : ''}. Not there yet!`;
      if (downed) {
        downed.alive = false; gun.spent = true;
        boom(ink, (gun.c + .5) * S, (row + .5) * S, C[pl.p], 40);
        inkX(ink, (downed.x + 2.5) * S, (downed.y + 2) * S, 48, C[pl.p], 6);
        msg = '<b>BOOM!</b> Plane down.';
      } else if (offPaper()) {
        gun.spent = true;
        msg = 'The missile flew off the paper. Missed!';
      }
      roll = 0;
      if (kills(turn) >= 2) {
        over = true; btn.textContent = 'Play again';
        status.set(`${msg}<br>${name(turn)} destroyed two planes and wins!`);
        return sync();
      }
      nextTurn(msg);
    };
  },
});
