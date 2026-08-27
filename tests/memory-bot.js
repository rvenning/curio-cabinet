// The balance bot for a memory game — shared by tests/bot.test.js and
// tools/calibrate.js.
//
// The whole trick is that a bot with PERFECT recall proves nothing. Give it a
// complete memory and it clears any board in close to the theoretical minimum
// number of flips, every board looks trivially winnable, and the time limits
// you set from it are limits no human will ever meet. A memory game has to be
// balanced against a bot that FORGETS.
//
// So the bot has a span: it holds the last N distinct cards it has looked at,
// as a strict LRU, and everything older is gone. That is deterministic — no
// RNG anywhere in the bot at all — which means the campaign replays byte-exactly
// and a changed clear time is always a real balance change.
//
// Three spans are used, and they bracket the family:
//
//   span 4   a young child, or an adult not really paying attention. This is
//            the "is anyone ever STUCK?" floor, not the balance target.
//   span 7   Rosalie, and the number the campaign is tuned against. Seven is
//            about the middle of the classic short-term span for a child of
//            eight, and it is deliberately not generous.
//   span 12  a strong adult concentrating. This is what the top of the Time
//            Attack leaderboard should look like.
//
// The peek is modelled too, and it matters: you scan the flashed board from the
// top-left at roughly SCAN_RATE seconds a card and stop when either the flash
// ends or your span fills. That makes `peek` in halls.js a real tuning knob
// rather than a decoration.

const SCAN_RATE = 0.35;    // seconds a peeking player spends registering one card

class MemoryBot {
  constructor({ span = 7, think = 0.68, name = "", seed = 0x5eed } = {}) {
    this.span = span;
    this.think = think;                       // seconds between taps
    this.name = name || `span${span}`;
    this.baseSeed = seed;
    this.mem = new Map();                     // position -> symbol, insertion-ordered LRU
    this.a = seed;
  }

  reset() { this.mem.clear(); this.a = this.baseSeed; }

  // The bot's own generator, seeded and reseeded from a constant, so every run
  // replays identically while the bot is still not SYSTEMATIC.
  //
  // That distinction is the whole reason this exists. A bot that always turns
  // "the first card I have not seen" sweeps the board in perfect lockstep and
  // pairs the same two cards together on every pass — and a pairing that did
  // not match will never match, so it churns forever. Eight hundred misses on
  // a twelve-card board is not a difficulty finding, it is a broken bot, and it
  // survived the obvious fix (a cursor that advances) because a cursor stepping
  // two cards a turn keeps its parity and the sweep simply repeats one card
  // later. People are not systematic; they pick a card they have not tried yet
  // and are not careful about which. That is what this models, and being
  // unsystematic is what makes progress inevitable.
  roll() {
    this.a = (this.a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(this.a ^ (this.a >>> 15), 1 | this.a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  see(pos, symbol) {
    if (this.mem.has(pos)) this.mem.delete(pos);   // refresh: move to the back
    this.mem.set(pos, symbol);
    while (this.mem.size > this.span) this.mem.delete(this.mem.keys().next().value);
  }

  forget(pos) { this.mem.delete(pos); }

  // The flash at the start of a board. You read from the top-left and stop when
  // the flash ends or you run out of head, whichever comes first.
  observePeek(game, seconds) {
    const canScan = Math.min(this.span, Math.floor(seconds / SCAN_RATE));
    for (let i = 0; i < game.n && i < canScan; i++) this.see(i, game.sym[i]);
  }

  // Anything currently face-up is being looked at.
  observe(game) {
    for (const i of game.up) this.see(i, game.sym[i]);
    for (let i = 0; i < game.n; i++) if (game.face[i] === 2) this.forget(i);
  }

  // One of the cards still in play that the bot cannot currently name — picked
  // without system, for the reason in roll()'s comment.
  someUnknown(game, not = -1) {
    const opts = [];
    for (let i = 0; i < game.n; i++) {
      if (i === not || game.face[i] !== 0 || this.mem.has(i)) continue;
      opts.push(i);
    }
    if (!opts.length) return -1;
    return opts[Math.floor(this.roll() * opts.length)];
  }

  // Last resort: everything left is already in memory but nothing pairs up,
  // which means the memory is incomplete rather than wrong. Turn something.
  someFaceDown(game, not = -1) {
    const opts = [];
    for (let i = 0; i < game.n; i++) if (i !== not && game.face[i] === 0) opts.push(i);
    if (!opts.length) return -1;
    return opts[Math.floor(this.roll() * opts.length)];
  }

  // A pair it can prove from memory alone.
  knownPair(game) {
    const bySym = new Map();
    for (const [pos, s] of this.mem) {
      if (game.face[pos] !== 0) continue;
      if (bySym.has(s)) return [bySym.get(s), pos];
      bySym.set(s, pos);
    }
    return null;
  }

  // Which card to turn over next, given what is already face-up.
  choose(game) {
    if (game.up.length === 0) {
      const known = this.knownPair(game);
      if (known) { this.plan = known; return known[0]; }
      this.plan = null;
      const u = this.someUnknown(game);
      if (u >= 0) return u;
      return this.someFaceDown(game);
    }

    const a = game.up[0];
    if (this.plan && this.plan[0] === a && game.face[this.plan[1]] === 0) return this.plan[1];

    // We can see the card we just turned, so its partner may be in memory.
    const want = game.sym[a];
    for (const [pos, s] of this.mem) {
      if (pos !== a && s === want && game.face[pos] === 0) return pos;
    }
    const u = this.someUnknown(game, a);
    if (u >= 0) return u;
    return this.someFaceDown(game, a);
  }
}

// Drive the real engine with a bot. Nothing here touches the DOM or a clock —
// time advances only because we advance it.
//
// `impatient` models the strong player who taps a third card before the
// mismatched pair has flipped itself back. Off by default: waiting the full
// MISS_MS is what a player who is actually trying to REMEMBER the two cards
// does, and a balance guarantee should be built on the conservative one.
function playRun(Game, bot, opts = {}) {
  const dt = 1 / 60;
  const budget = opts.budget ?? 900;          // seconds of simulated time
  const impatient = opts.impatient ?? false;
  bot.reset();

  let t = 0, nextTapAt = 0, onStage = -1;
  while (Game.running() && t < budget) {
    Game.update(dt);
    t += dt;

    // A new board means a new set of positions, so everything remembered about
    // the last one is worse than useless — it would point at cards that are no
    // longer there. Forget it all, then take the flash.
    if (onStage !== Game.stage) {
      onStage = Game.stage;
      bot.reset();
      if (Game.state === "peek") bot.observePeek(Game, Game.peekLeft);
      nextTapAt = t + bot.think;
    }
    if (Game.state === "peek") continue;

    if (t < nextTapAt) continue;
    // A mismatched pair is still up: the bot is looking at it, which is the
    // point of the pause. It taps through only if it is the impatient sort.
    if (Game.mismatchLeft > 0 && !impatient) continue;

    bot.observe(Game);
    const i = bot.choose(Game);
    if (i < 0) break;
    if (!Game.tap(i)) break;
    bot.see(i, Game.sym[i]);
    nextTapAt = t + bot.think;
  }

  return { simTime: t, timedOut: t >= budget, result: Game.result(Game.pairsFound >= Game.pairs) };
}

module.exports = { MemoryBot, playRun, SCAN_RATE };
