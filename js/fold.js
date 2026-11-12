GAMES.push({
  id: 'fold',
  title: 'Fold War',
  blurb: 'Draw a dot, fold the paper, hope the ink lands on the enemy.',
  rules: 'Each player owns one page. On your turn, draw a dot on YOUR page. The paper folds shut like a book and the wet ink prints onto the other page, mirrored across the fold. If the print touches an enemy, it is destroyed. Wipe out the other side to win.',
  thumb: `<path d="M50 0v70" stroke="#999" stroke-dasharray="3 3"/>
    <g stroke="#2448b8" fill="none" stroke-width="1.6" stroke-linecap="round"><circle cx="20" cy="14" r="3.5"/><path d="M20 17.5v9m0-5l7 1m-7 4l-4 6m4-6l4 6"/><circle cx="34" cy="44" r="3.5"/><path d="M34 47.5v9m0-5l7 1m-7 4l-4 6m4-6l4 6"/></g>
    <g stroke="#c0392b" fill="none" stroke-width="1.6"><ellipse cx="78" cy="28" rx="9" ry="5"/><path d="M72 24a7 6 0 0 1 12 0M72 22l-9-1"/><ellipse cx="68" cy="56" rx="9" ry="5"/><path d="M62 52a7 6 0 0 1 12 0M62 50l-9-1"/></g>
    <circle cx="22" cy="27" r="2.4" fill="#2448b8"/><circle cx="78" cy="27" r="2.4" fill="#2448b8" opacity=".7"/><path d="M26 22q24-14 48 0" stroke="#555" fill="none" stroke-dasharray="2 2"/><path d="M71 19l3 3l-1 3" stroke="#555" fill="none"/>`,

  mount(root, ctx) {
    const PW = 380, H = 480, UNITS = 7, C = ['#2448b8', '#c0392b'], N = ['Blue', 'Red'];
    const name = p => ctx.who(N[p], C[p], p);
    const wait = ms => new Promise(r => setTimeout(r, ms));
    let turn = 0, over = false, busy = false;
    const status = statusLine();
    const again = h('button', { onclick: () => ctx.restart(), style: 'display:none' }, 'Play again');
    const fold = h('div', { class: 'fold' });
    root.append(status, h('div', { class: 'controls' }, again), fold);

    // one blank SVG per page; coordinates are local to the page, so the fold maps (x, y) to (PW - x, y)
    const pages = [0, 1].map(p => {
      const svg = svgRoot(PW, H, 'face');
      s('path', { d: `M${p ? 1 : PW - 1} 0V${H}`, stroke: '#999', 'stroke-dasharray': '6 6', 'stroke-width': 1.5 }, svg);
      const ink = s('g', { class: 'ink', fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg);
      svg.addEventListener('click', e => {
        if (over || busy || p !== turn || !ctx.mine(turn)) return;
        const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse());
        ctx.dispatch({ t: 'dot', x: Math.round(pt.x), y: Math.round(pt.y) });
      });
      fold.append(h('div', { class: 'half h' + p }, svg, h('div', { class: 'back' })));
      return ink;
    });

    const soldier = g => {
      s('circle', { cy: -24, r: 9 }, g);
      s('path', { d: 'M-9-28L9-30M0-15V6M0 6L-10 24M0 6L10 24M0-9L14-6M12-10h11v5h-11z' }, g);
    };
    const tank = g => {
      s('ellipse', { cy: 10, rx: 22, ry: 12 }, g);
      s('path', { d: 'M-16 12h32M-14 16h28M-16 2A16 14 0 0 1 16 2M-8-6L-34-8M2-12V-24L10-30' }, g);
    };
    const units = [];
    for (const p of [0, 1]) {
      for (let tries = 0; units.filter(u => u.p === p).length < UNITS; tries++) {
        const x = 50 + ctx.rng() * (PW - 100), y = 50 + ctx.rng() * (H - 90);
        if (units.some(u => u.p === p && Math.hypot(u.x - x, u.y - y) < 80 - tries / 50)) continue;
        const u = { p, x, y, alive: true, g: s('g', { transform: `translate(${x} ${y})`, stroke: C[p], 'stroke-width': 2.4 }, pages[p]) };
        (p ? tank : soldier)(u.g);
        units.push(u);
      }
    }
    // the printed dot (radius 6) has to touch the drawing itself
    const touches = (u, x, y) => {
      const b = u.g.getBBox(), pad = 7;
      return x > u.x + b.x - pad && x < u.x + b.x + b.width + pad && y > u.y + b.y - pad && y < u.y + b.y + b.height + pad;
    };

    function prompt(pre) {
      status.set(`${pre || ''}${name(turn)}'s turn. Draw a dot on your page.`);
      fold.className = 'fold' + (!over && !busy && ctx.mine(turn) ? ' aim' + turn : '');
      ctx.turn(turn, C, N, over);
    }
    prompt();

    ctx.apply = async ({ x, y }) => {
      busy = true;
      fold.className = 'fold';
      s('circle', { cx: x, cy: y, r: 6, fill: C[turn], stroke: 'none' }, pages[turn]);
      status.set(`${name(turn)} drew a dot. Closing the book…`);
      await wait(400);
      fold.classList.add('f' + turn);
      await wait(950);
      const px = PW - x; // mirrored across the fold
      s('circle', { cx: px, cy: y, r: 6, fill: C[turn], stroke: 'none', opacity: .7 }, pages[1 - turn]);
      const hit = units.find(u => u.p !== turn && u.alive && touches(u, px, y));
      fold.classList.remove('f' + turn);
      await wait(950);
      if (hit) {
        hit.alive = false;
        hit.g.classList.add('dead');
        boom(pages[1 - turn], px, y, C[turn], 34);
        inkX(pages[1 - turn], hit.x, hit.y, 26, C[turn], 4);
      }
      busy = false;
      if (hit && units.every(u => u.p === turn || !u.alive)) {
        over = true;
        again.style.display = '';
        fold.className = 'fold';
        ctx.turn(turn, C, N, true);
        return status.set(`<b>Direct hit!</b> ${name(turn)} wins the war!`);
      }
      turn = 1 - turn;
      prompt(hit ? '<b>Direct hit!</b><br>' : 'The ink missed!<br>');
    };
  },
});
