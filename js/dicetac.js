GAMES.push({
  id: 'dicetac',
  title: 'Dice Tic-Tac-Toe',
  blurb: 'Two boards, six columns. The die decides where you can play.',
  rules: 'Each column has a die face above it. Roll, then put your mark in any empty square of that column. Column already full? You lose the turn. Get three in a row on either board to win.',
  thumb: `<g stroke="#333" fill="none" stroke-width="1.3"><path d="M6 20h40v40H6zM6 33h40M6 47h40M19 20v40M33 20v40M54 20h40v40H54zM54 33h40M54 47h40M67 20v40M81 20v40"/>
    <rect x="8" y="4" width="10" height="10" rx="2"/><rect x="21" y="4" width="10" height="10" rx="2"/><rect x="35" y="4" width="10" height="10" rx="2"/><rect x="56" y="4" width="10" height="10" rx="2"/><rect x="69" y="4" width="10" height="10" rx="2"/><rect x="83" y="4" width="10" height="10" rx="2"/></g>
    <path d="M84 23l8 8M92 23l-8 8M10 37l7 7M17 37l-7 7" stroke="#2448b8" stroke-width="2" stroke-linecap="round"/><circle cx="74" cy="40" r="4.5" stroke="#d23c35" stroke-width="2" fill="none"/><circle cx="26" cy="53" r="4.5" stroke="#d23c35" stroke-width="2" fill="none"/>`,

  mount(root, ctx) {
    const C = ['#2448b8', '#d23c35'], N = ['X', 'O'];
    const name = p => ctx.who(N[p], C[p], p);
    const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
    const X0 = [20, 350], Y0 = 96, S = 90;
    const board = Array(18).fill(-1); // index = grid*9 + row*3 + col
    let turn = 0, roll = 0, over = false;
    const status = statusLine(), die = makeDie();
    const btn = h('button', { onclick: () => over ? ctx.restart() : ctx.mine(turn) && !roll && ctx.dispatch({ t: 'roll', n: rnd(6) }) }, 'Roll');
    const sync = () => { btn.disabled = !over && (roll > 0 || !ctx.mine(turn)); ctx.turn(turn, C, N, over); };
    const svg = svgRoot(640, 390);
    const hi = s('rect', { class: 'hi', width: S, height: 3 * S, y: Y0, x: -999 }, svg);
    const g = s('g', { class: 'ink', fill: 'none', stroke: '#2b2b2b', 'stroke-width': 2.6 }, svg);
    root.append(status, h('div', { class: 'controls' }, die, btn), svg);

    const colOf = n => [n > 3 ? 1 : 0, (n - 1) % 3];
    const centre = (gi, r, c) => [X0[gi] + c * S + S / 2, Y0 + r * S + S / 2];
    for (let n = 1; n <= 6; n++) {
      const [gi, c] = colOf(n), fx = X0[gi] + c * S + 15;
      s('rect', { x: fx, y: 14, width: 60, height: 60, rx: 9 }, g);
      for (const k of PIPS[n]) s('circle', { cx: fx + 12 + (k % 3) * 18, cy: 26 + Math.floor(k / 3) * 18, r: 4.5, fill: '#2b2b2b', stroke: 'none' }, g);
    }
    for (const gi of [0, 1]) {
      const x = X0[gi];
      s('path', { d: `M${x} ${Y0}h${3 * S}v${3 * S}h${-3 * S}ZM${x + S} ${Y0}v${3 * S}M${x + 2 * S} ${Y0}v${3 * S}M${x} ${Y0 + S}h${3 * S}M${x} ${Y0 + 2 * S}h${3 * S}` }, g);
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
        const cell = s('rect', { class: 'cell', x: x + c * S, y: Y0 + r * S, width: S, height: S }, svg);
        cell.addEventListener('click', () => {
          if (!roll || !ctx.mine(turn)) return;
          const [rg, rc] = colOf(roll);
          if (gi === rg && c === rc && board[gi * 9 + r * 3 + c] < 0) ctx.dispatch({ t: 'place', gi, r, c });
        });
      }
    }

    const prompt = pre => { status.set(`${pre || ''}${name(turn)}'s turn. Roll the die!`); sync(); };
    prompt();

    ctx.apply = async a => {
      if (a.t === 'roll') {
        btn.disabled = true;
        const n = await die.roll(a.n), [gi, c] = colOf(n);
        if (![0, 1, 2].some(r => board[gi * 9 + r * 3 + c] < 0)) {
          turn = 1 - turn;
          return prompt(`Rolled ${n}, but that column is full. Turn lost!<br>`);
        }
        roll = n;
        hi.setAttribute('x', X0[gi] + c * S);
        status.set(`${name(turn)} rolled <b>${n}</b>. Pick a square in the highlighted column.`);
        return sync();
      }
      const { gi, r, c } = a; // 'place'
      board[gi * 9 + r * 3 + c] = turn;
      roll = 0;
      hi.setAttribute('x', -999);
      const [x, y] = centre(gi, r, c);
      if (turn === 0) inkX(g, x, y, 25, C[0], 5);
      else s('circle', { cx: x, cy: y, r: 28, stroke: C[1], 'stroke-width': 5, pathLength: 1, class: 'drawn' }, g);
      const line = LINES.find(l => l.every(j => board[gi * 9 + j] === turn));
      if (line) {
        const [p, q] = [line[0], line[2]].map(j => centre(gi, Math.floor(j / 3), j % 3));
        s('path', { d: `M${p[0]} ${p[1]}L${q[0]} ${q[1]}`, stroke: C[turn], 'stroke-width': 7, 'stroke-linecap': 'round', pathLength: 1, class: 'drawn' }, g);
        over = true; btn.textContent = 'Play again';
        status.set(`Three in a row! ${name(turn)} wins!`);
        return sync();
      }
      if (board.every(v => v >= 0)) {
        over = true; btn.textContent = 'Play again';
        status.set("Every square is full. It's a draw!");
        return sync();
      }
      turn = 1 - turn;
      prompt();
    };
  },
});
