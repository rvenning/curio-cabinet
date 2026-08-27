// Balance. Every hall is played by bots with real memory spans (see
// memory-bot.js for why a perfect-recall bot is useless here).
//
// The guarantee being defended is Robert's standing one: losing a hall is fine,
// being STUCK is not. So the assertions are about the span-7 bot — roughly an
// attentive eight-year-old — clearing everything, while the star bands stay
// worth earning.
//
//   CD_REPORT=1 node --test tests/bot.test.js     print the per-hall table
//
// (an env var, not process.argv: node --test runs each file in a child process
// and the arguments do not survive the trip.)

const test = require("node:test");
const assert = require("node:assert");

const { Game, HALLS, ATTACK, DUEL_BOARDS, pairsOf } = require("./load.js");
const { MemoryBot, playRun } = require("./memory-bot.js");

const SEEDS = [11, 23, 47, 91, 137, 211];
const REPORT = !!process.env.CD_REPORT;

const span4 = () => new MemoryBot({ span: 4, think: 0.85, name: "span4" });
const span7 = () => new MemoryBot({ span: 7, think: 0.68, name: "span7" });
const span12 = () => new MemoryBot({ span: 12, think: 0.55, name: "span12" });

const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;

function hallRuns(idx, makeBot) {
  return SEEDS.map((seed) => {
    Game.start({ mode: "hall", hallIdx: idx, seed });
    const r = playRun(Game, makeBot(), { budget: 600 });
    return { ...r.result, timedOut: r.timedOut };
  });
}

/* ---------------------------------------------------- nobody gets stuck -- */

test("the span-7 bot clears every hall inside its clock, on every seed", () => {
  const rows = [];
  for (let i = 0; i < HALLS.length; i++) {
    const runs = hallRuns(i, span7);
    const failed = runs.filter((r) => !r.cleared);
    rows.push([i + 1, HALLS[i].name, mean(runs.map((r) => r.time)).toFixed(0),
      mean(runs.map((r) => r.misses)).toFixed(1), mean(runs.map((r) => r.stars)).toFixed(1)]);
    assert.strictEqual(failed.length, 0,
      `hall ${i + 1} (${HALLS[i].name}) beat the bot on ${failed.length}/${runs.length} seeds ` +
      `— ${HALLS[i].time}s for ${pairsOf(HALLS[i])} pairs is too tight`);
  }
  if (REPORT) {
    console.log("\n  hall                    time  miss  stars");
    for (const r of rows) console.log(`  ${String(r[0]).padStart(2)} ${r[1].padEnd(19)}${r[2].padStart(5)}s${r[3].padStart(6)}${r[4].padStart(7)}`);
  }
});

test("the first wing is clearable even by a very short memory", () => {
  // Not the balance target — the floor. If the opening five halls need more
  // than four cards held in your head, nobody younger than the target audience
  // can ever get started.
  for (let i = 0; i < 5; i++) {
    const runs = hallRuns(i, span4);
    const ok = runs.filter((r) => r.cleared).length;
    assert.ok(ok >= runs.length - 1,
      `hall ${i + 1} was cleared on only ${ok}/${runs.length} seeds by the span-4 bot`);
  }
});

test("no hall is a wall for the strongest bot either", () => {
  for (let i = 0; i < HALLS.length; i++) {
    const runs = hallRuns(i, span12);
    assert.ok(runs.every((r) => r.cleared && !r.timedOut), `hall ${i + 1} defeated the span-12 bot`);
  }
});

/* ------------------------------------------------- the stars mean something -- */

test("three stars is earned, not handed out", () => {
  // Across the whole campaign the span-7 bot should sit around two stars a
  // hall. Much above and the grade is decoration; much below and the theme
  // unlocks are out of reach.
  let stars = 0;
  for (let i = 0; i < HALLS.length; i++) stars += mean(hallRuns(i, span7).map((r) => r.stars));
  const perHall = stars / HALLS.length;
  assert.ok(perHall > 1.6 && perHall < 2.6,
    `the span-7 bot averages ${perHall.toFixed(2)} stars a hall — the bands need moving`);

  let best = 0;
  for (let i = 0; i < HALLS.length; i++) best += mean(hallRuns(i, span12).map((r) => r.stars));
  assert.ok(best < HALLS.length * 3,
    "the span-12 bot maxed the campaign — three stars is not an achievement anywhere");
  assert.ok(best > stars, "playing better did not score better, which makes the grade meaningless");
});

test("the last wing is harder than the first, and the packs are why", () => {
  // Same board size, different pack: hall 5 is 5×4 fruit and hall 21 is 5×4
  // numbers. If abstract symbols are not measurably harder to hold, the whole
  // shape of the campaign is a lie.
  const easy = mean(hallRuns(4, span7).map((r) => r.misses));
  const hard = mean(hallRuns(20, span7).map((r) => r.misses));
  assert.strictEqual(HALLS[4].cols * HALLS[4].rows, HALLS[20].cols * HALLS[20].rows);
  assert.ok(hard >= easy, `the Reading Room's 5×4 (${hard.toFixed(1)} misses) is not harder than the Front Hall's (${easy.toFixed(1)})`);
});

/* -------------------------------------------------------- time attack -- */

test("a Time Attack run always ends, however good the player", () => {
  for (const make of [span4, span7, span12]) {
    for (const seed of SEEDS) {
      Game.start({ mode: "attack", seed });
      const r = playRun(Game, make(), { budget: 900 });
      assert.ok(!r.timedOut,
        `${make().name} never ran out of clock in ${seed} — pairBonus ${ATTACK.pairBonus} outpaces the boards`);
      assert.ok(r.result.score > 0, "a run scored nothing at all");
    }
  }
});

test("Time Attack rewards a better memory, by a margin you would feel", () => {
  const score = (make) => mean(SEEDS.map((seed) => {
    Game.start({ mode: "attack", seed });
    return playRun(Game, make(), { budget: 900 }).result.score;
  }));
  const weak = score(span4), mid = score(span7), strong = score(span12);
  if (REPORT) console.log(`\n  attack: span4 ${weak.toFixed(0)}p · span7 ${mid.toFixed(0)}p · span12 ${strong.toFixed(0)}p`);
  assert.ok(mid > weak * 1.4, `span7 ${mid.toFixed(0)}p is not clearly ahead of span4 ${weak.toFixed(0)}p`);
  assert.ok(strong > mid * 1.4, `span12 ${strong.toFixed(0)}p is not clearly ahead of span7 ${mid.toFixed(0)}p`);
});

test("a Time Attack run is a session, not an evening", () => {
  const secs = mean(SEEDS.map((seed) => {
    Game.start({ mode: "attack", seed });
    return playRun(Game, span7(), { budget: 900 }).result.time;
  }));
  assert.ok(secs > 60 && secs < 260, `a typical run lasts ${secs.toFixed(0)}s`);
});

/* --------------------------------------------------------------- duel -- */

test("every duel board can be finished by two ordinary memories", () => {
  for (const d of DUEL_BOARDS) {
    Game.start({ mode: "duel", boardId: d.id, seed: 31 });
    const r = playRun(Game, span4(), { budget: 900 });
    assert.ok(!r.timedOut, `the ${d.name} duel board never finished`);
    assert.strictEqual(Game.pairsFound, Game.pairs);
    assert.strictEqual(r.result.scores[0] + r.result.scores[1], Game.pairs,
      "the two scores do not add up to the board");
  }
});

/* ------------------------------------------------------ determinism -- */

test("the same seed and the same bot replay identically", () => {
  const run = () => {
    Game.start({ mode: "hall", hallIdx: 12, seed: 77 });
    return playRun(Game, span7(), { budget: 600 }).result;
  };
  const a = run(), b = run();
  assert.strictEqual(a.misses, b.misses, "two identical runs disagreed — something reads a real clock or Math.random");
  assert.strictEqual(a.flips, b.flips);
  assert.strictEqual(a.time, b.time);
});
