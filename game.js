(() => {
  'use strict';
  const cvs = document.getElementById('game');
  const ctx = cvs.getContext('2d');
  const $ = (id) => document.getElementById(id);
  const ui = {
    hud: $('hud'), bar: $('wax-bar'), time: $('time'), menu: $('menu'), over: $('over'),
    best: $('best'), final: $('final'), newBest: $('new-best'),
  };
  const BEST_KEY = 'last-candle-best';
  let best = parseFloat(localStorage.getItem(BEST_KEY)) || 0;
  ui.best.textContent = best.toFixed(1);

  let W = 0, H = 0, DPR = 1;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    cvs.width = W * DPR; cvs.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  addEventListener('resize', resize); resize();

  // ---- state ----
  let state = 'menu';
  let candle, drops, gusts, motes, t, spawnDrop, spawnGust, last;

  function reset() {
    candle = { x: W / 2, y: H * 0.65, tx: W / 2, ty: H * 0.65, wax: 1, flicker: 0 };
    drops = []; gusts = []; t = 0; spawnDrop = 0.5; spawnGust = 2;
    motes = Array.from({ length: 40 }, () => ({ x: Math.random() * W, y: Math.random() * H, s: Math.random() * 1.5 + .3 }));
  }

  // ---- input ----
  const keys = new Set();
  addEventListener('keydown', (e) => { keys.add(e.key); if (e.key === ' ' && state !== 'play') start(); });
  addEventListener('keyup', (e) => keys.delete(e.key));
  function pointer(e) {
    if (state !== 'play') return;
    candle.tx = e.clientX; candle.ty = e.clientY - 40; // keep flame visible above finger
  }
  cvs.addEventListener('pointerdown', pointer);
  cvs.addEventListener('pointermove', (e) => { if (e.buttons || e.pointerType === 'mouse') pointer(e); });

  // ---- flow ----
  function start() {
    reset(); state = 'play';
    ui.menu.hidden = true; ui.over.hidden = true; ui.hud.hidden = false;
    last = performance.now();
  }
  function gameOver() {
    state = 'over'; ui.hud.hidden = true;
    ui.final.textContent = t.toFixed(1);
    const isBest = t > best;
    if (isBest) { best = t; localStorage.setItem(BEST_KEY, best); ui.best.textContent = best.toFixed(1); }
    ui.newBest.hidden = !isBest;
    ui.over.hidden = false;
  }
  $('start').onclick = start;
  $('restart').onclick = start;

  // ---- update ----
  function update(dt) {
    t += dt;
    const diff = 1 + t / 30; // difficulty ramps up over time

    // movement
    const sp = 380 * dt;
    if (keys.has('ArrowLeft') || keys.has('a')) candle.tx -= sp;
    if (keys.has('ArrowRight') || keys.has('d')) candle.tx += sp;
    if (keys.has('ArrowUp') || keys.has('w')) candle.ty -= sp;
    if (keys.has('ArrowDown') || keys.has('s')) candle.ty += sp;
    candle.tx = Math.max(20, Math.min(W - 20, candle.tx));
    candle.ty = Math.max(60, Math.min(H - 40, candle.ty));
    const k = 1 - Math.pow(0.0005, dt);
    candle.x += (candle.tx - candle.x) * k;
    candle.y += (candle.ty - candle.y) * k;

    // wax burns down
    candle.wax -= dt * 0.06 * diff;
    candle.flicker = Math.max(0, candle.flicker - dt * 2);

    // spawn wax drops
    spawnDrop -= dt;
    if (spawnDrop <= 0) {
      spawnDrop = 1.1 + Math.random() * 0.9;
      drops.push({ x: 30 + Math.random() * (W - 60), y: 80 + Math.random() * (H - 140), life: 7 });
    }
    // spawn gusts
    spawnGust -= dt;
    if (spawnGust <= 0) {
      spawnGust = Math.max(0.45, 2.2 / diff) * (0.6 + Math.random() * 0.8);
      const fromLeft = Math.random() < 0.5;
      const h = 30 + Math.random() * 40;
      gusts.push({
        x: fromLeft ? -200 : W + 200, y: 60 + Math.random() * (H - 100),
        vx: (fromLeft ? 1 : -1) * (180 + Math.random() * 140) * Math.sqrt(diff),
        w: 160 + Math.random() * 120, h, phase: Math.random() * 6,
      });
    }

    // drops
    for (const d of drops) {
      d.life -= dt;
      if (Math.hypot(d.x - candle.x, d.y - candle.y) < 30) { d.life = 0; candle.wax = Math.min(1, candle.wax + 0.18); }
    }
    drops = drops.filter((d) => d.life > 0);

    // gusts
    for (const g of gusts) {
      g.x += g.vx * dt; g.phase += dt * 4;
      if (Math.abs(candle.x - g.x) < g.w / 2 && Math.abs(candle.y - 20 - g.y) < g.h / 2) {
        candle.wax -= dt * 0.9; candle.flicker = 1;
      }
    }
    gusts = gusts.filter((g) => g.x > -400 && g.x < W + 400);

    for (const m of motes) { m.y -= m.s * 12 * dt; if (m.y < 0) { m.y = H; m.x = Math.random() * W; } }

    if (candle.wax <= 0) { candle.wax = 0; gameOver(); }
    ui.bar.style.width = (candle.wax * 100).toFixed(1) + '%';
    ui.time.textContent = t.toFixed(1);
  }

  // ---- draw ----
  function drawCandle(x, y, wax, flick, time) {
    const bodyH = 20 + 50 * wax;
    // wax body
    const g = ctx.createLinearGradient(x - 12, 0, x + 12, 0);
    g.addColorStop(0, '#cbb994'); g.addColorStop(.5, '#f5ecd8'); g.addColorStop(1, '#bba882');
    ctx.fillStyle = g;
    ctx.fillRect(x - 12, y, 24, bodyH);
    ctx.fillStyle = '#2a2018'; ctx.fillRect(x - 1, y - 6, 2, 7);
    // flame
    const s = 0.5 + wax * 0.6;
    const sway = Math.sin(time * 9) * 2 + (flick ? (Math.random() - .5) * 10 * flick : 0);
    ctx.save(); ctx.translate(x, y - 6); ctx.scale(s, s);
    const fg = ctx.createLinearGradient(0, 0, 0, -40);
    fg.addColorStop(0, '#ff6a00'); fg.addColorStop(.6, '#ffc24a'); fg.addColorStop(1, '#fff4c2');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(14, -8, 10 + sway * .3, -26, sway, -42);
    ctx.bezierCurveTo(-10 + sway * .3, -26, -14, -8, 0, 0);
    ctx.fill(); ctx.restore();
  }

  function draw(time) {
    ctx.fillStyle = '#0b0a10'; ctx.fillRect(0, 0, W, H);
    if (state === 'menu' || !candle) {
      drawCandle(W / 2, H * 0.78, 1, 0, time);
      glow(W / 2, H * 0.78 - 20, 220, 1);
      return;
    }
    // light
    const radius = 90 + 260 * candle.wax;
    glow(candle.x, candle.y - 20, radius, state === 'play' ? 1 : 0.4);

    // motes
    ctx.fillStyle = 'rgba(255,220,160,.35)';
    for (const m of motes) { ctx.beginPath(); ctx.arc(m.x, m.y, m.s, 0, 7); ctx.fill(); }

    // drops (visible a bit beyond the light so player can plan)
    for (const d of drops) {
      const a = Math.min(1, d.life) * 0.9;
      ctx.fillStyle = `rgba(245,236,216,${a})`;
      ctx.beginPath();
      ctx.moveTo(d.x, d.y - 10);
      ctx.quadraticCurveTo(d.x + 8, d.y + 2, d.x, d.y + 6);
      ctx.quadraticCurveTo(d.x - 8, d.y + 2, d.x, d.y - 10);
      ctx.fill();
    }
    // gusts
    ctx.lineCap = 'round';
    for (const g of gusts) {
      ctx.strokeStyle = 'rgba(170,200,255,.28)'; ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const yy = g.y - g.h / 2 + (i + .5) * (g.h / 4);
        ctx.beginPath();
        for (let xx = -g.w / 2; xx <= g.w / 2; xx += 10) {
          const px = g.x + xx, py = yy + Math.sin(g.phase + xx * .05 + i) * 4;
          xx === -g.w / 2 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
    }
    if (candle.wax > 0) drawCandle(candle.x, candle.y, candle.wax, candle.flicker, time);
  }

  function glow(x, y, r, a) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,170,70,${0.28 * a})`);
    g.addColorStop(.5, `rgba(255,120,40,${0.08 * a})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  function loop(now) {
    if (state === 'play') {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      update(dt);
    }
    draw(now / 1000);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
