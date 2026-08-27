// Persistence — gamekit storage configured for Curio Cabinet.
// cur_* localStorage keys, "curiocabinet" Firestore collection.
//
// Every number here is monotonic, so the cross-device merge is a boring
// "keep the better of the two": more stars, fewer misses, a quicker clear, a
// deeper Time Attack. There is no spendable currency anywhere in the game —
// the only thing to collect is stars, and the only thing they buy is a cabinet
// theme, which is cosmetic. That is deliberate: a memory game with an upgrade
// shop would give you a way to get better at it that is not remembering.
//
// The single non-monotonic field is `theme`, which is a preference rather than
// a score. Preferences cannot be max()-merged, so it goes to whichever side was
// written later — decided by `updated`, not by which device happens to sync
// first, so the merge stays order-independent.
//
// blank/merge are named before being handed to createStorage, because
// createStorage keeps them in a closure and never exposes them, and merge is
// the one function here that can permanently destroy a save.

const PROGRESS = {
  blank: () => ({
    halls: {},          // { [hallIdx]: { stars, misses, time } } — best result per hall
    attackBest: 0,      // best Time Attack score, in pairs found
    attackDeepest: 0,   // deepest board reached in Time Attack
    attackRuns: 0,
    duels: 0,
    hallsPlayed: 0,
    pairsFound: 0,      // lifetime, across every mode
    theme: "oak",
    themesSeen: 1,      // how many themes had been unlocked last time we looked
    updated: 0,
  }),

  merge: (a, b) => {
    const halls = { ...(a.halls || {}) };
    for (const [idx, r] of Object.entries(b.halls || {})) {
      const cur = halls[idx];
      if (!cur) { halls[idx] = r; continue; }
      halls[idx] = {
        stars: Math.max(cur.stars || 0, r.stars || 0),
        misses: Math.min(cur.misses ?? 1e9, r.misses ?? 1e9),
        time: Math.min(cur.time || 1e9, r.time || 1e9),
      };
    }

    const newer = (b.updated || 0) > (a.updated || 0) ? b : a;

    return {
      // Spread first so a field a newer build added survives an older client's
      // merge, then pin everything we know how to reconcile.
      ...a, ...b,
      halls,
      theme: newer.theme || a.theme || b.theme || "oak",
      attackBest: Math.max(a.attackBest || 0, b.attackBest || 0),
      attackDeepest: Math.max(a.attackDeepest || 0, b.attackDeepest || 0),
      attackRuns: Math.max(a.attackRuns || 0, b.attackRuns || 0),
      duels: Math.max(a.duels || 0, b.duels || 0),
      hallsPlayed: Math.max(a.hallsPlayed || 0, b.hallsPlayed || 0),
      pairsFound: Math.max(a.pairsFound || 0, b.pairsFound || 0),
      themesSeen: Math.max(a.themesSeen || 1, b.themesSeen || 1),
      updated: Math.max(a.updated || 0, b.updated || 0),
    };
  },
};

const Storage = GK.createStorage({
  prefix: "cur",
  collection: "curiocabinet",
  firebaseConfig: window.FIREBASE_CONFIG,
  blankProgress: PROGRESS.blank,
  mergeProgress: PROGRESS.merge,
});

Object.assign(Storage, {
  totalStars(p) {
    return Object.values(p.halls || {}).reduce((s, r) => s + (r.stars || 0), 0);
  },

  cleared(p) { return Object.keys(p.halls || {}).length; },

  // Halls open in order: the one after the deepest you have finished.
  unlocked(p) {
    let max = -1;
    for (const k of Object.keys(p.halls || {})) max = Math.max(max, Number(k));
    return Math.min(max + 1, HALLS.length - 1);
  },

  campaignDone(p) { return this.cleared(p) >= HALLS.length; },

  theme(p) {
    const t = THEME_BY_ID[p.theme];
    // A theme that is no longer unlocked (a wiped save synced in from another
    // device) must not leave the board unpaintable.
    return t && this.totalStars(p) >= t.stars ? t : THEMES[0];
  },

  setTheme(profileId, id) {
    const prog = this.getProgress(profileId);
    const t = THEME_BY_ID[id];
    if (!t || this.totalStars(prog) < t.stars) return prog;
    prog.theme = id;
    this.saveProgress(profileId, prog);
    return prog;
  },

  recordHall(profileId, res) {
    const prog = this.getProgress(profileId);
    prog.hallsPlayed = (prog.hallsPlayed || 0) + 1;
    prog.pairsFound = (prog.pairsFound || 0) + (res.found || 0);
    if (res.cleared) {
      const cur = prog.halls[res.hallIdx];
      if (!cur) prog.halls[res.hallIdx] = { stars: res.stars, misses: res.misses, time: res.time };
      else {
        cur.stars = Math.max(cur.stars || 0, res.stars);
        cur.misses = Math.min(cur.misses ?? 1e9, res.misses);
        cur.time = Math.min(cur.time || 1e9, res.time);
      }
    }
    this.saveProgress(profileId, prog);
    return prog;
  },

  recordAttack(profileId, res) {
    const prog = this.getProgress(profileId);
    prog.attackRuns = (prog.attackRuns || 0) + 1;
    prog.pairsFound = (prog.pairsFound || 0) + (res.score || 0);
    prog.attackBest = Math.max(prog.attackBest || 0, res.score || 0);
    prog.attackDeepest = Math.max(prog.attackDeepest || 0, res.stage || 0);
    this.saveProgress(profileId, prog);
    return prog;
  },

  recordDuel(profileId, res) {
    const prog = this.getProgress(profileId);
    prog.duels = (prog.duels || 0) + 1;
    prog.pairsFound = (prog.pairsFound || 0) + (res.scores || []).reduce((s, v) => s + v, 0);
    this.saveProgress(profileId, prog);
    return prog;
  },
});
