// Card packs and cabinet themes — the whole visual vocabulary of the game.
//
// A memory game is nothing but "can you tell these apart and hold them in your
// head", so the pack IS the difficulty. Three things are being varied here and
// only one of them is decoration:
//
//   1. How distinct the symbols are from each other. Twenty-four animals are
//      easy; twenty-four capital letters are genuinely hard, because a letter
//      has no picture to hang on and a child encodes it as a sound instead.
//   2. Whether the symbol has a colour of its own. Every card gets a coloured
//      plaque behind it, and when the plaques repeat across the board the
//      colour stops being a free clue and you have to remember the symbol.
//   3. Nothing else. There are no wildcards, bombs or power-ups anywhere in
//      this game. It is concentration.
//
// Every pack must carry at least MAX_PAIRS symbols (the biggest board is 6×8 =
// 24 pairs) and tests/packs.test.js fails the build if one falls short or
// repeats a symbol.

const MAX_PAIRS = 24;

// Plaque colours. Faces cycle through their pack's list by symbol index, so a
// board of 24 pairs shows every colour four times and colour alone never
// identifies a card.
const PLAQUES = {
  warm:  ["#e2703a", "#d9a441", "#c4562f", "#e08f5a", "#b9762c", "#e6b25c"],
  cool:  ["#3f7fb5", "#2f9c93", "#4a63a8", "#5aa7c8", "#356f8f", "#6d84c4"],
  fresh: ["#4f9d52", "#7cb342", "#379b7a", "#a2b93c", "#2e8b62", "#8fbf5a"],
  berry: ["#b5427c", "#8e4bb0", "#c9556a", "#a03f8f", "#d1607f", "#7d4aa0"],
  night: ["#4a4fa8", "#6a4bb0", "#3b5ea8", "#7b52b8", "#2f4d95", "#5b62c4"],
  slate: ["#5b6b7a", "#6f5f52", "#4d6470", "#7a6a5c", "#586a63", "#6b5f70"],
};

const PACKS = [
  {
    id: "creatures", name: "Creatures", icon: "🦊", kind: "glyph", plaques: PLAQUES.warm,
    blurb: "Big friendly animals — the easiest things in the world to remember.",
    symbols: ["🦊", "🐼", "🐸", "🦉", "🐨", "🦁", "🐷", "🐮", "🐔", "🦄", "🐰", "🐺",
              "🐵", "🦓", "🦒", "🐴", "🐶", "🐱", "🐭", "🐹", "🐻", "🦝", "🦔", "🐗"],
  },
  {
    id: "reef", name: "Deep Blue", icon: "🐠", kind: "glyph", plaques: PLAQUES.cool,
    blurb: "Everything that swims. Watch out — several of them are fish.",
    symbols: ["🐠", "🐙", "🦀", "🐬", "🐳", "🦈", "🐡", "🦞", "🐚", "🦑", "🐢", "🦭",
              "🪸", "🐋", "🦐", "🪼", "🐟", "🦆", "🐊", "🦦", "🐧", "🌊", "⚓", "🪝"],
  },
  {
    id: "orchard", name: "Orchard", icon: "🍓", kind: "glyph", plaques: PLAQUES.fresh,
    blurb: "Fruit and veg. Round, red and shiny is a description of about six of these.",
    symbols: ["🍓", "🍎", "🍌", "🍇", "🍊", "🍐", "🍑", "🍒", "🥝", "🍍", "🥥", "🍉",
              "🥕", "🌽", "🥦", "🍆", "🥑", "🫐", "🍋", "🍅", "🥔", "🧅", "🌶️", "🍄"],
  },
  {
    id: "blastoff", name: "Blast Off", icon: "🚀", kind: "glyph", plaques: PLAQUES.night,
    blurb: "Space. Quite a lot of it is small, round and glowing.",
    symbols: ["🚀", "🛸", "🪐", "🌍", "🌜", "⭐", "☄️", "🔭", "👽", "🛰️", "🌌", "🧑‍🚀",
              "🌑", "🌕", "🌟", "💫", "🌠", "🔋", "🧲", "⚗️", "🪨", "🎇", "🧿", "🔮"],
  },
  {
    id: "wheels", name: "Wheels", icon: "🚂", kind: "glyph", plaques: PLAQUES.slate,
    blurb: "Things that go. Half of them are red and have four wheels.",
    symbols: ["🚂", "🚌", "🚕", "🚒", "🚜", "🚑", "🏎️", "🚓", "🚐", "🛻", "🚛", "🚚",
              "🛵", "🚲", "🛴", "🚁", "✈️", "⛵", "🚤", "🛶", "🚠", "🚉", "🛺", "🚔"],
  },
  {
    id: "weather", name: "Weather", icon: "⛅", kind: "glyph", plaques: PLAQUES.cool,
    blurb: "Clouds, mostly. This one is harder than it looks.",
    symbols: ["☀️", "⛅", "☁️", "🌧️", "⛈️", "🌩️", "❄️", "☃️", "🌈", "🌪️", "🌫️", "💧",
              "🌂", "🧊", "🔥", "💨", "🌊", "⚡", "🌙", "🌤️", "🌦️", "🌡️", "🪁", "🎐"],
  },
  {
    id: "garden", name: "Bugs & Blooms", icon: "🐝", kind: "glyph", plaques: PLAQUES.fresh,
    blurb: "The garden. Lots of small things with wings and lots of flowers.",
    symbols: ["🐝", "🦋", "🐞", "🐛", "🐜", "🕷️", "🦗", "🐌", "🌻", "🌷", "🌹", "🌼",
              "🌸", "💐", "🍀", "🌿", "🍁", "🌾", "🪻", "🪷", "🌵", "🎋", "🪴", "🌱"],
  },
  {
    id: "band", name: "The Band", icon: "🎺", kind: "glyph", plaques: PLAQUES.berry,
    blurb: "Instruments. Several are brass and shaped like a curly tube.",
    symbols: ["🎺", "🎸", "🎻", "🥁", "🎹", "🪕", "🪗", "🎷", "🪘", "🔔", "📯", "🎤",
              "🎧", "📻", "🎼", "🎵", "🪈", "🔉", "🎚️", "🎛️", "📀", "🎬", "🕺", "💃"],
  },
  {
    id: "numbers", name: "Numbers", icon: "🔢", kind: "text", plaques: PLAQUES.night,
    blurb: "Just numbers. Nothing to picture, so you have to say them to yourself.",
    symbols: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12",
              "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24"],
  },
  {
    id: "letters", name: "Letters", icon: "🔤", kind: "text", plaques: PLAQUES.berry,
    blurb: "The alphabet. The hardest pack in the cabinet, and it is not close.",
    symbols: ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L",
              "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X"],
  },
];

const PACK_BY_ID = Object.fromEntries(PACKS.map((p) => [p.id, p]));

/* ------------------------------------------------------------- themes -- */
// The cabinet the cards are laid out in. Purely cosmetic — a theme changes the
// table, the card backs and the rim, and touches no number in the game. They
// unlock on total stars so there is something to collect that cannot make the
// game easier.

const THEMES = [
  {
    id: "oak", name: "Old Oak", icon: "🪵", stars: 0,
    blurb: "The cabinet as it was found: warm oak, brass fittings, green baize.",
    table: "#4b311f",
    felt: "#2f5741", feltEdge: "#24402f", grain: "#5c3d27", rim: "#c9922f",
    back: "#8d4a2a", back2: "#a85c36", backInk: "#f0d29a", pattern: "chevron",
    ink: "#2a1c10",
  },
  {
    id: "stars", name: "Night Watch", icon: "🌌", stars: 18,
    blurb: "Midnight blue, gold pinpricks, and a rim like a telescope barrel.",
    table: "#111a33", felt: "#18234a", feltEdge: "#0d1428", grain: "#1b2750", rim: "#c8b25f",
    back: "#2b3a7a", back2: "#3a4d9c", backInk: "#f2e2a0", pattern: "stars",
    ink: "#0b1122",
  },
  {
    id: "reef", name: "Rockpool", icon: "🐚", stars: 36,
    blurb: "Sea glass and wet sand, with scales stamped into every card back.",
    table: "#0f3c46", felt: "#14545c", feltEdge: "#0b333a", grain: "#166069", rim: "#6fd0c4",
    back: "#146a72", back2: "#1c8b8a", backInk: "#c7f4ea", pattern: "scale",
    ink: "#062227",
  },
  {
    id: "kraft", name: "Paper Mill", icon: "📜", stars: 56,
    blurb: "Brown paper, printer's ink and a hand-set border. Quiet and old.",
    table: "#5c4a35", felt: "#c2a982", feltEdge: "#9a8467", grain: "#6d5941", rim: "#3b2f22",
    back: "#b39469", back2: "#c8ab82", backInk: "#4a3722", pattern: "grid",
    ink: "#3a2e21",
  },
];

const THEME_BY_ID = Object.fromEntries(THEMES.map((t) => [t.id, t]));

function themesFor(stars) { return THEMES.filter((t) => stars >= t.stars); }

if (typeof module !== "undefined") {
  module.exports = { MAX_PAIRS, PLAQUES, PACKS, PACK_BY_ID, THEMES, THEME_BY_ID, themesFor };
}
