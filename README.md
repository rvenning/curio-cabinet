# Curio Cabinet 🗝️

Classic memory pairs, in a cabinet of curiosities. Turn over two drawers — if
they match they stay open, and if they do not they go back down, but you got to
see them, and that is the whole game.

**Play it:** https://rvenning.github.io/curio-cabinet/

## Features

- **25 halls across 5 wings.** Each wing starts on a *smaller* board than the
  last one finished and gets its difficulty back from the card pack instead. A
  5×4 of capital letters in the Reading Room is harder than a 6×6 of animals in
  the Long Gallery, because a letter gives you nothing to picture.
- **Ten card packs** — creatures, sea life, orchard, space, vehicles, weather,
  the garden, instruments, numbers and the alphabet. Every card gets a coloured
  plaque, and no colour ever belongs to just one pair, so the colour can never
  identify a card's partner.
- **A quick look.** Every board flashes face-up before the clock starts. It
  shrinks across the campaign and never quite reaches zero.
- **Stars come from misses, not the clock.** The clock only decides whether you
  finish; how well you finished is how few times you turned two cards that did
  not go together — which is the only thing here that is actually memory.
- **⏱ Time Attack.** The clock starts on thirty seconds. Every pair buys 1.4s
  back and clearing a board buys 5s more, then a bigger board is dealt. It ends
  because the boards outgrow the bonus, and the score is the family leaderboard.
- **👥 Two Player.** One device between two people, taking turns. Find a pair and
  you go again. No clock, and it never touches the leaderboard.
- **Four cabinet themes** unlocked by stars — Old Oak, Night Watch, Rockpool and
  Paper Mill. They change the table, the rim and the card backs, and nothing
  else. There is no shop and no upgrade: the only way to get better at this game
  is to remember better.
- Family profiles with optional PINs, a shared leaderboard, cross-device sync,
  offline play and Add to Home Screen.

## How it is built

No bundler, no framework — plain `<script>` tags.

| File | What it holds |
|---|---|
| `js/packs.js` | The ten card packs and four cabinet themes |
| `js/halls.js` | 25 halls, the Time Attack ladder, the two-player boards, the star bands |
| `js/rng.js` | Seeded shuffle — the only chance in the game |
| `js/game.js` | The engine: no DOM, no canvas, no `Math.random` |
| `js/render.js` | Canvas, the card flip, press-slide-lift input, the frame loop |
| `js/storage.js` | Progress and the cross-device merge |
| `js/main.js` | Screens and app flow |

The engine is deliberately free of rendering, the DOM and randomness, so the
whole campaign replays exactly and the balance bots in `tests/` drive the real
game rather than a model of it.

## The bots

A memory game cannot be balanced against a bot with perfect recall — give it a
complete memory and every board is trivially clearable in near the theoretical
minimum, and the time limits you derive are limits no person will ever meet. So
`tests/memory-bot.js` has a **span**: it holds the last N distinct cards it has
looked at as a strict LRU and forgets everything older. Three spans bracket the
family — 4 (a young child), 7 (Rosalie, the balance target) and 12 (a strong
adult) — and `tools/calibrate.js` sets every hall's clock and star bands from
what they actually cost.

```
npm test                       # 49 assertions: data, engine, balance, save merge
CD_REPORT=1 node --test tests/bot.test.js   # the per-hall balance table
node tools/calibrate.js        # re-derive the clocks and star bands
node tools/calibrate.js attack # sweep the Time Attack pair bonus
```

## Built on gamekit

Profiles, PINs, storage and sync, sounds, screens, the leaderboard and PWA
install all come from [gamekit](https://github.com/rvenning/gamekit), vendored
into `lib/`. To pull in a newer version:

```
node "../gamekit/tools/sync-to-game.js" "curio-cabinet"
```

Then bump `CACHE` in `sw.js`, or devices keep serving the old build.

## PWA

`manifest.json`, `sw.js` (network-first, cache fallback) and `icons/` (generated
by `node tools/make-icons.js` — no image files in the repo, the art is drawn in
code).

## Local development

```
npx http-server . -p 8124 -c-1
```

Then open http://localhost:8124/. Add `?debug=1` for the dev panel — note that
it **suppresses saving** by design, so never test persistence on it.

## Storage

`localStorage` under the `cur_` prefix, synced to the `curiocabinet` collection
of the shared `wordvoyage-e5a5c` Firebase project. The API key in
`js/firebase-config.js` is a public client config, not a secret — it is
restricted to the Cloud Firestore API and the rules require an anonymous
sign-in.

Everything saved is monotonic (more stars, fewer misses, a quicker clear, a
deeper Time Attack) so two devices reconcile by keeping the better of each. The
one exception is the chosen theme, which is a preference and goes to whichever
side was written later — decided by a timestamp rather than by which device
happens to sync first, so the merge is order-independent.
