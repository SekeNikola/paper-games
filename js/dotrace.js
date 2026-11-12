GAMES.push({
  id: 'dotrace',
  title: 'Dot Race',
  blurb: 'The die picks your direction. First to the bottom wins.',
  rules: 'The table at the top turns each roll into a direction. Roll, and your line moves one dot that way. If the move would leave the dots, you stay put. The first line to reach the bottom row wins.',
  thumb: `<g fill="#222"><circle cx="20" cy="10" r="1.6"/><circle cx="35" cy="10" r="1.6"/><circle cx="50" cy="10" r="1.6"/><circle cx="65" cy="10" r="1.6"/><circle cx="80" cy="10" r="1.6"/>
    <circle cx="20" cy="25" r="1.6"/><circle cx="35" cy="25" r="1.6"/><circle cx="50" cy="25" r="1.6"/><circle cx="65" cy="25" r="1.6"/><circle cx="80" cy="25" r="1.6"/>
    <circle cx="20" cy="40" r="1.6"/><circle cx="35" cy="40" r="1.6"/><circle cx="50" cy="40" r="1.6"/><circle cx="65" cy="40" r="1.6"/><circle cx="80" cy="40" r="1.6"/>
    <circle cx="20" cy="55" r="1.6"/><circle cx="35" cy="55" r="1.6"/><circle cx="50" cy="55" r="1.6"/><circle cx="65" cy="55" r="1.6"/><circle cx="80" cy="55" r="1.6"/></g>
    <circle cx="35" cy="10" r="4" stroke="#d23c35" fill="none" stroke-width="1.4"/><path d="M35 10v15l15 15v15" stroke="#d23c35" stroke-width="2" fill="none"/><path d="M65 10v15l-15 15" stroke="#2448b8" stroke-width="2" fill="none"/>`,

  mount(root, ctx) {
    const C = ['#d23c35', '#2448b8'], N = ['Red', 'Blue'];
    const name = p => ctx.who(N[p], C[p], p);
    // read off the paper in the video: 1 down, 2 up-right, 3 down-right, 4 left, 5 down-left, 6 down
    const DIR = { 1: [0, 1], 2: [1, -1], 3: [1, 1], 4: [-1, 0], 5: [-1, 1], 6: [0, 1] };
    const ARROW = { 1: '↓', 2: '↗', 3: '↘', 4: '←', 5: '↙', 6: '↓' };
    const COLS = 7, ROWS = 9, GAP = 60, OX = 40, OY = 150;
    const W = OX * 2 + GAP * (COLS - 1), H = OY + GAP * (ROWS - 1) + 50;
    const px = c => OX + c * GAP, py = r => OY + r * GAP;
    let turn = 0, over = false, target = null; // target = [col, row] waiting to be clicked
    const pos = [[2, 0], [4, 0]];
    const status = statusLine(), die = makeDie();
    const btn = h('button', { onclick: () => over ? ctx.restart() : ctx.mine(turn) && !target && ctx.dispatch({ t: 'roll', n: rnd(6) }) }, 'Roll');
    const sync = () => { btn.disabled = !over && (!!target || !ctx.mine(turn)); ctx.turn(turn, C, N, over); };
    const svg = svgRoot(W, H, 'board-dots');
    root.append(status, h('div', { class: 'controls' }, die, btn), svg);

    const hi = s('rect', { class: 'hi', y: 14, width: 50, height: 104, x: -999 }, svg);
    const ink = s('g', { class: 'ink', fill: 'none', stroke: '#2b2b2b', 'stroke-width': 2.4, 'stroke-linecap': 'round' }, svg);
    s('path', { d: 'M62 66H378' }, ink);
    for (let k = 1; k <= 6; k++) {
      const x = 45 + k * 50;
      text(ink, x, 40, k, { 'font-size': 32 });
      text(ink, x, 92, ARROW[k], { 'font-size': 32 });
      if (k > 1) s('path', { d: `M${x - 25} 16V116` }, ink);
    }
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) s('circle', { cx: px(c), cy: py(r), r: 4.5, fill: '#1d1d1d', stroke: 'none' }, ink);
    s('path', { d: `M${px(0) - 16} ${py(ROWS - 1) + 22}H${px(COLS - 1) + 16}`, 'stroke-dasharray': '2 8' }, ink);
    text(ink, W / 2, py(ROWS - 1) + 38, 'finish', { fill: '#777', 'font-size': 18 });
    const tips = pos.map(([c, r], p) => {
      s('circle', { cx: px(c), cy: py(r), r: 12, stroke: C[p] }, ink);
      return s('circle', { cx: px(c), cy: py(r), r: 7, fill: C[p], stroke: 'none' }, svg);
    });

    const ring = s('circle', { class: 'target', r: 16, cx: -999, cy: -999 }, svg);
    ring.addEventListener('click', () => target && ctx.mine(turn) && ctx.dispatch({ t: 'move' }));

    status.set(`${name(turn)} goes first. Roll the die!`);
    sync();

    function pass(msg) {
      turn = 1 - turn;
      status.set(`${msg}<br>Now ${name(turn)} rolls.`);
      sync();
    }

    ctx.apply = async a => {
      if (a.t === 'roll') {
        btn.disabled = true;
        hi.setAttribute('x', 20 + a.n * 50);
        await die.roll(a.n);
        const [dx, dy] = DIR[a.n], [x, y] = pos[turn], nx = x + dx, ny = y + dy;
        const msg = `${name(turn)} rolled ${a.n} (${ARROW[a.n]})`;
        if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) return pass(msg + ', but that leaves the dots. Stay put.');
        target = [nx, ny];
        ring.setAttribute('cx', px(nx));
        ring.setAttribute('cy', py(ny));
        status.set(`${msg}. Click the glowing dot to draw your line.`);
        return sync();
      }
      const [x, y] = pos[turn], [nx, ny] = target; // 'move'
      target = null;
      ring.setAttribute('cx', -999);
      s('path', { d: `M${px(x)} ${py(y)}L${px(nx)} ${py(ny)}`, stroke: C[turn], 'stroke-width': 4, pathLength: 1, class: 'drawn' }, ink);
      pos[turn] = [nx, ny];
      tips[turn].setAttribute('cx', px(nx));
      tips[turn].setAttribute('cy', py(ny));
      if (ny === ROWS - 1) {
        over = true; btn.textContent = 'Play again';
        status.set(`${name(turn)} reached the bottom and wins!`);
        return sync();
      }
      pass(`${name(turn)} moved.`);
    };
  },
});
