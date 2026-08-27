// App shell — splash, roster, the hall map, Time Attack, the two-player game,
// results, the cabinet themes and the family leaderboard. Profiles, PINs, sync
// and install all come from gamekit; this file only decides what goes on each
// screen.

const AVATARS = ["🦊", "🐼", "🦉", "🐙", "🚀", "🐝", "🎺", "🍓", "🐬", "🦄", "🐨", "🐸"];

const App = {
  profile: null,

  el(id) { return document.getElementById(id); },

  init() {
    Sfx.enabled = Storage.getSettings().sound !== false;

    GK.UI.onScreenChange = (name) => {
      if (name !== "game") Render.stop();
      if (name === "splash") this.refreshSplash();
    };
    GK.UI.bindSoundToggle(Storage);
    GK.UI.bindMenuClicks();

    GK.Profiles.init({
      storage: Storage,
      avatars: AVATARS,
      meta: (p, prog) =>
        `⭐ ${Storage.totalStars(prog)}/${HALLS.length * 3} · 🚪 ${Storage.cleared(prog)}/${HALLS.length} · ⏱ ${prog.attackBest || 0}`,
      onEnter: (p) => { this.profile = p; this.showMap(); },
      addLabel: "New Player",
    });

    GK.initPWA({ appName: "Curio Cabinet" });
    Render.boot();

    GK.Debug.init({ storage: Storage, title: "CURIO CABINET" })
      .jump("hall", HALLS.length, (n) => this.startHall(n - 1))
      .action("clear the board", () => {
        if (!Game.running()) return;
        while (Game.pairsFound < Game.pairs && Game.state === "play") {
          const p = Game.pairOf.findIndex((_, i) => Game.face[i] === 0);
          const pair = [];
          for (let i = 0; i < Game.n; i++) if (Game.pairOf[i] === Game.pairOf[p]) pair.push(i);
          Game.tap(pair[0]); Game.tap(pair[1]);
        }
      });

    this.showScreen("splash");
    Storage.initFirebase().then((ok) => {
      this.el("sync-badge").textContent = ok ? "☁️ family sync on" : "📴 offline";
      if (!ok) return;
      if (GK.UI.screen === "profiles") GK.Profiles.renderList();
      if (GK.UI.screen === "splash") this.refreshSplash();
      if (GK.UI.screen === "map") this.showMap();
      if (GK.UI.screen === "leaderboard") this.showLeaderboard(true);
    });
  },

  showScreen(name) { GK.UI.showScreen(name); },
  progress() { return Storage.getProgress(this.profile.id); },

  /* ------------------------------------------------------------- splash -- */

  refreshSplash() {
    const last = GK.Profiles.lastProfile();
    const cont = this.el("btn-continue-as"), start = this.el("btn-start");
    if (last) {
      cont.style.display = "";
      cont.textContent = `🗝️ Continue as ${last.avatar} ${last.name}`;
      cont.onclick = () => { Sfx.init(); GK.Profiles.select(last); };
      start.className = "btn ghost";
      start.textContent = "👥 Switch Player";
    } else {
      cont.style.display = "none";
      start.className = "btn big green";
      start.textContent = "🗝️ Open the Cabinet";
    }
  },

  play() {
    Sfx.init(); Sfx.click();
    GK.Profiles.renderList();
    this.showScreen("profiles");
  },

  howTo() { Sfx.click(); GK.UI.openModal("modal-howto"); },

  /* ---------------------------------------------------------------- map -- */

  showMap() {
    if (!this.profile) return this.play();
    const prog = this.progress();
    const unlocked = Storage.unlocked(prog);
    const stars = Storage.totalStars(prog);
    Render.setTheme(Storage.theme(prog));

    this.el("map-player").innerHTML = `${this.profile.avatar} <b>${GK.util.esc(this.profile.name)}</b>`;
    this.el("map-stars").textContent = `⭐ ${stars}`;

    const cont = this.el("btn-continue");
    const done = Storage.campaignDone(prog);
    cont.textContent = done ? `🗝️ ${HALLS[unlocked].name} again` : `🗝️ ${HALLS[unlocked].name}`;
    cont.onclick = () => this.startHall(unlocked);

    this.el("btn-attack").textContent = prog.attackBest ? `⏱ Time Attack · ${prog.attackBest}` : "⏱ Time Attack";

    this.el("hall-list").innerHTML = WINGS.map((wing, wi) => {
      const cells = HALLS.map((h, i) => ({ h, i })).filter((e) => e.h.wing === wi).map(({ h, i }) => {
        const rec = prog.halls && prog.halls[i];
        const open = i <= unlocked;
        const st = rec ? rec.stars : 0;
        const pack = PACK_BY_ID[h.pack];
        return `<button class="hall${open ? "" : " locked"}${i === unlocked && !done ? " next" : ""}"
          ${open ? `onclick="App.startHall(${i})"` : "disabled"}
          aria-label="${open ? `Hall ${i + 1}, ${GK.util.esc(h.name)}, ${st} of 3 stars` : `Hall ${i + 1}, locked`}">
          <span class="hl-n">${open ? i + 1 : "🔒"}</span>
          <span class="hl-name">${open ? GK.util.esc(h.name) : "???"}</span>
          <span class="hl-size">${open ? `${pack.icon} ${(h.cols * h.rows) / 2} pairs` : ""}</span>
          <span class="hl-stars">${open ? "★".repeat(st) + "☆".repeat(3 - st) : ""}</span>
        </button>`;
      }).join("");
      return `<section class="wing" style="--wc:${wing.edge}">
        <h3>${wing.icon} ${GK.util.esc(wing.name)}</h3>
        <p class="wing-blurb">${GK.util.esc(wing.blurb)}</p>
        <div class="hall-grid">${cells}</div>
      </section>`;
    }).join("");

    this.showScreen("map");
  },

  /* --------------------------------------------------------------- play -- */

  enterGame(title, sub) {
    this.el("hud-title").textContent = title;
    const s = this.el("game-sub");
    s.textContent = sub || "";
    this.el("duel-turn").style.display = Game.mode === "duel" ? "" : "none";
    this.showScreen("game");
    // The stage measures 0×0 while the screen is hidden, so this has to run
    // after showScreen, not before it.
    Render.resize();
    Render.resetAnim();
    Render.boardKey = `${Game.stage}|${Game.n}|${Game.packId}`;
    Render.laidOut = `${Game.cols}x${Game.rows}`;
    Render.layout();
    Render.start();
  },

  startHall(idx) {
    Sfx.init(); Sfx.click();
    const h = HALLS[idx];
    Render.setTheme(Storage.theme(this.progress()));
    Game.start({ mode: "hall", hallIdx: idx, seed: Date.now() ^ (idx * 7919) });
    this.enterGame(`${idx + 1}. ${h.name}`, `${PACK_BY_ID[h.pack].name} · ${(h.cols * h.rows) / 2} pairs · ${h.par} misses for ★★`);
  },

  startAttack() {
    Sfx.init(); Sfx.click();
    Render.setTheme(Storage.theme(this.progress()));
    Game.start({ mode: "attack", seed: Date.now() >>> 0 });
    this.enterGame("⏱ Time Attack", `Every pair buys ${ATTACK.pairBonus}s back. Clear the board for ${ATTACK.clearBonus}s more.`);
  },

  /* --------------------------------------------------------------- duel -- */

  showDuel() {
    Sfx.click();
    this.el("duel-list").innerHTML = DUEL_BOARDS.map((d) => `
      <button class="size-card" onclick="App.startDuel('${d.id}')"
        aria-label="${GK.util.esc(d.name)}, ${d.cols} by ${d.rows}">
        <span class="size-icon">${d.icon}</span>
        <span class="size-info">
          <span class="size-name">${GK.util.esc(d.name)}</span>
          <span class="size-meta">${(d.cols * d.rows) / 2} pairs · ${PACK_BY_ID[d.pack].name}</span>
        </span>
        <span class="size-best">${d.cols}×${d.rows}</span>
      </button>`).join("");
    this.showScreen("duel");
  },

  startDuel(id) {
    Sfx.init(); Sfx.click();
    const d = DUEL_BOARDS.find((x) => x.id === id);
    const other = (this.el("duel-name").value || "").trim().slice(0, 12) || "Challenger";
    Render.setTheme(Storage.theme(this.progress()));
    Game.start({ mode: "duel", boardId: id, seed: Date.now() >>> 0, names: [this.profile.name, other] });
    this.enterGame(`👥 ${d.name}`, "A match means you go again. A miss hands over.");
  },

  /* ------------------------------------------------------------ in-game -- */

  pause() {
    if (!Game.running()) return;
    Game.paused = true;
    Sfx.click();
    GK.UI.openModal("modal-pause");
  },

  resume() { Game.paused = false; GK.UI.closeModal("modal-pause"); Sfx.click(); },

  restart() {
    GK.UI.closeModal("modal-pause");
    Game.paused = false;
    if (Game.mode === "attack") this.startAttack();
    else if (Game.mode === "duel") this.startDuel(Game.boardId);
    else this.startHall(Game.hallIdx);
  },

  quitGame() {
    GK.UI.closeModal("modal-pause");
    Game.paused = false;
    Game.quit();
  },

  /* ------------------------------------------------------------ results -- */

  // Called by the engine. `null` means the player walked out rather than
  // finished, so there is nothing to record and nothing to show.
  gameOver(res) {
    if (!res) { Render.stop(); this.showMap(); return; }
    if (res.cleared) Sfx.clearBoard(); else if (res.mode !== "duel") Sfx.timeUp();
    // Leave the board up for a moment so the last card is actually seen,
    // rather than being replaced by a results card mid-flip.
    setTimeout(() => this.showResults(res), res.cleared ? 950 : 900);
  },

  showResults(res) {
    Render.stop();
    let prog;
    if (res.mode === "hall") prog = Storage.recordHall(this.profile.id, res);
    else if (res.mode === "attack") prog = Storage.recordAttack(this.profile.id, res);
    else prog = Storage.recordDuel(this.profile.id, res);

    const emoji = this.el("res-emoji"), title = this.el("res-title");
    const stars = this.el("res-stars"), score = this.el("res-score");
    const note = this.el("res-note"), retry = this.el("res-retry"), next = this.el("res-next");
    retry.style.display = "none"; next.style.display = "none";
    this.el("res-finished").style.display = "none";
    stars.textContent = ""; note.textContent = "";

    if (res.mode === "hall") {
      const h = HALLS[res.hallIdx];
      emoji.textContent = res.cleared ? (res.stars === 3 ? "🏆" : "🗝️") : "⏳";
      title.textContent = res.cleared ? "Drawer cleared" : "Out of time";
      stars.textContent = "★".repeat(res.stars) + "☆".repeat(3 - res.stars);
      score.textContent = res.cleared ? Render.time(res.time) : `${res.found}/${res.pairs} pairs`;
      this.el("res-stats").innerHTML = [
        `✗ ${res.misses} misses`, `🎯 ${h.par} for ★★`, `🏅 ${h.ace} for ★★★`,
        res.cleared ? `⏱ ${res.timeLeft}s left` : `⏱ ran out`,
      ].map((b) => `<div>${b}</div>`).join("");

      if (!res.cleared) {
        note.textContent = "The cards do not move between goes — only what you remember does. Have another look.";
      } else if (res.stars === 1) {
        note.textContent = `Cleared. Do it in ${h.par} misses or fewer for the second star.`;
      } else if (res.stars === 2) {
        note.textContent = `Two stars. ${h.ace} misses or fewer takes the third.`;
      } else {
        note.textContent = "Three stars. Nothing turned over twice for nothing.";
      }

      retry.style.display = ""; retry.textContent = "↻ Same hall";
      retry.onclick = () => this.startHall(res.hallIdx);
      const n = res.hallIdx + 1;
      if (res.cleared && n < HALLS.length) {
        next.style.display = ""; next.textContent = `▶️ ${HALLS[n].name}`;
        next.onclick = () => this.startHall(n);
      }
      if (res.cleared && n >= HALLS.length) this.el("res-finished").style.display = "";
      for (let i = 0; i < res.stars; i++) setTimeout(() => Sfx.star(i + 1), 320 + i * 240);
      this.announceThemes(prog);

    } else if (res.mode === "attack") {
      const best = prog.attackBest === res.score && res.score > 0;
      emoji.textContent = "⏱";
      title.textContent = "Time up";
      score.textContent = `${res.score} pairs`;
      this.el("res-stats").innerHTML = [
        `🗄️ ${res.boards} boards cleared`, `✗ ${res.misses} misses`,
        `⏳ ${Render.time(res.time)} on the clock`, `🏆 best ${prog.attackBest}`,
      ].map((b) => `<div>${b}</div>`).join("");
      note.textContent = best
        ? "A new best — that goes on the family board."
        : `Your best is ${prog.attackBest}. The clock only ever goes down, so the pairs have to come faster than the boards grow.`;
      if (best) setTimeout(() => Sfx.newBest(), 320);
      retry.style.display = ""; retry.textContent = "↻ Again";
      retry.onclick = () => this.startAttack();
      next.style.display = ""; next.textContent = "🏆 Leaderboard";
      next.onclick = () => this.showLeaderboard();

    } else {
      const w = res.winner;
      emoji.textContent = w < 0 ? "🤝" : "🏆";
      title.textContent = w < 0 ? "A draw" : `${GK.util.esc(res.names[w])} wins`;
      score.textContent = `${res.scores[0]} – ${res.scores[1]}`;
      this.el("res-stats").innerHTML = [
        `🔵 ${GK.util.esc(res.names[0])}: ${res.scores[0]}`,
        `🔴 ${GK.util.esc(res.names[1])}: ${res.scores[1]}`,
        `⏱ ${Render.time(res.time)}`, `✗ ${res.misses} misses between you`,
      ].map((b) => `<div>${b}</div>`).join("");
      note.textContent = "Two-player games stay between the two of you — they never touch the family board.";
      retry.style.display = ""; retry.textContent = "↻ Again";
      retry.onclick = () => this.startDuel(res.boardId);
    }

    this.showScreen("results");
  },

  // A theme unlocking is the only thing stars buy, so say so the moment it
  // happens rather than leaving it to be discovered in a menu.
  announceThemes(prog) {
    const now = themesFor(Storage.totalStars(prog)).length;
    if (now <= (prog.themesSeen || 1)) return;
    prog.themesSeen = now;                       // monotonic, so it merges by max()
    Storage.saveProgress(this.profile.id, prog);
    const t = THEMES[now - 1];
    setTimeout(() => GK.UI.toast(`${t.icon} ${t.name} unlocked — change it in the Cabinet`), 1400);
  },

  /* ------------------------------------------------------------ cabinet -- */

  showCabinet() {
    Sfx.click();
    const prog = this.progress();
    const stars = Storage.totalStars(prog);
    const cur = Storage.theme(prog).id;
    this.el("theme-list").innerHTML = THEMES.map((t) => {
      const open = stars >= t.stars;
      return `<button class="theme${open ? "" : " locked"}${t.id === cur ? " on" : ""}"
        ${open ? `onclick="App.pickTheme('${t.id}')"` : "disabled"}
        aria-label="${GK.util.esc(t.name)}${open ? (t.id === cur ? ", in use" : "") : `, locked, needs ${t.stars} stars`}">
        <span class="th-swatch" aria-hidden="true" style="background:${t.felt};border-color:${t.rim}">
          <span class="th-card" style="background:${t.back};color:${t.backInk}">◆</span>
        </span>
        <span class="th-info">
          <span class="th-name">${t.icon} ${GK.util.esc(t.name)}${t.id === cur ? " ✓" : ""}</span>
          <span class="th-blurb">${open ? GK.util.esc(t.blurb) : `🔒 ${t.stars} stars — you have ${stars}`}</span>
        </span>
      </button>`;
    }).join("");
    this.showScreen("cabinet");
  },

  pickTheme(id) {
    Sfx.coin();
    const prog = Storage.setTheme(this.profile.id, id);
    Render.setTheme(Storage.theme(prog));
    this.showCabinet();
  },

  /* -------------------------------------------------------- leaderboard -- */

  showLeaderboard(silent) {
    if (!silent) Sfx.click();
    GK.Profiles.renderLeaderboard("lb-rows", {
      cols: (r) => `<span class="lb-stat">⏱ ${r.progress.attackBest || 0}</span>
        <span class="lb-stat">⭐ ${Storage.totalStars(r.progress)}</span>`,
      sort: (a, b) => (b.progress.attackBest || 0) - (a.progress.attackBest || 0)
        || Storage.totalStars(b.progress) - Storage.totalStars(a.progress),
      meId: this.profile?.id,
      empty: "Nobody has opened a drawer yet — tap Time Attack!",
    });
    this.showScreen("leaderboard");
  },
};

// Pinch zoom sticks forever on iOS once it happens, and there is no way to
// reset it from script — so it has to be blocked at the source.
document.addEventListener("gesturestart", (e) => e.preventDefault());
document.addEventListener("gesturechange", (e) => e.preventDefault());

// Run init on DOMContentLoaded rather than inline at the bottom of <body>:
// rendering the first screen before layout settles resolves viewport-relative
// clamp() font sizes against the inherited value on that one render.
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => App.init());
else App.init();
