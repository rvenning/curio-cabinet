// Canvas, input and the frame loop. The engine never calls into here, and this
// file never decides anything about the game — it draws whatever Game is
// holding and turns pointers into Game.tap calls.
//
// Two things here are doing most of the work.
//
// The FLIP. A memory game is watched far more than it is played: a board of 48
// cards is 100 flips, and if a card just swaps its picture the whole thing
// reads as a spreadsheet. So every card carries its own animation clock and
// turns edge-on through zero width, with the back drawn for the first half and
// the face for the second — the same trick a real card does, and the reason you
// can see WHICH card turned out of the corner of your eye.
//
// The INPUT. The cells on a phone come out around 40px on the big boards, and a
// mis-tap in this genre costs a whole turn. Nothing commits on press: pressing
// lights a card, sliding moves which card is lit, and only lifting turns it. A
// mis-aimed thumb costs a slide rather than a turn.

// Fitting the board to the stage is right on a phone and absurd on a monitor,
// where a six-card board would give 200px cards. Past this the board stops
// growing and the cabinet around it does the filling instead.
const MAX_CELL = 92;
const FLIP_TIME = 0.20;     // seconds a card takes to turn over
const SETTLE_TIME = 0.45;   // seconds a matched pair takes to sit down

const Render = {
  W: 360, H: 520,
  cell: 40, ox: 0, oy: 0, bw: 0, bh: 0,
  press: -1,               // the card currently lit under the finger
  theme: null,
  anim: [],                // per card: { flip, matched, sparked }
  boardKey: "",            // changes when a new board is dealt

  boot() {
    this.cv = document.getElementById("cv");
    this.ctx = this.cv.getContext("2d");
    this.stage = document.getElementById("game-stage");
    this.theme = THEMES[0];
    this.bindInput();

    addEventListener("resize", () => this.resize());
    addEventListener("orientationchange", () => setTimeout(() => this.resize(), 350));
    if (window.visualViewport) visualViewport.addEventListener("resize", () => this.resize());
  },

  setTheme(t) { this.theme = t || THEMES[0]; },

  resize() {
    if (!this.stage) return;
    const box = this.stage.getBoundingClientRect();
    if (box.width < 50 || box.height < 50) return;   // hidden screen: keep the last good layout
    this.W = box.width; this.H = box.height;

    // Display size comes from the stylesheet (width/height 100%); only the
    // backing store is sized here, or the canvas renders at its attribute size
    // and overflows every retina screen by the device pixel ratio.
    const dpr = window.devicePixelRatio || 1;
    this.cv.width = Math.round(this.W * dpr);
    this.cv.height = Math.round(this.H * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.layout();
  },

  layout() {
    const cols = Game.cols || 4, rows = Game.rows || 4;
    const pad = 16;
    this.cell = Math.max(14, Math.min(MAX_CELL,
      Math.floor(Math.min((this.W - pad * 2) / cols, (this.H - pad * 2) / rows))));
    this.bw = this.cell * cols;
    this.bh = this.cell * rows;
    this.ox = Math.round((this.W - this.bw) / 2);
    // Sit the board a little below centre. On a portrait phone the spare space
    // is all at the bottom otherwise, which puts the cards further from the
    // thumb holding the device for no gain.
    this.oy = Math.round((this.H - this.bh) * 0.56);
  },

  cellAt(x, y) {
    const c = Math.floor((x - this.ox) / this.cell);
    const r = Math.floor((y - this.oy) / this.cell);
    if (c < 0 || r < 0 || c >= Game.cols || r >= Game.rows) return -1;
    return r * Game.cols + c;
  },

  cellXY(i) {
    return { x: this.ox + (i % Game.cols) * this.cell, y: this.oy + Math.floor(i / Game.cols) * this.cell };
  },

  /* -------------------------------------------------------------- input -- */

  bindInput() {
    const local = (e) => {
      const r = this.cv.getBoundingClientRect();
      return this.cellAt(e.clientX - r.left, e.clientY - r.top);
    };
    const live = () => Game.state === "play" && !Game.paused;

    this.cv.addEventListener("pointerdown", (e) => {
      if (!live()) return;
      e.preventDefault();
      this.press = local(e);
      // Capture keeps a slide that strays off the board attached to the canvas,
      // but it THROWS if the browser does not consider this pointer active —
      // and an unguarded throw here takes the rest of the gesture with it.
      try { this.cv.setPointerCapture?.(e.pointerId); } catch { /* the gesture still works */ }
    }, { passive: false });

    // Sliding to the card next door is a correction, not a new gesture.
    this.cv.addEventListener("pointermove", (e) => {
      if (this.press < 0 || !live()) return;
      this.press = local(e);
    }, { passive: true });

    const lift = (e) => {
      const i = this.press;
      this.press = -1;
      if (i < 0 || !live()) return;
      if (local(e) !== i) return;             // slid off the board entirely
      if (Game.tap(i)) this.reactTo(Game.lastEvent);
    };
    this.cv.addEventListener("pointerup", lift);
    this.cv.addEventListener("pointercancel", () => { this.press = -1; });

    // A mouse gets the same treatment, and keyboard users get the board too.
    this.cv.addEventListener("contextmenu", (e) => e.preventDefault());
  },

  // Sound and juice for whatever the engine just did. The engine set
  // `lastEvent` and knows nothing about any of this.
  reactTo(ev) {
    if (!ev) return;
    const p = this.cellXY(ev.i ?? ev.a ?? 0);
    const cx = p.x + this.cell / 2, cy = p.y + this.cell / 2;
    if (ev.kind === "flip") { Sfx.flip(ev.i); return; }
    if (ev.kind === "miss") { Sfx.miss(); return; }
    if (ev.kind === "match") {
      Sfx.match(Game.pairsFound - 1);
      for (const i of [ev.a, ev.b]) {
        const q = this.cellXY(i);
        Fx.sparkle?.(q.x + this.cell / 2, q.y + this.cell / 2, "#ffe9a8", 8);
        Fx.burst(q.x + this.cell / 2, q.y + this.cell / 2, this.theme.rim, 10, 110, 0.5, 2.4);
      }
      if (Game.mode === "attack") Fx.text(cx, cy, `+${ATTACK.pairBonus.toFixed(1)}s`, { color: "#ffe9a8", size: 15 });
      Fx.addFlash(0.10, "#ffffff");
    }
    if (ev.kind === "stage") { Sfx.nextStage(); Fx.addFlash(0.2, this.theme.rim); }
  },

  /* --------------------------------------------------------------- loop -- */

  start() { this.running = true; this._last = performance.now(); this.tickAt = 99; requestAnimationFrame((t) => this.loop(t)); },
  stop() { this.running = false; },

  loop(t) {
    if (!this.running) return;
    const dt = Math.min(0.05, (t - this._last) / 1000 || 0);
    this._last = t;

    // A stage can change size with no resize event at all — a web font landing,
    // a HUD row rewrapping, a new board with different dimensions.
    const b = this.stage.getBoundingClientRect();
    const wantCols = Game.cols, wantRows = Game.rows;
    if (b.width > 50 && b.height > 50 &&
        (Math.abs(b.width - this.W) > 1 || Math.abs(b.height - this.H) > 1)) this.resize();
    if (this.laidOut !== `${wantCols}x${wantRows}` && b.width > 50) {
      this.laidOut = `${wantCols}x${wantRows}`;
      this.layout();
    }

    const wasPeek = Game.state === "peek";
    Game.update(dt);
    if (wasPeek && Game.state === "play") Sfx.peek();

    // A new board arriving mid-run (Time Attack) resets every card's animation.
    const key = `${Game.stage}|${Game.n}|${Game.packId}`;
    if (key !== this.boardKey) { this.boardKey = key; this.resetAnim(); this.layout(); this.reactTo(Game.lastEvent); }

    this.advanceAnim(dt);
    this.countdown();
    Fx.update(dt);
    this.render();
    this.hud();
    requestAnimationFrame((t2) => this.loop(t2));
  },

  resetAnim() {
    this.anim = Array.from({ length: Game.n }, () => ({ flip: 0, settle: 0, sparked: false }));
    this.press = -1;
  },

  advanceAnim(dt) {
    if (this.anim.length !== Game.n) this.resetAnim();
    const rate = dt / FLIP_TIME;
    for (let i = 0; i < Game.n; i++) {
      const a = this.anim[i];
      const want = (Game.state === "peek" || Game.face[i] !== 0) ? 1 : 0;
      if (a.flip < want) a.flip = Math.min(want, a.flip + rate);
      else if (a.flip > want) a.flip = Math.max(want, a.flip - rate);
      if (Game.face[i] === 2) a.settle = Math.min(1, a.settle + dt / SETTLE_TIME);
    }
  },

  // The last ten seconds get one tick a second, climbing. It is the only way to
  // feel the clock without staring at it.
  countdown() {
    if (Game.mode === "duel" || Game.state !== "play") { this.tickAt = 99; return; }
    const left = Math.ceil(Game.clock);
    if (left <= 10 && left > 0 && left !== this.tickAt) { this.tickAt = left; Sfx.tick(left); }
    if (left > 10) this.tickAt = 99;
  },

  /* --------------------------------------------------------------- HUD -- */

  time(s) {
    s = Math.max(0, s);
    const m = Math.floor(s / 60);
    return m ? `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}` : `${s.toFixed(s < 10 ? 1 : 0)}s`;
  },

  hud() {
    const set = (id, txt) => { const el = document.getElementById(id); if (el && el.textContent !== txt) el.textContent = txt; };
    set("hud-pairs", `🃏 ${Game.pairsFound}/${Game.pairs}`);
    if (Game.mode === "duel") {
      set("hud-clock", this.time(Game.clock));
      set("hud-misses", `${Game.scores[0]} – ${Game.scores[1]}`);
    } else if (Game.mode === "attack") {
      set("hud-clock", this.time(Game.clock));
      set("hud-misses", `⭐ ${Game.totalPairs}`);
    } else {
      set("hud-clock", this.time(Game.clock));
      set("hud-misses", `✗ ${Game.misses}`);
    }
    const clockEl = document.getElementById("hud-clock");
    if (clockEl) clockEl.classList.toggle("urgent", Game.mode !== "duel" && Game.clock <= 10);

    const turn = document.getElementById("duel-turn");
    if (turn && Game.mode === "duel") {
      turn.textContent = `${Game.turn === 0 ? "🔵" : "🔴"} ${Game.names[Game.turn]}`;
      turn.className = `duel-turn p${Game.turn}`;
    }
  },

  /* ------------------------------------------------------------- paint -- */

  render() {
    const ctx = this.ctx, T = this.theme;
    ctx.clearRect(0, 0, this.W, this.H);
    this.paintCabinet(ctx, T);

    const [shx, shy] = Fx.shakeOffset();
    ctx.save();
    ctx.translate(shx, shy);
    for (let i = 0; i < Game.n; i++) this.paintCard(ctx, i, T);
    ctx.restore();

    Fx.render(ctx);
    if (Game.state === "peek") this.paintPeekBar(ctx, T);
  },

  // The table the cards are laid out on, painted right to the edges of the
  // canvas so the board never reads as floating in a void.
  paintCabinet(ctx, T) {
    ctx.fillStyle = T.table;
    ctx.fillRect(0, 0, this.W, this.H);

    // Grain: long soft streaks, seeded off the row so they hold still.
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = T.grain;
    for (let y = 0; y < this.H; y += 9) {
      const h = 1 + GK.util.hash2(0, y) * 2.4;
      const x = -20 + GK.util.hash2(1, y) * 40;
      ctx.fillRect(x, y, this.W + 40, h);
    }
    ctx.restore();

    // The baize the board sits on, with a rim.
    const m = Math.max(8, this.cell * 0.24);
    const x = this.ox - m, y = this.oy - m, w = this.bw + m * 2, h = this.bh + m * 2;
    const r = Math.min(22, m * 1.6);
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.42)"; ctx.shadowBlur = 22; ctx.shadowOffsetY = 8;
    this.roundRect(ctx, x, y, w, h, r);
    ctx.fillStyle = T.feltEdge; ctx.fill();
    ctx.restore();

    this.roundRect(ctx, x + 3, y + 3, w - 6, h - 6, r - 2);
    ctx.fillStyle = T.felt; ctx.fill();
    ctx.strokeStyle = T.rim; ctx.lineWidth = 2; ctx.globalAlpha = 0.75; ctx.stroke(); ctx.globalAlpha = 1;
  },

  paintCard(ctx, i, T) {
    const a = this.anim[i] || { flip: 0, settle: 0 };
    const { x, y } = this.cellXY(i);
    const inset = Math.max(2, this.cell * 0.055);
    const w = this.cell - inset * 2, h = this.cell - inset * 2;
    const cx = x + this.cell / 2, cy = y + this.cell / 2;

    // A matched pair sits down into the baize: it shrinks a touch and dims, so
    // the cards still in play are the ones that stand out.
    const settle = a.settle;
    const shrink = 1 - settle * 0.09;
    const lift = this.press === i && Game.face[i] === 0 ? 1 : 0;

    // The turn itself. Width goes to zero at the halfway point and the drawing
    // swaps there, which is what makes it read as one card rather than two.
    const t = a.flip;
    const sx = Math.abs(Math.cos(t * Math.PI));
    const showFace = t >= 0.5;

    ctx.save();
    ctx.translate(cx, cy - lift * this.cell * 0.05);
    ctx.scale(Math.max(0.001, sx) * shrink, shrink * (1 + (1 - sx) * 0.07));

    const rad = Math.max(3, this.cell * 0.13);
    // Shadow under the card, strongest when it is lying flat and lit.
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.5)";
    ctx.shadowBlur = 6 + lift * 10;
    ctx.shadowOffsetY = 3 + lift * 4;
    this.roundRect(ctx, -w / 2, -h / 2, w, h, rad);
    ctx.fillStyle = "#000"; ctx.fill();
    ctx.restore();

    if (showFace) this.paintFace(ctx, i, w, h, rad, T, settle);
    else this.paintBack(ctx, i, w, h, rad, T, lift);

    ctx.restore();
  },

  paintBack(ctx, i, w, h, rad, T, lift) {
    this.roundRect(ctx, -w / 2, -h / 2, w, h, rad);
    ctx.fillStyle = T.back; ctx.fill();

    const b = Math.max(2, w * 0.075);
    this.roundRect(ctx, -w / 2 + b, -h / 2 + b, w - b * 2, h - b * 2, rad * 0.65);
    ctx.fillStyle = T.back2; ctx.fill();

    ctx.save();
    ctx.clip();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = T.backInk;
    ctx.strokeStyle = T.backInk;
    ctx.lineWidth = Math.max(1, w * 0.035);
    this.paintPattern(ctx, T.pattern, w, h, i);
    ctx.restore();

    // A small emblem so the back has a centre to look at.
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = T.backInk;
    ctx.beginPath();
    const e = w * 0.13;
    ctx.moveTo(0, -e); ctx.lineTo(e, 0); ctx.lineTo(0, e); ctx.lineTo(-e, 0);
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;

    if (lift) {
      this.roundRect(ctx, -w / 2, -h / 2, w, h, rad);
      ctx.strokeStyle = "#fff"; ctx.globalAlpha = 0.85; ctx.lineWidth = Math.max(2, w * 0.045);
      ctx.stroke(); ctx.globalAlpha = 1;
    }
  },

  paintPattern(ctx, kind, w, h, i) {
    const s = w / 7;
    if (kind === "chevron") {
      for (let y = -h / 2; y < h / 2 + s; y += s) {
        ctx.beginPath();
        for (let x = -w / 2; x < w / 2 + s; x += s) { ctx.moveTo(x, y + s * 0.4); ctx.lineTo(x + s * 0.5, y); ctx.lineTo(x + s, y + s * 0.4); }
        ctx.stroke();
      }
    } else if (kind === "stars") {
      for (let k = 0; k < 9; k++) {
        const px = (GK.util.hash2(i * 7 + k, 3) - 0.5) * w;
        const py = (GK.util.hash2(k, i * 5 + 11) - 0.5) * h;
        const r = s * (0.16 + GK.util.hash2(k, i) * 0.2);
        ctx.beginPath();
        ctx.moveTo(px, py - r * 2.2); ctx.lineTo(px + r, py); ctx.lineTo(px, py + r * 2.2); ctx.lineTo(px - r, py);
        ctx.closePath(); ctx.fill();
      }
    } else if (kind === "scale") {
      for (let y = -h / 2; y < h / 2 + s; y += s * 0.62) {
        const off = ((y / (s * 0.62)) | 0) % 2 ? s / 2 : 0;
        for (let x = -w / 2 - s; x < w / 2 + s; x += s) {
          ctx.beginPath(); ctx.arc(x + off, y, s * 0.5, Math.PI, 0); ctx.stroke();
        }
      }
    } else {
      for (let x = -w / 2; x < w / 2; x += s * 0.75) { ctx.beginPath(); ctx.moveTo(x, -h / 2); ctx.lineTo(x, h / 2); ctx.stroke(); }
      for (let y = -h / 2; y < h / 2; y += s * 0.75) { ctx.beginPath(); ctx.moveTo(-w / 2, y); ctx.lineTo(w / 2, y); ctx.stroke(); }
    }
  },

  paintFace(ctx, i, w, h, rad, T, settle) {
    const plaque = Game.plaque[i];
    const matched = Game.face[i] === 2;

    this.roundRect(ctx, -w / 2, -h / 2, w, h, rad);
    ctx.fillStyle = "#f6f1e6"; ctx.fill();

    const b = Math.max(2, w * 0.06);
    this.roundRect(ctx, -w / 2 + b, -h / 2 + b, w - b * 2, h - b * 2, rad * 0.7);
    ctx.fillStyle = plaque; ctx.fill();

    // Gloss across the top, which is most of what makes it look like an object
    // rather than a coloured rectangle.
    ctx.save();
    ctx.clip();
    const g = ctx.createLinearGradient(0, -h / 2, 0, h * 0.15);
    g.addColorStop(0, "rgba(255,255,255,.34)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.restore();

    const pack = PACK_BY_ID[Game.packId];
    const sym = Game.sym[i];
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (pack && pack.kind === "text") {
      ctx.font = `800 ${Math.round(h * (sym.length > 1 ? 0.4 : 0.52))}px 'Baloo 2', system-ui, sans-serif`;
      ctx.fillStyle = "rgba(0,0,0,.28)";
      ctx.fillText(sym, 0, h * 0.035);
      ctx.fillStyle = "#fffdf6";
      ctx.fillText(sym, 0, 0);
    } else {
      ctx.font = `${Math.round(h * 0.5)}px 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif`;
      ctx.fillText(sym, 0, h * 0.02);
    }
    ctx.restore();

    if (matched) {
      // A gold rim that draws itself on as the pair settles — the only
      // celebration on the card itself, and enough of one.
      this.roundRect(ctx, -w / 2, -h / 2, w, h, rad);
      ctx.strokeStyle = T.rim;
      ctx.globalAlpha = 0.45 + settle * 0.55;
      ctx.lineWidth = Math.max(2, w * 0.055);
      ctx.stroke();
      ctx.globalAlpha = 0.16 * settle;
      ctx.fillStyle = T.felt;
      this.roundRect(ctx, -w / 2, -h / 2, w, h, rad);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  },

  // The peek: a bar draining across the top of the baize. It has to be visible
  // without being something you look AT — the cards are the thing.
  paintPeekBar(ctx, T) {
    const h = HALLS[Game.hallIdx];
    const full = Game.mode === "hall" ? (h ? h.peek : 1) : (Game.mode === "duel" ? 1.4 : ATTACK.peek);
    const frac = Math.max(0, Math.min(1, Game.peekLeft / full));
    const m = Math.max(8, this.cell * 0.24);
    const w = this.bw + m * 2, x = this.ox - m, y = this.oy - m - 12;
    ctx.fillStyle = "rgba(0,0,0,.3)";
    this.roundRect(ctx, x, y, w, 6, 3); ctx.fill();
    ctx.fillStyle = T.rim;
    this.roundRect(ctx, x, y, w * frac, 6, 3); ctx.fill();
  },

  roundRect(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  },
};
