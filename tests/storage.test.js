// The progress merge — the one function in the game that can permanently
// destroy a save. Two devices reconcile through it, and it runs unsupervised.
//
// Every assertion is made in BOTH argument orders, because which device syncs
// first is a coin toss and an order-dependent merge is a coin toss over the
// player's progress.

const test = require("node:test");
const assert = require("node:assert");
const path = require("node:path");
const { loadScripts } = require("../lib/tools/test-harness.js");

const ROOT = path.join(__dirname, "..");

const { PROGRESS, Storage, HALLS, THEMES } = loadScripts({
  baseDir: ROOT,
  files: [
    "lib/gk-util.js",
    "lib/gk-audio.js",
    "lib/gk-storage.js",
    "js/packs.js",
    "js/halls.js",
    "tests/fake-firebase.js",
    "js/storage.js",
  ],
  exports: ["PROGRESS", "Storage", "HALLS", "THEMES"],
  browser: true,
});

const blank = () => PROGRESS.blank();
// Assert a property holds whichever way round the two saves arrive.
const bothWays = (a, b, check) => { check(PROGRESS.merge(a, b)); check(PROGRESS.merge(b, a)); };

test("a blank save has every field the game reads", () => {
  const p = blank();
  for (const k of ["halls", "attackBest", "attackDeepest", "attackRuns", "duels", "hallsPlayed", "pairsFound", "theme", "updated"]) {
    assert.ok(k in p, `blankProgress is missing ${k}`);
  }
  assert.deepStrictEqual({ ...p.halls }, {});
  assert.strictEqual(p.theme, THEMES[0].id, "a new player must start with the free theme");
});

test("merging keeps the better result for each hall", () => {
  const phone = { ...blank(), halls: { 0: { stars: 3, misses: 1, time: 12.4 }, 1: { stars: 1, misses: 9, time: 40 } } };
  const pad = { ...blank(), halls: { 1: { stars: 3, misses: 2, time: 55 }, 2: { stars: 2, misses: 4, time: 30 } } };
  bothWays(phone, pad, (m) => {
    assert.strictEqual(m.halls[0].stars, 3);
    assert.strictEqual(m.halls[1].stars, 3, "the better grade was lost");
    assert.strictEqual(m.halls[1].misses, 2, "the cleaner run was lost");
    assert.strictEqual(m.halls[1].time, 40, "the quicker time was lost");
    assert.strictEqual(m.halls[2].stars, 2, "a hall only one device knew about vanished");
  });
});

test("a hall cleared on one device is never un-cleared by the other", () => {
  const played = { ...blank(), halls: { 5: { stars: 2, misses: 3, time: 20 } } };
  bothWays(played, blank(), (m) => {
    assert.ok(m.halls[5], "a fresh device wiped a cleared hall");
    assert.strictEqual(Storage.unlocked(m), 6, "progress went backwards");
  });
});

test("Time Attack keeps the best score, never the latest", () => {
  const good = { ...blank(), attackBest: 91, attackDeepest: 9, attackRuns: 12, pairsFound: 400 };
  const poor = { ...blank(), attackBest: 14, attackDeepest: 3, attackRuns: 3, pairsFound: 60 };
  bothWays(good, poor, (m) => {
    assert.strictEqual(m.attackBest, 91);
    assert.strictEqual(m.attackDeepest, 9);
    assert.strictEqual(m.attackRuns, 12);
    assert.strictEqual(m.pairsFound, 400);
  });
});

// A preference is the one thing here that legitimately goes "backwards", so it
// cannot be max()-merged — but it must still land on the same answer whichever
// device syncs first, or the cabinet changes colour at random.
test("the chosen theme goes to the later choice, and does so symmetrically", () => {
  const older = { ...blank(), theme: "oak", updated: 1000 };
  const newer = { ...blank(), theme: "reef", updated: 2000 };
  assert.strictEqual(PROGRESS.merge(older, newer).theme, "reef");
  assert.strictEqual(PROGRESS.merge(newer, older).theme, "reef", "the merge is order-dependent");
  assert.strictEqual(PROGRESS.merge(older, newer).updated, 2000);
});

test("a field a newer build added survives an older client's merge", () => {
  const future = { ...blank(), somethingNew: 42 };
  bothWays(future, blank(), (m) => assert.strictEqual(m.somethingNew, 42));
});

test("merging is idempotent — syncing twice changes nothing", () => {
  const a = { ...blank(), halls: { 0: { stars: 2, misses: 4, time: 18 } }, attackBest: 30, updated: 5 };
  const once = PROGRESS.merge(a, blank());
  const twice = PROGRESS.merge(once, blank());
  assert.deepStrictEqual(JSON.parse(JSON.stringify(twice)), JSON.parse(JSON.stringify(once)));
});

/* --------------------------------------------------------- derived views -- */

test("stars, unlocks and theme gating agree with each other", () => {
  const p = blank();
  assert.strictEqual(Storage.totalStars(p), 0);
  assert.strictEqual(Storage.unlocked(p), 0, "a new player must be able to start hall 1");
  assert.strictEqual(Storage.theme(p).id, THEMES[0].id);

  for (let i = 0; i < HALLS.length; i++) p.halls[i] = { stars: 3, misses: 0, time: 10 };
  assert.strictEqual(Storage.totalStars(p), HALLS.length * 3);
  assert.ok(Storage.campaignDone(p));
  assert.strictEqual(Storage.unlocked(p), HALLS.length - 1, "unlocked must stay inside the campaign");
});

test("a theme the save is no longer entitled to falls back rather than breaking the board", () => {
  // Reachable for real: a device syncs in a wiped save while the locally chosen
  // theme is one that needed 56 stars.
  const locked = THEMES[THEMES.length - 1];
  const p = { ...blank(), theme: locked.id };
  assert.ok(locked.stars > 0);
  assert.strictEqual(Storage.theme(p).id, THEMES[0].id, "an unaffordable theme was handed to the renderer");

  for (let i = 0; i < HALLS.length; i++) p.halls[i] = { stars: 3, misses: 0, time: 10 };
  assert.strictEqual(Storage.theme(p).id, locked.id, "a fully earned theme was refused");
});
