// Sounds, layered on gamekit's defaults. All synthesized — nothing to load,
// nothing to cache, works offline.
//
// The palette is wooden and warm rather than arcade, because this game is
// hundreds of taps in a row and a bright blip becomes unbearable by the third
// hall. The one rule that matters: a MISS must not sound like a punishment.
// Turning two cards that do not match is not a mistake, it is how you find out
// what is there — so a miss gets a soft wooden knock and the celebration is
// saved entirely for the match.

const Sfx = GK.Sfx;

Object.assign(Sfx, {
  // A card turning over: a short woody tick, pitched slightly by position so a
  // run of flips does not sound mechanical.
  flip(i = 0) {
    this.tone({ freq: 430 + (i % 7) * 18, type: "triangle", dur: 0.045, vol: 0.08 });
    this.noise({ dur: 0.035, vol: 0.035 });
  },

  // Two that go together: a rising third, brighter the longer your run.
  match(streak = 0) {
    const s = Math.min(6, streak);
    const base = 523 * Math.pow(2, s / 12);
    [base, base * 1.26, base * 1.5].forEach((f, i) =>
      this.tone({ freq: f, type: "triangle", dur: 0.16, vol: 0.15, when: i * 0.055 }));
  },

  // Two that do not: a soft double knock. Deliberately dull, never sour.
  miss() {
    this.tone({ freq: 240, type: "sine", dur: 0.07, vol: 0.07 });
    this.tone({ freq: 200, type: "sine", dur: 0.09, vol: 0.06, when: 0.075 });
  },

  // The whole board flashing up before the clock starts.
  peek() {
    [660, 880, 1100].forEach((f, i) =>
      this.tone({ freq: f, type: "sine", dur: 0.09, vol: 0.09, when: i * 0.045 }));
  },

  // Board emptied.
  clearBoard() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => this.tone({ freq: f, type: "triangle", dur: 0.26, vol: 0.17, when: i * 0.1 }));
    notes.forEach((f, i) => this.tone({ freq: f / 2, type: "sine", dur: 0.3, vol: 0.09, when: i * 0.1 }));
  },

  // Time Attack: a bigger cabinet is wheeled in.
  nextStage() {
    [392, 523, 659, 880].forEach((f, i) =>
      this.tone({ freq: f, type: "square", dur: 0.11, vol: 0.11, when: i * 0.08, slide: 40 }));
  },

  // The last ten seconds. One per second, climbing, so the panic is audible
  // without a countdown you have to look at.
  tick(left) {
    const urgency = Math.max(0, Math.min(1, (10 - left) / 10));
    this.tone({ freq: 700 + urgency * 420, type: "square", dur: 0.05, vol: 0.06 + urgency * 0.06 });
  },

  timeUp() {
    this.tone({ freq: 300, type: "sawtooth", dur: 0.5, vol: 0.16, slide: -170 });
    this.noise({ dur: 0.4, vol: 0.09, when: 0.1 });
  },

  star(n = 1) { this.tone({ freq: 640 + n * 210, type: "triangle", dur: 0.22, vol: 0.2, slide: 170 }); },

  newBest() {
    [784, 988, 1175, 1568].forEach((f, i) =>
      this.tone({ freq: f, type: "square", dur: 0.13, vol: 0.13, when: i * 0.1 }));
  },

  // Duel: the turn passing across the table.
  handOver() {
    this.tone({ freq: 520, type: "sine", dur: 0.09, vol: 0.09, slide: -110 });
  },
});
