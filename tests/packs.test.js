// Data linter for the packs, the themes and the 25 halls.
//
// The important half of this file is not "does the table look sensible" — it is
// that it DEALS EVERY BOARD IN THE GAME and reads the finished layout back. A
// deal that silently drops a pair, or puts three of one symbol down, produces a
// board that cannot be cleared, and no amount of staring at the registry finds
// it.

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const {
  MAX_PAIRS, PACKS, PACK_BY_ID, THEMES, WINGS, HALLS, ATTACK, DUEL_BOARDS,
  starsFor, pairsOf, dealBoard,
} = require("./load.js");

const SEEDS = [1, 2, 3, 7, 19, 404];

/* ---------------------------------------------------------------- packs -- */

test("every pack can fill the biggest board", () => {
  for (const p of PACKS) {
    assert.ok(p.symbols.length >= MAX_PAIRS,
      `${p.id} has ${p.symbols.length} symbols, needs ${MAX_PAIRS}`);
  }
});

test("no pack repeats a symbol", () => {
  for (const p of PACKS) {
    const seen = new Set();
    for (const s of p.symbols) {
      assert.ok(!seen.has(s), `${p.id} repeats ${s} — one card would have three partners`);
      seen.add(s);
    }
  }
});

test("packs are well formed", () => {
  const ids = new Set();
  for (const p of PACKS) {
    assert.ok(!ids.has(p.id), `duplicate pack id ${p.id}`);
    ids.add(p.id);
    assert.ok(["glyph", "text"].includes(p.kind), `${p.id} has kind ${p.kind}`);
    assert.ok(p.plaques.length >= 2, `${p.id} needs at least two plaque colours`);
    for (const c of p.plaques) assert.match(c, /^#[0-9a-f]{6}$/, `${p.id} plaque ${c}`);
    assert.ok(p.name && p.icon && p.blurb, `${p.id} is missing name/icon/blurb`);
  }
});

/* --------------------------------------------------------------- themes -- */

test("themes unlock in order and stay inside the star budget", () => {
  const maxStars = HALLS.length * 3;
  assert.strictEqual(THEMES[0].stars, 0, "the first theme must be free or a new player has no cabinet");
  for (let i = 1; i < THEMES.length; i++) {
    assert.ok(THEMES[i].stars > THEMES[i - 1].stars, `theme ${THEMES[i].id} does not cost more than the one before`);
  }
  for (const t of THEMES) {
    assert.ok(t.stars <= maxStars, `theme ${t.id} needs ${t.stars} stars but only ${maxStars} exist`);
    for (const k of ["table", "felt", "feltEdge", "grain", "rim", "back", "back2", "backInk", "ink"]) {
      assert.match(t[k], /^#[0-9a-f]{6}$/, `theme ${t.id}.${k} is not a hex colour`);
    }
  }
});

/* ---------------------------------------------------------------- halls -- */

test("every hall is a legal board", () => {
  for (let i = 0; i < HALLS.length; i++) {
    const h = HALLS[i];
    const n = h.cols * h.rows;
    assert.strictEqual(n % 2, 0, `hall ${i + 1} (${h.name}) has an odd number of cards`);
    assert.ok(h.cols <= 6, `hall ${i + 1} is ${h.cols} wide — over 6 stops reading on a phone`);
    assert.ok(pairsOf(h) <= MAX_PAIRS, `hall ${i + 1} needs ${pairsOf(h)} pairs`);
    const pack = PACK_BY_ID[h.pack];
    assert.ok(pack, `hall ${i + 1} names an unknown pack ${h.pack}`);
    assert.ok(pack.symbols.length >= pairsOf(h), `hall ${i + 1}: pack ${h.pack} is too small for it`);
    assert.ok(WINGS[h.wing], `hall ${i + 1} is in wing ${h.wing}, which does not exist`);
  }
});

test("halls are listed in wing order, five to a wing", () => {
  const counts = new Array(WINGS.length).fill(0);
  let wing = 0;
  for (const h of HALLS) {
    assert.ok(h.wing >= wing, "halls must be listed wing by wing");
    wing = h.wing;
    counts[h.wing]++;
  }
  for (let w = 0; w < WINGS.length; w++) assert.strictEqual(counts[w], 5, `wing ${w} has ${counts[w]} halls`);
});

test("the peek never gets longer as the campaign goes on", () => {
  for (let i = 1; i < HALLS.length; i++) {
    assert.ok(HALLS[i].peek <= HALLS[i - 1].peek + 1e-9,
      `hall ${i + 1} (${HALLS[i].peek}s) gets a longer look than hall ${i} (${HALLS[i - 1].peek}s)`);
  }
  assert.ok(HALLS[HALLS.length - 1].peek > 0, "the last hall must still get a look");
});

// The one that would ship a broken grade. starsFor tests `ace` first, so an ace
// at or above par swallows the two-star band whole and the hall can only ever
// score 1 or 3.
test("every hall has three reachable star bands", () => {
  for (let i = 0; i < HALLS.length; i++) {
    const h = HALLS[i];
    assert.ok(h.ace >= 0, `hall ${i + 1} has a negative ace`);
    assert.ok(h.ace < h.par, `hall ${i + 1}: ace ${h.ace} is not below par ${h.par}`);
    assert.strictEqual(starsFor(h, h.ace, true), 3, `hall ${i + 1} does not award 3 stars at its own ace`);
    assert.strictEqual(starsFor(h, h.par, true), 2, `hall ${i + 1} does not award 2 stars at its own par`);
    assert.strictEqual(starsFor(h, h.par + 1, true), 1, `hall ${i + 1} does not award 1 star past par`);
    assert.strictEqual(starsFor(h, 0, false), 0, "a hall you did not clear must award nothing");
  }
});

test("the clock leaves room for a person rather than a bot", () => {
  for (let i = 0; i < HALLS.length; i++) {
    const h = HALLS[i];
    // Four seconds a pair plus fifteen. Below this the hall is a typing test.
    assert.ok(h.time >= pairsOf(h) * 4 + 15 - 1,
      `hall ${i + 1} gives ${h.time}s for ${pairsOf(h)} pairs — too tight for a child`);
  }
});

/* ------------------------------------------------------ the actual deal -- */

function checkDeal(label, b) {
  const counts = new Map();
  for (let i = 0; i < b.n; i++) counts.set(b.sym[i], (counts.get(b.sym[i]) || 0) + 1);
  assert.strictEqual(counts.size, b.pairs, `${label}: ${counts.size} distinct symbols for ${b.pairs} pairs`);
  for (const [s, c] of counts) assert.strictEqual(c, 2, `${label}: symbol ${s} appears ${c} times`);

  // Both halves of a pair must agree on their plaque, or the colour tells you
  // which cards CANNOT match, which is a clue the game never meant to give.
  const plaqueOfPair = new Map();
  for (let i = 0; i < b.n; i++) {
    const p = b.pairOf[i];
    if (!plaqueOfPair.has(p)) plaqueOfPair.set(p, b.plaque[i]);
    else assert.strictEqual(b.plaque[i], plaqueOfPair.get(p), `${label}: pair ${p} has two different plaques`);
  }

  // And no colour may belong to exactly one pair: on a small board that would
  // identify the partner outright and there would be nothing left to remember.
  const perColour = new Map();
  for (const c of plaqueOfPair.values()) perColour.set(c, (perColour.get(c) || 0) + 1);
  if (b.pairs >= 4) {
    for (const [c, n] of perColour) {
      assert.ok(n >= 2, `${label}: plaque ${c} is used by exactly one pair, which gives it away`);
    }
  }
}

test("every campaign board deals correctly, on every seed", () => {
  for (let i = 0; i < HALLS.length; i++) {
    const h = HALLS[i];
    for (const seed of SEEDS) checkDeal(`hall ${i + 1} seed ${seed}`, dealBoard(h.cols, h.rows, h.pack, seed));
  }
});

test("every Time Attack and duel board deals correctly", () => {
  for (let s = 0; s < ATTACK.ladder.length + 3; s++) {
    const st = ATTACK.stageAt(s);
    for (const seed of SEEDS) checkDeal(`attack stage ${s} seed ${seed}`, dealBoard(st.cols, st.rows, st.pack, `${seed}|stage${s}`));
  }
  for (const d of DUEL_BOARDS) {
    assert.strictEqual((d.cols * d.rows) % 2, 0, `duel board ${d.id} is odd`);
    for (const seed of SEEDS) checkDeal(`duel ${d.id} seed ${seed}`, dealBoard(d.cols, d.rows, d.pack, seed));
  }
});

test("the same seed always deals the same board, and different seeds do not", () => {
  const a = dealBoard(5, 4, "reef", 42);
  const b = dealBoard(5, 4, "reef", 42);
  assert.deepStrictEqual(a.sym, b.sym, "the deal is not reproducible — Time Attack scores would not compare");
  const c = dealBoard(5, 4, "reef", 43);
  assert.notDeepStrictEqual(a.sym, c.sym, "two seeds produced the identical board");
});

test("a board of odd size is refused rather than half-dealt", () => {
  assert.throws(() => dealBoard(3, 3, "reef", 1), /odd number/);
  assert.throws(() => dealBoard(4, 4, "nope", 1), /unknown pack/);
});

/* ------------------------------------------------- the engine's purity -- */

// Comments are stripped first. Both halves of this check tripped over their own
// subject being named in the header comment of the file they were checking —
// game.js opens with "No DOM, no canvas, no Math.random", which is the promise
// this test exists to enforce and which fails it if read literally.
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

test("nothing in the engine or the data reaches for Math.random or the DOM", () => {
  for (const f of ["js/game.js", "js/halls.js", "js/packs.js", "js/rng.js"]) {
    const src = stripComments(fs.readFileSync(path.join(__dirname, "..", f), "utf8"));
    assert.ok(!/Math\.random\s*\(/.test(src), `${f} uses Math.random — the campaign would stop replaying`);
    assert.ok(!/\b(document|window|localStorage)\b|getElementById|getContext|canvas/i.test(src),
      `${f} touches the DOM, so the bots cannot run it`);
  }
});
