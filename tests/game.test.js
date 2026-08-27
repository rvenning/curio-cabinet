// The engine's rules, asserted directly. These are the things a player would
// notice within thirty seconds and that no balance run would ever catch.

const test = require("node:test");
const assert = require("node:assert");

const { Game, HALLS, ATTACK, MISS_MS, MATCH_MS } = require("./load.js");

// Advance the engine by real seconds, the way the frame loop does.
const step = (secs) => { for (let i = 0; i < Math.round(secs * 60); i++) Game.update(1 / 60); };

// The two positions holding pair `p`.
function findPair(p) {
  const out = [];
  for (let i = 0; i < Game.n; i++) if (Game.pairOf[i] === p) out.push(i);
  return out;
}
// Two positions that do NOT match, both still face down.
function findMismatch() {
  for (let i = 0; i < Game.n; i++) {
    if (Game.face[i] !== 0) continue;
    for (let j = i + 1; j < Game.n; j++) {
      if (Game.face[j] === 0 && Game.pairOf[i] !== Game.pairOf[j]) return [i, j];
    }
  }
  return null;
}

function startHall(idx = 4, seed = 5) {
  Game.start({ mode: "hall", hallIdx: idx, seed });
  step(HALLS[idx].peek + 0.1);          // sit through the look
  assert.strictEqual(Game.state, "play");
}

/* ----------------------------------------------------------- the basics -- */

test("the peek holds the clock, then hands over to play", () => {
  Game.start({ mode: "hall", hallIdx: 0, seed: 1 });
  assert.strictEqual(Game.state, "peek");
  const clock = Game.clock;
  step(HALLS[0].peek - 0.2);
  assert.strictEqual(Game.clock, clock, "the clock ran during the peek");
  assert.strictEqual(Game.tap(0), false, "a tap during the peek was accepted");
  step(0.4);
  assert.strictEqual(Game.state, "play");
});

test("two of a kind stay up and count", () => {
  startHall();
  const [a, b] = findPair(0);
  Game.tap(a);
  assert.strictEqual(Game.face[a], 1);
  Game.tap(b);
  assert.strictEqual(Game.face[a], 2);
  assert.strictEqual(Game.face[b], 2);
  assert.strictEqual(Game.pairsFound, 1);
  assert.strictEqual(Game.misses, 0);
  assert.strictEqual(Game.flips, 2);
});

// The bug this suite was written around: resolveMismatch used to guard on its
// own timer, and update() calls it at the exact instant that timer hits zero —
// so the two cards stayed up forever and every board deadlocked on the first
// miss.
test("two that do not match come back down on their own", () => {
  startHall();
  const [a, b] = findMismatch();
  Game.tap(a); Game.tap(b);
  assert.strictEqual(Game.misses, 1);
  assert.strictEqual(Game.face[a], 1, "they should still be visible");
  step(MISS_MS * 0.5);
  assert.strictEqual(Game.face[a], 1, "they went down before the player could look");
  step(MISS_MS);
  assert.strictEqual(Game.face[a], 0, "they never came back down — the board is deadlocked");
  assert.strictEqual(Game.face[b], 0);
  assert.deepStrictEqual([...Game.up], []);
  assert.ok(Game.tap(a), "the board is unusable after one miss");
});

test("a third tap hurries the flip-back rather than being swallowed", () => {
  startHall();
  const [a, b] = findMismatch();
  Game.tap(a); Game.tap(b);
  step(0.1);
  const c = [...Array(Game.n).keys()].find((i) => i !== a && i !== b && Game.face[i] === 0);
  assert.ok(Game.tap(c), "the impatient tap did nothing");
  assert.strictEqual(Game.face[a], 0, "the mismatched pair was not resolved by the third tap");
  assert.strictEqual(Game.face[c], 1);
  assert.deepStrictEqual([...Game.up], [c]);
});

test("a card cannot be turned twice, or turned back by tapping it", () => {
  startHall();
  const [a] = findPair(0);
  assert.ok(Game.tap(a));
  assert.strictEqual(Game.tap(a), false, "the same card was accepted twice");
  assert.strictEqual(Game.flips, 1);
  const [x, y] = findPair(1);
  Game.tap(x); // second of the turn, mismatching a
  step(MISS_MS + 0.1);
  Game.tap(x); Game.tap(y);
  assert.strictEqual(Game.face[x], 2);
  assert.strictEqual(Game.tap(x), false, "a matched card could be turned again");
});

test("out of range taps are refused, not thrown", () => {
  startHall();
  assert.strictEqual(Game.tap(-1), false);
  assert.strictEqual(Game.tap(Game.n), false);
  assert.strictEqual(Game.tap(9999), false);
});

/* -------------------------------------------------------- hall outcomes -- */

test("clearing a hall ends it as a win with the right grade", () => {
  startHall(3, 9);
  const h = HALLS[3];
  for (let p = 0; p < Game.pairs; p++) {
    const [a, b] = findPair(p);
    Game.tap(a); Game.tap(b);
    step(MATCH_MS + 0.02);
  }
  assert.strictEqual(Game.state, "over");
  const res = Game.result(true);
  assert.strictEqual(res.cleared, true);
  assert.strictEqual(res.misses, 0);
  assert.strictEqual(res.stars, 3, "a flawless clear did not get three stars");
  assert.ok(res.timeLeft > 0);
  assert.strictEqual(res.par, h.par);
});

test("running the clock out loses the hall", () => {
  startHall(0, 3);
  step(HALLS[0].time + 1);
  assert.strictEqual(Game.state, "over");
  assert.strictEqual(Game.clock, 0);
  assert.strictEqual(Game.result(false).cleared, false);
  assert.strictEqual(Game.result(false).stars, 0);
});

test("the engine is inert once it is over, and while it is paused", () => {
  startHall(0, 3);
  const before = Game.clock;
  Game.paused = true;
  step(2);
  assert.strictEqual(Game.clock, before, "the clock ran while paused");
  assert.strictEqual(Game.tap(0), false, "a tap landed while paused");
  Game.paused = false;

  Game.quit();
  assert.strictEqual(Game.state, "over");
  const after = Game.clock;
  step(2);
  assert.strictEqual(Game.clock, after, "the clock ran after the game ended");
  assert.strictEqual(Game.tap(0), false);
});

test("one enormous frame cannot skip the whole clock", () => {
  startHall(4, 3);
  const before = Game.clock;
  Game.update(60);           // the tab was hidden for a minute
  assert.ok(before - Game.clock <= 0.06, `a single 60s frame took ${(before - Game.clock).toFixed(2)}s off the clock`);
  assert.strictEqual(Game.state, "play");
});

/* --------------------------------------------------------- time attack -- */

test("Time Attack starts at thirty seconds and pairs buy time back", () => {
  Game.start({ mode: "attack", seed: 4 });
  assert.strictEqual(Game.clock, ATTACK.start);
  step(ATTACK.peek + 0.1);
  const before = Game.clock;
  const [a, b] = findPair(0);
  Game.tap(a); Game.tap(b);
  assert.ok(Game.clock > before, "finding a pair did not add time");
  assert.ok(Math.abs((Game.clock - before) - ATTACK.pairBonus) < 0.05);
});

test("clearing an attack board deals a bigger one and pays the bonus", () => {
  Game.start({ mode: "attack", seed: 4 });
  step(ATTACK.peek + 0.1);
  const firstN = Game.n;
  let clock = 0;
  for (let p = 0; p < Game.pairs; p++) {
    const [a, b] = findPair(p);
    Game.tap(a); Game.tap(b);
    if (p === Game.pairs - 1) clock = Game.clock;
    step(0.05);
  }
  assert.strictEqual(Game.stage, 0, "the new board was dealt before the last pair had landed");
  step(MATCH_MS + 0.1);
  assert.strictEqual(Game.stage, 1, "the next board was never dealt");
  assert.ok(Game.n > firstN, "the next board is not bigger");
  assert.ok(Game.clock > clock - 1, "the clear bonus never arrived");
  assert.strictEqual(Game.totalPairs, firstN / 2, "the running score reset with the board");
  assert.strictEqual(Game.state, "peek", "the new board gets its own look");
});

test("Time Attack ends on the clock and reports pairs as the score", () => {
  Game.start({ mode: "attack", seed: 4 });
  step(ATTACK.peek + 0.1);
  const [a, b] = findPair(0);
  Game.tap(a); Game.tap(b);
  step(ATTACK.start + ATTACK.pairBonus + 2);
  assert.strictEqual(Game.state, "over");
  const res = Game.result(false);
  assert.strictEqual(res.score, 1);
  assert.strictEqual(res.mode, "attack");
});

/* ---------------------------------------------------------------- duel -- */

test("a duel passes the turn on a miss and only on a miss", () => {
  Game.start({ mode: "duel", boardId: "small", seed: 8 });
  step(1.5);
  assert.strictEqual(Game.turn, 0);

  const [a, b] = findPair(0);
  Game.tap(a); Game.tap(b);
  assert.strictEqual(Game.turn, 0, "a match should mean you go again");
  assert.deepStrictEqual([...Game.scores], [1, 0]);
  step(MATCH_MS + 0.05);

  const m = findMismatch();
  Game.tap(m[0]); Game.tap(m[1]);
  assert.strictEqual(Game.turn, 0, "the turn passed before the cards could be looked at");
  step(MISS_MS + 0.1);
  assert.strictEqual(Game.turn, 1, "the turn never passed");
  assert.deepStrictEqual([...Game.scores], [1, 0]);
});

test("a duel has no clock to run out and names a winner", () => {
  Game.start({ mode: "duel", boardId: "small", seed: 8, names: ["Rosalie", "Dad"] });
  step(1.5);
  step(600);
  assert.strictEqual(Game.state, "play", "a duel timed out — there is no clock to lose to");
  assert.ok(Game.clock > 500, "the duel clock should count up");

  for (let p = 0; p < Game.pairs; p++) {
    const [a, b] = findPair(p);
    Game.tap(a); Game.tap(b);
    step(MATCH_MS + 0.02);
  }
  assert.strictEqual(Game.state, "over");
  const res = Game.result(true);
  assert.strictEqual(res.scores[0] + res.scores[1], Game.pairs);
  assert.strictEqual(res.winner, 0);
  assert.deepStrictEqual([...res.names], ["Rosalie", "Dad"]);
});
