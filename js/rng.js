// Seeded RNG. The only source of randomness in the whole game is the deal, so
// a board is entirely described by {cols, rows, packId, seed} — which is what
// lets the bots replay the campaign byte-exactly and a changed clear time
// always mean a real balance change rather than a lucky shuffle.

const RNG = {
  // xmur3 — string to a well-mixed 32-bit seed.
  seedFrom(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return (h ^ (h >>> 16)) >>> 0;
  },

  // mulberry32 — small, fast, and identical on every device, which matters
  // because two people comparing Time Attack scores must be shuffling the
  // same way.
  make(seed) {
    let a = (seed >>> 0) || 1;
    const r = {
      next() {
        a |= 0; a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      },
      int(lo, hi) { return lo + Math.floor(r.next() * (hi - lo + 1)); },
      // Fisher-Yates, in place, returning the same array.
      shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
          const j = r.int(0, i);
          const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
        }
        return arr;
      },
    };
    return r;
  },

  // A stream keyed on WHERE it is used rather than on a running counter, so
  // adding a call in one place cannot shift every later deal. Time Attack's
  // stage 7 board is the same board whether you reached it in one run or ten.
  sub(seed, ...parts) { return this.make(this.seedFrom(String(seed) + "|" + parts.join("|"))); },

  today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  },
};

if (typeof module !== "undefined") module.exports = { RNG };
