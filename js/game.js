// The engine. No DOM, no canvas, no Math.random — every board is a pure
// function of {cols, rows, pack, seed}, so the bots in tests/ replay the whole
// campaign exactly and a changed clear time is always a real balance change.
//
// Three modes share one board:
//
//   hall    a campaign board against a countdown. Running out is losing.
//   attack  the clock starts at 30s, pairs buy seconds back, clearing the board
//           buys five more and deals a bigger one. It ends when the boards
//           outgrow the bonus.
//   duel    two people at one table. A match means you go again; no clock.
//
// The one piece of timing that is a design decision rather than an animation:
// a mismatched pair stays visible for MISS_MS while the clock KEEPS RUNNING.
// That is what makes a miss cost something in Time Attack, and it is why a
// player who taps a third card to hurry the flip-back is rewarded rather than
// ignored — tapping resolves the pair immediately.

const MISS_MS = 0.78;      // seconds a mismatched pair stays up
const MATCH_MS = 0.34;     // seconds a matched pair sits proud before settling

const FACE_DOWN = 0, FACE_UP = 1, FACE_MATCHED = 2;

// Deal a board. Exported on its own because it is the only place chance lives
// and tests/packs.test.js deals every board in the game to check it.
function dealBoard(cols, rows, packId, seed) {
  const pack = PACK_BY_ID[packId];
  if (!pack) throw new Error("unknown pack: " + packId);
  const n = cols * rows;
  if (n % 2) throw new Error(`${cols}x${rows} is an odd number of cards`);
  const pairs = n / 2;
  if (pairs > pack.symbols.length) throw new Error(`pack ${packId} has ${pack.symbols.length} symbols, board needs ${pairs}`);

  const r = RNG.make(RNG.seedFrom(`${packId}|${cols}x${rows}|${seed}`));

  // Which symbols are on this board, and in what order the pairs are laid out.
  const chosen = r.shuffle(pack.symbols.slice()).slice(0, pairs);

  // Plaque colours are assigned so that NO colour belongs to exactly one pair.
  // Otherwise, on a small board, the colour behind a card would identify its
  // partner outright and the game would stop being memory.
  const k = Math.max(1, Math.min(pack.plaques.length, Math.floor(pairs / 2)));

  const sym = new Array(n), plaque = new Array(n), pairOf = new Array(n);
  const slots = [];
  for (let p = 0; p < pairs; p++) { slots.push(p); slots.push(p); }
  r.shuffle(slots);
  for (let i = 0; i < n; i++) {
    const p = slots[i];
    sym[i] = chosen[p];
    plaque[i] = pack.plaques[p % k];
    pairOf[i] = p;
  }
  return { cols, rows, n, pairs, packId, sym, plaque, pairOf };
}

const Game = {
  state: "idle",          // idle | peek | play | over
  paused: false,

  /* --------------------------------------------------------------- setup -- */

  start(opts) {
    this.mode = opts.mode;                    // hall | attack | duel
    this.hallIdx = opts.hallIdx ?? -1;
    this.boardId = opts.boardId || "";
    this.seed = opts.seed ?? 1;
    this.names = opts.names || ["Player 1", "Player 2"];

    this.misses = 0;
    this.flips = 0;
    this.elapsed = 0;
    this.stage = 0;
    this.totalPairs = 0;                      // across every board this run
    this.scores = [0, 0];
    this.turn = 0;
    this.paused = false;
    this.lastEvent = null;                    // for the renderer's juice

    if (this.mode === "attack") {
      this.clock = ATTACK.start;
      this.dealStage(0);
    } else if (this.mode === "duel") {
      const b = DUEL_BOARDS.find((x) => x.id === this.boardId) || DUEL_BOARDS[0];
      this.clock = 0;                          // counts up; nothing to run out
      this.load(b.cols, b.rows, b.pack, 1.4);
    } else {
      const h = HALLS[this.hallIdx];
      this.clock = h.time;
      this.load(h.cols, h.rows, h.pack, h.peek);
    }
    return this;
  },

  dealStage(n) {
    this.stage = n;
    const s = ATTACK.stageAt(n);
    // Keyed on the stage, not on a running stream: stage 7 is the same board
    // whether you reached it in one run or after ten misses.
    this.load(s.cols, s.rows, s.pack, ATTACK.peek, `${this.seed}|stage${n}`);
  },

  load(cols, rows, packId, peek, seedKey) {
    const b = dealBoard(cols, rows, packId, seedKey ?? this.seed);
    Object.assign(this, b);
    this.face = new Array(this.n).fill(FACE_DOWN);
    this.up = [];
    this.pairsFound = 0;
    this.mismatchLeft = 0;
    this.matchLeft = 0;
    this.peekLeft = peek || 0;
    this.state = this.peekLeft > 0 ? "peek" : "play";
  },

  running() { return this.state === "peek" || this.state === "play"; },
  pairsLeft() { return this.pairs - this.pairsFound; },

  /* ---------------------------------------------------------------- play -- */

  // Returns true if the tap did anything. The engine is deliberately forgiving
  // about WHEN you may tap: a third tap while a mismatched pair is still shown
  // resolves that pair first and then takes effect, so a fast player is never
  // fighting the animation.
  tap(i) {
    if (this.state !== "play" || this.paused) return false;
    if (i < 0 || i >= this.n) return false;

    if (this.mismatchLeft > 0) this.resolveMismatch();
    if (this.matchLeft > 0) this.matchLeft = 0;

    if (this.face[i] !== FACE_DOWN) return false;
    if (this.up.length >= 2) return false;      // shouldn't happen; belt and braces

    this.face[i] = FACE_UP;
    this.up.push(i);
    this.flips++;
    this.lastEvent = { kind: "flip", i };
    if (this.up.length < 2) return true;

    const [a, b] = this.up;
    if (this.pairOf[a] === this.pairOf[b]) {
      this.face[a] = this.face[b] = FACE_MATCHED;
      this.up = [];
      this.pairsFound++;
      this.totalPairs++;
      this.matchLeft = MATCH_MS;
      this.lastEvent = { kind: "match", a, b };
      if (this.mode === "duel") this.scores[this.turn]++;
      if (this.mode === "attack") this.clock += ATTACK.pairBonus;
      if (this.pairsFound >= this.pairs) this.boardCleared();
    } else {
      this.misses++;
      this.mismatchLeft = MISS_MS;
      this.lastEvent = { kind: "miss", a, b };
      // The turn passes on a miss, but not until the cards have been seen —
      // otherwise the player who is about to lose their turn never gets to
      // look at what they turned over, which is the whole point of the miss.
    }
    return true;
  },

  // Guarded on the CARDS, not on the timer: update() calls this at the instant
  // the timer reaches zero, so a `mismatchLeft <= 0` guard here rejects the one
  // call that matters and the two cards stay up forever.
  resolveMismatch() {
    if (!this.up.length) return;
    for (const i of this.up) if (this.face[i] === FACE_UP) this.face[i] = FACE_DOWN;
    this.up = [];
    this.mismatchLeft = 0;
    if (this.mode === "duel") this.turn = 1 - this.turn;
  },

  boardCleared() {
    if (this.mode === "attack") {
      this.clock += ATTACK.clearBonus;
      this.lastEvent = { kind: "stage", stage: this.stage + 1 };
      // The next board is dealt once the last pair has been seen to land.
      this.pendingStage = this.stage + 1;
    } else {
      this.finish(true);
    }
  },

  /* --------------------------------------------------------------- clock -- */

  update(dt) {
    if (!this.running() || this.paused) return;
    dt = Math.min(0.05, dt);

    if (this.state === "peek") {
      this.peekLeft -= dt;
      if (this.peekLeft <= 0) { this.peekLeft = 0; this.state = "play"; }
      return;
    }

    this.elapsed += dt;
    if (this.mode === "duel") this.clock += dt;
    else this.clock -= dt;

    if (this.matchLeft > 0) {
      this.matchLeft -= dt;
      if (this.matchLeft <= 0) {
        this.matchLeft = 0;
        if (this.pendingStage != null) {
          const n = this.pendingStage; this.pendingStage = null;
          this.dealStage(n);
          return;
        }
      }
    }

    if (this.mismatchLeft > 0) {
      this.mismatchLeft -= dt;
      if (this.mismatchLeft <= 0) this.resolveMismatch();
    }

    if (this.mode !== "duel" && this.clock <= 0) { this.clock = 0; this.finish(false); }
  },

  /* -------------------------------------------------------------- ending -- */

  finish(cleared) {
    if (this.state === "over") return;
    this.state = "over";
    const res = this.result(cleared);
    if (typeof App !== "undefined" && App.gameOver) App.gameOver(res);
    return res;
  },

  quit() {
    if (this.state === "over") return;
    this.state = "over";
    if (typeof App !== "undefined" && App.gameOver) App.gameOver(null);
  },

  result(cleared) {
    const base = {
      mode: this.mode, cleared: !!cleared,
      misses: this.misses, flips: this.flips,
      time: Math.round(this.elapsed * 10) / 10,
      cols: this.cols, rows: this.rows, packId: this.packId,
    };
    if (this.mode === "hall") {
      const h = HALLS[this.hallIdx];
      return {
        ...base, hallIdx: this.hallIdx, pairs: this.pairs,
        found: this.pairsFound, timeLeft: Math.max(0, Math.round(this.clock)),
        par: h.par, ace: h.ace, stars: starsFor(h, this.misses, cleared),
      };
    }
    if (this.mode === "attack") {
      return { ...base, cleared: false, score: this.totalPairs, stage: this.stage, boards: this.stage };
    }
    return {
      ...base, boardId: this.boardId, scores: this.scores.slice(), names: this.names.slice(),
      winner: this.scores[0] === this.scores[1] ? -1 : (this.scores[0] > this.scores[1] ? 0 : 1),
    };
  },
};

if (typeof module !== "undefined") {
  module.exports = { Game, dealBoard, MISS_MS, MATCH_MS, FACE_DOWN, FACE_UP, FACE_MATCHED };
}
