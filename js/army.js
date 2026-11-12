GAMES.push({
  id: 'army',
  title: 'Stick Army',
  blurb: 'Soldiers, tanks and a commander. Wipe out the other side.',
  rules: 'Roll the die, then attack the enemy half: cross out that many soldiers, OR, if you rolled the exact number on an enemy tank or the commander (1), blow it up instead. Destroy the whole enemy team to win.',
  thumb: `<path d="M8 35q4-6 8 0t8 0t8 0t8 0t8 0t8 0t8 0t8 0t8 0t8 0t8 0" stroke="#7a4a2e" fill="none" stroke-width="1.3"/>
    <g stroke="#e0712a" fill="none" stroke-width="1.6" stroke-linecap="round"><circle cx="22" cy="9" r="3.5"/><path d="M22 12.5v9m-5-6l5 1l5-1m-5 6l-4 6m4-6l4 6"/><circle cx="74" cy="9" r="3.5"/><path d="M74 12.5v9m-5-6l5 1l5-1m-5 6l-4 6m4-6l4 6"/>
    <path d="M40 24a9 7 0 0 1 18 0zM55 20l9-4"/><rect x="37" y="24" width="24" height="6" rx="3"/></g>
    <g stroke="#1d9752" fill="none" stroke-width="1.6" stroke-linecap="round"><circle cx="30" cy="45" r="3.5"/><path d="M30 48.5v9m-5-6l5 1l5-1m-5 6l-4 6m4-6l4 6"/><circle cx="68" cy="45" r="3.5"/><path d="M68 48.5v9m-5-6l5 1l5-1m-5 6l-4 6m4-6l4 6"/></g>
    <path d="M22 44l16 18M38 44l-16 18" stroke="#e0712a" stroke-width="2" stroke-linecap="round"/>`,

  mount(root, ctx) {
    const C = ['#e0712a', '#1d9752'], N = ['Orange', 'Green'], W = 640, H = 660, MID = H / 2;
    const name = p => ctx.who(N[p], C[p], p);
    let turn = 0, roll = 0, crossed = 0, over = false;
    const status = statusLine(), die = makeDie();
    const btn = h('button', { onclick: () => over ? ctx.restart() : ctx.mine(turn) && !roll && ctx.dispatch({ t: 'roll', n: rnd(6) }) }, 'Roll');
    const done = h('button', { onclick: () => ctx.mine(turn) && roll && ctx.dispatch({ t: 'end' }) }, 'End turn');
    const svg = svgRoot(W, H), ink = s('g', { class: 'ink', 'stroke-width': 2.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none' }, svg);
    root.append(status, h('div', { class: 'controls' }, die, btn, done), svg);

    // the "eeee" barbed-wire line between the armies
    let d = `M14 ${MID}`;
    for (let x = 14; x < W - 24; x += 14) d += 'c8 0 10-11 3-11c-7 0-6 11 11 11';
    s('path', { d, stroke: '#7a4a2e', 'stroke-width': 2 }, ink);

    const stick = g => { s('path', { d: 'M0-9V9M-10-2L0 1L10-2M0 9L-8 22M0 9L8 22' }, g); s('circle', { cy: -16, r: 7 }, g); };
    const commander = (g, c) => {
      s('path', { d: 'M0-6V12M-11 2L0 5L11 2M0 12L-8 25M0 12L8 25' }, g);
      s('circle', { cy: -20, r: 13, fill: c }, g);
      text(g, 0, -19, '1', { fill: '#fff', 'font-size': 18 });
    };
    const tank = (g, n, c) => {
      s('path', { d: 'M-20 0A20 17 0 0 1 20 0ZM15-9L36-17' }, g);
      s('rect', { x: -30, y: 0, width: 60, height: 13, rx: 6.5 }, g);
      for (const x of [-20, -10, 0, 10, 20]) s('circle', { cx: x, cy: 6.5, r: 3.6 }, g);
      text(g, 0, -7, n, { fill: c, 'font-size': 17 });
    };

    // each side: commander (1), tanks 3/5/6 and 16 soldiers, scattered at random without overlapping
    const R = n => n > 1 ? 40 : 22; // footprint radius, tanks are wide
    const BOX = { 0: [-14, -25, 28, 50], 1: [-16, -34, 32, 60], t: [-32, -20, 70, 35] }; // click areas
    const armies = [0, 1].map(p => {
      const kinds = [1, 3, 5, 6, ...Array(16).fill(0)], spots = [];
      for (let tries = 0; spots.length < kinds.length; tries++) {
        const n = kinds[spots.length], slack = 12 - Math.floor(tries / 300) * 4; // loosen if it gets crowded
        const x = 44 + ctx.rng() * (W - 88);
        const y = p ? MID + 42 + ctx.rng() * (MID - 72) : 40 + ctx.rng() * (MID - 72);
        if (spots.every(q => Math.hypot(q.x - x, q.y - y) > R(n) + R(q.n) + slack)) spots.push({ n, x, y });
      }
      return spots.map(({ n, x, y }, i) => {
        const u = { p, i, n, x, y, alive: true, g: s('g', { transform: `translate(${x} ${y})`, class: 'unit u' + p, stroke: C[p] }, ink) };
        if (n === 1) commander(u.g, C[p]); else if (n) tank(u.g, n, C[p]); else stick(u.g);
        const [bx, by, bw, bh] = BOX[n > 1 ? 't' : n];
        s('rect', { x: bx, y: by, width: bw, height: bh, fill: 'transparent', stroke: 'none' }, u.g);
        u.g.addEventListener('click', () => click(u));
        return u;
      });
    });
    const enemy = () => armies[1 - turn];
    const soldiersLeft = () => enemy().some(v => v.alive && !v.n);

    function sync() {
      btn.disabled = !over && (roll > 0 || !ctx.mine(turn));
      done.disabled = over || !roll || !ctx.mine(turn);
      svg.setAttribute('class', 'board' + (roll && ctx.mine(turn) ? ' aim' + (1 - turn) : ''));
      ctx.turn(turn, C, N, over);
    }
    const prompt = pre => { status.set(`${pre || ''}${name(turn)}'s turn. Roll the die!`); sync(); };
    prompt();

    function click(u) {
      if (over || !roll || !ctx.mine(turn) || u.p === turn || !u.alive) return;
      if (u.n && u.n !== roll) return status.set(`That one needs an exact <b>${u.n}</b>. You rolled ${roll}.`);
      if (u.n && crossed) return status.set('You already started crossing out soldiers this turn.');
      ctx.dispatch({ t: 'hit', i: u.i });
    }

    function endTurn() { roll = 0; turn = 1 - turn; prompt(); }

    ctx.apply = async a => {
      if (a.t === 'end') return endTurn();
      if (a.t === 'roll') {
        btn.disabled = true;
        roll = await die.roll(a.n);
        crossed = 0;
        const veh = enemy().find(u => u.alive && u.n === roll);
        const opts = [];
        if (soldiersLeft()) opts.push(`cross out ${roll} soldier${roll > 1 ? 's' : ''}`);
        if (veh) opts.push(`blow up the ${roll === 1 ? 'commander' : 'tank ' + roll}`);
        status.set(`${name(turn)} rolled <b>${roll}</b>: ` + (opts.length ? opts.join(', or ') + '.' : 'nothing to hit. End the turn.'));
        return sync();
      }
      const u = enemy()[a.i]; // 'hit'
      u.alive = false;
      u.g.classList.add('dead');
      boom(ink, u.x, u.y - 4, C[turn], u.n ? 38 : 26);
      inkX(ink, u.x, u.y - 4, u.n ? 26 : 16, C[turn], 3);
      if (enemy().every(v => !v.alive)) {
        over = true; roll = 0; btn.textContent = 'Play again';
        status.set(`${name(turn)} wiped out the enemy and wins!`);
        return sync();
      }
      if (u.n) return endTurn();
      crossed++;
      if (crossed === roll || !soldiersLeft()) return endTurn();
      status.set(`${roll - crossed} more to cross out (or End turn).`);
    };
  },
});
