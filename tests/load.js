// Shared loader for the test suites.
//
// The game ships plain <script> files with top-level `const` and no bundler, so
// the suites run the real sources in a vm sandbox. Order must match index.html's,
// or a file that reads another's top-level const crashes on load.
//
// render.js and main.js are deliberately absent: everything asserted on here is
// engine or data, and leaving the drawing out is what keeps game.js honest about
// not touching the DOM. `App` is left undefined too — game.js guards its one
// call out with `typeof App !== "undefined"`, so if that guard is ever dropped
// the suite fails loudly rather than the browser doing it later.

const path = require("node:path");
const { loadScripts } = require("../lib/tools/test-harness.js");

const ROOT = path.join(__dirname, "..");

const S = loadScripts({
  baseDir: ROOT,
  files: [
    "lib/gk-util.js",
    "js/rng.js",
    "js/packs.js",
    "js/halls.js",
    "js/game.js",
  ],
  exports: [
    "GK", "RNG",
    "MAX_PAIRS", "PLAQUES", "PACKS", "PACK_BY_ID", "THEMES", "THEME_BY_ID", "themesFor",
    "WINGS", "HALLS", "ATTACK", "DUEL_BOARDS", "starsFor", "pairsOf",
    "Game", "dealBoard", "MISS_MS", "MATCH_MS",
  ],
  browser: true,
});

module.exports = S;
