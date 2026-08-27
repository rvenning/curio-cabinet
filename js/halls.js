// The campaign: 25 halls in 5 wings, plus the Time Attack ladder.
//
// The shape of the ladder is the design. Each wing STARTS SMALLER than the last
// one finished, and gets its difficulty back from the pack instead — a 5×4 of
// capital letters in the Reading Room is harder than a 6×6 of animals in the
// Long Gallery, because a letter gives you nothing to picture. That keeps the
// biggest boards rare (they are slow, not clever) and makes the last wing feel
// different rather than merely longer.
//
// `peek` is the one kindness: the whole board flashes face-up for that many
// seconds before the clock starts. It shrinks across the campaign and never
// reaches zero, because a glance you cannot possibly hold all of is still a
// fair thing to be given.
//
// `time`, `par` and `ace` are NOT hand-guessed. They come from tools/calibrate.js,
// which plays every hall with a bot that has a real memory span and reports what
// the hall actually costs. See the header of that file.

const WINGS = [
  { name: "The Front Hall",   icon: "🚪", edge: "#e2a33a",
    blurb: "Where the cabinet stands. Big drawers, friendly faces, nothing hurried." },
  { name: "The Long Gallery", icon: "🖼️", edge: "#3f9bb5",
    blurb: "Twice the length and twice the drawers. Things start to look alike." },
  { name: "The Star Room",    icon: "🔭", edge: "#7b6ad0",
    blurb: "Small, round and glowing — nearly all of it. Good luck telling them apart." },
  { name: "The Workshop",     icon: "🔧", edge: "#7a8794",
    blurb: "Machines and instruments, most of them made of the same brass." },
  { name: "The Reading Room", icon: "📚", edge: "#c4548c",
    blurb: "Letters and numbers. No pictures to lean on — you have to say them." },
];

// cols is capped at 6 so a board still reads on a phone held upright.
//
// `time` is the greater of what the bot measured and a flat human floor of
// (4s a pair + 15s). The bot thinks in 0.68s and never fumbles a tap; a child
// meeting a board for the first time does neither, and on the small early halls
// the measured figure is absurdly tight — ten seconds for three pairs. The
// clock is meant to make the last few pairs tense, not to be the thing that
// beats you, so where the two disagree the human floor wins.
//
// `par` and `ace` are the opposite: those come straight off the bots and are
// deliberately tight, because misses are the only thing in this game that is
// actually memory. ace < par always — starsFor tests ace first, so an ace at or
// above par empties the two-star band entirely.
const HALLS = [
  // --- The Front Hall ------------------------------------------------------
  { wing: 0, name: "The Doorstep",    pack: "creatures", cols: 3, rows: 2, peek: 3.0, time: 30,  par: 1,  ace: 0 },
  { wing: 0, name: "Coat Hooks",      pack: "creatures", cols: 4, rows: 2, peek: 2.5, time: 35,  par: 1,  ace: 0 },
  { wing: 0, name: "The Hall Table",  pack: "orchard",   cols: 4, rows: 3, peek: 2.2, time: 40,  par: 2,  ace: 1 },
  { wing: 0, name: "Under the Stair", pack: "creatures", cols: 4, rows: 4, peek: 1.8, time: 50,  par: 3,  ace: 2 },
  { wing: 0, name: "The Big Drawer",  pack: "orchard",   cols: 5, rows: 4, peek: 1.6, time: 55,  par: 4,  ace: 3 },

  // --- The Long Gallery ----------------------------------------------------
  { wing: 1, name: "First Alcove",    pack: "reef",      cols: 4, rows: 3, peek: 1.6, time: 40,  par: 2,  ace: 1 },
  { wing: 1, name: "The Shell Case",  pack: "reef",      cols: 4, rows: 4, peek: 1.5, time: 50,  par: 3,  ace: 2 },
  { wing: 1, name: "Pressed Flowers", pack: "garden",    cols: 5, rows: 4, peek: 1.4, time: 55,  par: 5,  ace: 4 },
  { wing: 1, name: "The Bug Trays",   pack: "garden",    cols: 6, rows: 4, peek: 1.3, time: 65,  par: 6,  ace: 5 },
  { wing: 1, name: "The Long Wall",   pack: "reef",      cols: 5, rows: 6, peek: 1.2, time: 75,  par: 15, ace: 8 },

  // --- The Star Room -------------------------------------------------------
  { wing: 2, name: "The Orrery",      pack: "blastoff",  cols: 4, rows: 4, peek: 1.2, time: 50,  par: 3,  ace: 2 },
  { wing: 2, name: "Cloud Charts",    pack: "weather",   cols: 5, rows: 4, peek: 1.2, time: 55,  par: 5,  ace: 4 },
  { wing: 2, name: "The Meteor Case", pack: "blastoff",  cols: 6, rows: 4, peek: 1.1, time: 65,  par: 8,  ace: 6 },
  { wing: 2, name: "Barometers",      pack: "weather",   cols: 5, rows: 6, peek: 1.0, time: 75,  par: 15, ace: 8 },
  { wing: 2, name: "The Whole Sky",   pack: "blastoff",  cols: 6, rows: 6, peek: 1.0, time: 90,  par: 18, ace: 10 },

  // --- The Workshop --------------------------------------------------------
  { wing: 3, name: "The Tool Rack",   pack: "wheels",    cols: 5, rows: 4, peek: 1.0, time: 55,  par: 5,  ace: 4 },
  { wing: 3, name: "Brass Section",   pack: "band",      cols: 6, rows: 4, peek: 1.0, time: 65,  par: 8,  ace: 6 },
  { wing: 3, name: "The Engine Shed", pack: "wheels",    cols: 5, rows: 6, peek: 0.9, time: 75,  par: 13, ace: 8 },
  { wing: 3, name: "Practice Room",   pack: "band",      cols: 6, rows: 6, peek: 0.9, time: 95,  par: 18, ace: 10 },
  { wing: 3, name: "The Whole Fleet", pack: "wheels",    cols: 6, rows: 7, peek: 0.8, time: 120, par: 27, ace: 14 },

  // --- The Reading Room ----------------------------------------------------
  { wing: 4, name: "First Lesson",    pack: "numbers",   cols: 5, rows: 4, peek: 0.8, time: 55,  par: 6,  ace: 5 },
  { wing: 4, name: "The Index",       pack: "letters",   cols: 6, rows: 4, peek: 0.8, time: 65,  par: 8,  ace: 6 },
  { wing: 4, name: "Ledgers",         pack: "numbers",   cols: 5, rows: 6, peek: 0.7, time: 75,  par: 12, ace: 9 },
  { wing: 4, name: "The Card Index",  pack: "letters",   cols: 6, rows: 6, peek: 0.7, time: 90,  par: 20, ace: 11 },
  { wing: 4, name: "Everything",      pack: "letters",   cols: 6, rows: 8, peek: 0.6, time: 180, par: 38, ace: 19 },
];

/* -------------------------------------------------------- time attack -- */
// The reference game's mode, and the one the family leaderboard runs on. The
// clock starts at 30 seconds and only ever goes down; every pair buys a few
// back and clearing a board buys five more, then a bigger board is dealt. It
// ends because the boards outgrow the bonus, not because of a timer you were
// told about.
//
// PAIR_BONUS is the whole tuning of the mode. It is set from tools/calibrate.js
// against bots of three different memory spans, so a good player goes deeper
// than a poor one by a margin you can feel without the mode becoming endless.

const ATTACK = {
  start: 30,
  pairBonus: 1.4,     // seconds returned per pair found
  clearBonus: 5,      // seconds for emptying a board
  peek: 1.0,          // every attack board gets the same brief look
  // The board dealt at each stage. Past the end of the list it stays at the
  // last size, so a very strong run is limited by the clock and not by a wall.
  ladder: [
    { cols: 3, rows: 2, pack: "creatures" },
    { cols: 4, rows: 2, pack: "orchard" },
    { cols: 4, rows: 3, pack: "reef" },
    { cols: 4, rows: 4, pack: "garden" },
    { cols: 5, rows: 4, pack: "blastoff" },
    { cols: 6, rows: 4, pack: "wheels" },
    { cols: 5, rows: 6, pack: "weather" },
    { cols: 6, rows: 6, pack: "band" },
    { cols: 6, rows: 7, pack: "numbers" },
    { cols: 6, rows: 8, pack: "letters" },
  ],
  stageAt(n) { return this.ladder[Math.min(n, this.ladder.length - 1)]; },
};

/* --------------------------------------------------------------- duel -- */
// Two players, one device, taking turns. A match means you go again — which is
// the rule that makes the game tense, because a lucky third flip can run the
// whole board. No clock: this is the mode you play with somebody at the table,
// and rushing them is not the point. It never touches the leaderboard.

const DUEL_BOARDS = [
  { id: "small",  name: "Quick Game", icon: "⚡", cols: 4, rows: 3, pack: "creatures" },
  { id: "medium", name: "Proper Game", icon: "🪑", cols: 5, rows: 4, pack: "orchard" },
  { id: "big",    name: "Long Game", icon: "🕰️", cols: 6, rows: 6, pack: "reef" },
  { id: "huge",   name: "The Lot", icon: "🏛️", cols: 6, rows: 8, pack: "letters" },
];

/* -------------------------------------------------------------- stars -- */
// Stars come from MISSES, never from the clock. The clock decides whether you
// finished at all; how well you finished is how few times you turned two cards
// that did not go together, which is the only thing in the game that is
// actually memory.

function starsFor(hall, misses, cleared) {
  if (!cleared) return 0;
  if (misses <= hall.ace) return 3;
  if (misses <= hall.par) return 2;
  return 1;
}

function pairsOf(h) { return (h.cols * h.rows) / 2; }

if (typeof module !== "undefined") {
  module.exports = { WINGS, HALLS, ATTACK, DUEL_BOARDS, starsFor, pairsOf };
}
