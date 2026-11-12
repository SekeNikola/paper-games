GAMES.push({
  id: 'battleship',
  title: 'Dice Battleship',
  blurb: 'Two dice pick the square. Sink all six boats.',
  rules: "Each sea has 6 boats. Roll two dice: the first is the row, the second the column. That square lights up in your opponent's sea. Click it to fire! Already shot there? Wasted turn. First to sink all 6 enemy boats wins.",
  thumb: `<path d="M20 6h60v58H20zM20 25h60M20 45h60M40 6v58M60 6v58" stroke="#333" fill="none" stroke-width="1.3"/>
    <path d="M43 36h14l-3 5h-8z" fill="#fff" stroke="#333"/><path d="M50 36v-8l6 6z" fill="#d23c35"/>
    <path d="M24 10l12 11M36 10l-12 11M64 49l12 11M76 49l-12 11M43 28l14 14M57 28l-14 14" stroke="#2448b8" stroke-width="2.4" stroke-linecap="round"/>`,

  mount(root, ctx) {
    const C = ['#d23c35', '#2448b8'], N = ['Red', 'Blue'];
    const name = p => ctx.who(N[p], C[p], p);
    const seas = [0, 1].map(() => {
      const ships = new Set();
      while (ships.size < 6) ships.add(rnd(6, ctx.rng) * 10 + rnd(6, ctx.rng));
      return { ships, shots: new Set(), hits: 0 };
    });
    let turn = 0, over = false, target = null; // target = [row, col] waiting to be clicked
    const status = statusLine(), d1 = makeDie(), d2 = makeDie();
    const btn = h('button', { onclick: () => over ? ctx.restart() : ctx.mine(turn) && !target && ctx.dispatch({ t: 'roll', r: rnd(6), c: rnd(6) }) }, 'Roll the dice');
    const sync = () => { btn.disabled = !over && (!!target || !ctx.mine(turn)); ctx.turn(turn, C, N, over); };
    const pair = h('div', { class: 'pair' });
    root.append(status, h('div', { class: 'controls' }, h('div', { class: 'dlabel' }, d1, 'row'), h('div', { class: 'dlabel' }, d2, 'column'), btn), pair);

    // cell (r, c), both 1..6, is centred on (10 + 50c, 10 + 50r)
    const layers = seas.map((sea, p) => {
      const svg = svgRoot(350, 350), g = s('g', { class: 'ink' }, svg);
      for (let i = 0; i <= 6; i++) s('path', { d: `M${35 + 50 * i} 35V335M35 ${35 + 50 * i}H335`, stroke: '#2b2b2b', 'stroke-width': i % 6 ? 1.6 : 2.6, fill: 'none' }, g);
      for (let i = 1; i <= 6; i++) { text(g, 10 + 50 * i, 18, i); text(g, 16, 10 + 50 * i, i); }
      for (const k of sea.ships) {
        const x = 10 + 50 * (k % 10), y = 10 + 50 * Math.floor(k / 10);
        s('path', { d: `M${x - 17} ${y + 3}H${x + 17}L${x + 11} ${y + 14}H${x - 11}Z`, fill: '#fff', stroke: '#2b2b2b', 'stroke-width': 1.8 }, g);
        s('path', { d: `M${x - 1} ${y + 3}V${y - 16}L${x + 11} ${y - 2}Z`, fill: C[p], stroke: '#2b2b2b', 'stroke-width': 1.4 }, g);
        for (const dx of [-8, 0, 8]) s('circle', { cx: x + dx, cy: y + 8.5, r: 1.6, fill: '#2b2b2b' }, g);
      }
      const hi = s('rect', { class: 'target', width: 50, height: 50, x: -999, y: -999 }, svg);
      hi.addEventListener('click', () => target && ctx.mine(turn) && ctx.dispatch({ t: 'fire' }));
      pair.append(h('figure', {}, h('figcaption', {}, `${N[p]}'s sea`), svg));
      return { g, hi };
    });

    status.set(`${name(turn)} goes first. Roll to aim at ${N[1 - turn]}'s sea.`);
    sync();

    ctx.apply = async a => {
      const sea = layers[1 - turn];
      if (a.t === 'roll') {
        btn.disabled = true;
        await Promise.all([d1.roll(a.r), d2.roll(a.c)]);
        target = [a.r, a.c];
        sea.hi.setAttribute('x', 35 + 50 * (a.c - 1));
        sea.hi.setAttribute('y', 35 + 50 * (a.r - 1));
        status.set(`${name(turn)} rolled row ${a.r}, column ${a.c}. Click the glowing square in ${N[1 - turn]}'s sea to fire!`);
        return sync();
      }
      const [r, c] = target, data = seas[1 - turn], k = r * 10 + c; // 'fire'
      target = null;
      sea.hi.setAttribute('x', -999);
      let msg = `Row ${r}, column ${c}: `;
      if (data.shots.has(k)) msg += 'already shot there. Wasted turn!';
      else {
        data.shots.add(k);
        const hit = data.ships.has(k);
        if (hit) { data.hits++; boom(sea.g, 10 + 50 * c, 10 + 50 * r, C[turn], 32); }
        inkX(sea.g, 10 + 50 * c, 10 + 50 * r, 15, C[turn], hit ? 5 : 3);
        msg += hit ? `<b>HIT!</b> (${data.hits}/6 sunk)` : 'splash, a miss.';
      }
      if (data.hits === 6) {
        over = true;
        btn.textContent = 'Play again';
        status.set(`${msg}<br>${name(turn)} sank every boat and wins!`);
      } else {
        turn = 1 - turn;
        status.set(`${msg}<br>Now ${name(turn)} rolls.`);
      }
      sync();
    };
  },
});
