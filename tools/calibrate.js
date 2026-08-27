// Where the numbers in halls.js come from.
//
//   node tools/calibrate.js            campaign table + suggested time/par/ace
//   node tools/calibrate.js attack     Time Attack, swept over pairBonus
//
// Nothing in a memory game can be tuned by feel, because the only thing being
// measured is how much a player forgets — and you cannot introspect that. So
// every hall is played by three bots with real memory spans (see
// tests/memory-bot.js) across several deals, and the table below is what the
// campaign actually costs.
//
// The rules the suggestions follow:
//   time  the span-7 bot's slowest clear across the seeds, plus 30% headroom.
//         Generous on purpose: the clock is there to make the last few pairs
//         tense, not to be the thing that beats you. Losing a hall should feel
//         like a near miss, and a bot has no hands.
//   par   the span-7 bot's median misses. Two stars means "you remembered
//         about as well as a reasonably attentive eight-year-old".
//   ace   the span-12 bot's median misses, rounded up. Three stars is a real
//         achievement and the campaign does not require it anywhere.

const { HALLS, ATTACK, Game, starsFor } = require("../tests/load.js");
const { MemoryBot, playRun } = require("../tests/memory-bot.js");

const SEEDS = [11, 23, 47, 91, 137, 211];

const BOTS = () => [
  new MemoryBot({ span: 4, think: 0.85, name: "span4 (young)" }),
  new MemoryBot({ span: 7, think: 0.68, name: "span7 (Rosalie)" }),
  new MemoryBot({ span: 12, think: 0.55, name: "span12 (adult)" }),
];

const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;

function runHall(idx, bot, seed) {
  Game.start({ mode: "hall", hallIdx: idx, seed });
  // A big budget: we want to know what the hall COSTS, not whether it fits the
  // limit currently written down. The limit is the output of this, not an input.
  const orig = Game.clock;
  Game.clock = 100000;
  const r = playRun(Game, bot, { budget: 1200 });
  return { ...r.result, simTime: r.simTime, wroteLimit: orig, cleared: Game.pairsFound >= Game.pairs };
}

function campaign() {
  console.log("\n  #  hall                 board   pairs   ───── span4 ─────   ──── span7 ─────   ──── span12 ────");
  console.log("                                              time  miss  ok    time  miss  ok    time  miss  ok    │  time  par  ace");
  const suggest = [];

  for (let i = 0; i < HALLS.length; i++) {
    const h = HALLS[i];
    const cells = [];
    let s7times = [], s7miss = [], s12miss = [];

    for (const bot of BOTS()) {
      const runs = SEEDS.map((s) => runHall(i, bot, s));
      const times = runs.map((r) => r.simTime);
      const misses = runs.map((r) => r.misses);
      const ok = runs.filter((r) => r.cleared).length;
      cells.push(`${mean(times).toFixed(0).padStart(5)}s${med(misses).toString().padStart(5)}${(ok + "/" + runs.length).padStart(6)}`);
      if (bot.span === 7) { s7times = times; s7miss = misses; }
      if (bot.span === 12) s12miss = misses;
    }

    // Generous on the clock (a memory game lost to a timer is the most
    // annoying way to lose there is) and tight on the misses, which is where
    // the actual grading belongs.
    const time = Math.ceil((Math.max(...s7times) * 1.45) / 5) * 5;
    const par = Math.max(1, med(s7miss));
    // ace must sit strictly INSIDE par or the two-star band is empty and the
    // grade is unreachable — starsFor tests ace first, so an ace above par
    // silently swallows the two-star result whole.
    const ace = Math.max(0, Math.min(par - 1, Math.ceil(mean(s12miss))));
    suggest.push({ i, time, par, ace });

    console.log(
      `${String(i + 1).padStart(3)}  ${h.name.padEnd(19)}${(h.cols + "×" + h.rows).padStart(6)}${String((h.cols * h.rows) / 2).padStart(6)}   ` +
      cells.join("  ") + `    │${String(time).padStart(6)}${String(par).padStart(5)}${String(ace).padStart(5)}`);
  }

  console.log("\n  Paste into halls.js (time / par / ace):");
  for (const s of suggest) {
    console.log(`   ${String(s.i + 1).padStart(2)}: time: ${s.time}, par: ${s.par}, ace: ${s.ace}`);
  }

  // What the campaign feels like at the numbers currently written down.
  console.log("\n  Against the CURRENT halls.js numbers:");
  for (const bot of BOTS()) {
    let clears = 0, stars = 0, worst = null;
    for (let i = 0; i < HALLS.length; i++) {
      const runs = SEEDS.map((s) => {
        Game.start({ mode: "hall", hallIdx: i, seed: s });
        const r = playRun(Game, bot, { budget: 1200 });
        return r.result;
      });
      const ok = runs.filter((r) => r.cleared).length;
      const st = mean(runs.map((r) => r.stars));
      clears += ok / runs.length;
      stars += st;
      if (!worst || ok / runs.length < worst.rate) worst = { hall: i + 1, rate: ok / runs.length };
    }
    console.log(`   ${bot.name.padEnd(16)} clears ${(clears / HALLS.length * 100).toFixed(0)}% of halls · ` +
      `${stars.toFixed(1)}/${HALLS.length * 3} stars · worst hall ${worst.hall} at ${(worst.rate * 100).toFixed(0)}%`);
  }
}

function attack(bonusSweep) {
  const bonuses = bonusSweep || [2.0, 2.4, 2.6, 2.8, 3.2];
  console.log("\n  Time Attack — score is pairs found, run ends when the clock does.");
  console.log("  bonus   span4            span7            span12           spread");
  for (const b of bonuses) {
    const orig = ATTACK.pairBonus;
    ATTACK.pairBonus = b;
    const out = [];
    for (const bot of BOTS()) {
      const scores = SEEDS.map((s) => {
        Game.start({ mode: "attack", seed: s });
        const r = playRun(Game, bot, { budget: 1800 });
        return r.result;
      });
      out.push({
        score: mean(scores.map((r) => r.score)),
        stage: mean(scores.map((r) => r.stage)),
        secs: mean(scores.map((r) => r.time)),
      });
    }
    ATTACK.pairBonus = orig;
    console.log(`  ${b.toFixed(1)}   ` + out.map((o) =>
      `${o.score.toFixed(0).padStart(3)}p b${o.stage.toFixed(1)} ${o.secs.toFixed(0)}s`.padEnd(17)).join("") +
      `  ×${(out[2].score / Math.max(1, out[0].score)).toFixed(2)}`);
  }
  console.log("\n  Want: no run unbounded, span12 clearly ahead of span4 (×1.6+),");
  console.log("  and a typical span7 run between 90 and 180 seconds.");
}

if (process.argv[2] === "attack") attack();
else { campaign(); attack([ATTACK.pairBonus]); }
