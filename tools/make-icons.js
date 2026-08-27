// Generate icons/ — two cards on green baize, one face down and one turned
// over, which is the whole game in one picture.
// Run: node tools/make-icons.js  (from the curio-cabinet folder)
const fs = require("fs");
const path = require("path");
const { makeCanvas, downsample, encodePNG } = require("../lib/tools/png.js");

const OUT = path.join(__dirname, "..", "icons");
fs.mkdirSync(OUT, { recursive: true });

function paint(size, pad) {
  const SS = 4, big = size * SS;
  const cv = makeCanvas(big);
  const u = big / 100;

  const WOOD = "#241a10", WOOD2 = "#3b2a19";
  const FELT = "#2f5741", FELT2 = "#24402f";
  const BRASS = "#d9a441";
  const BACK = "#8d4a2a", BACK2 = "#a85c36", BACKINK = "#f0d29a";
  const PAPER = "#f6f1e6", PLAQUE = "#3f7fb5";

  cv.fillRect(0, 0, big, big, WOOD);
  // A little grain so the surround is not a flat slab.
  for (let y = 0; y < 100; y += 7) cv.fillRect(0, y * u, big, 2 * u, WOOD2, 0.55);

  const s = pad ? 0.76 : 1;
  const at = (v) => 50 * u + (v - 50) * u * s;
  const sz = (v) => v * u * s;

  // The baize the cards lie on.
  cv.fillRoundRect(at(8), at(14), sz(84), sz(72), sz(10), FELT2);
  cv.fillRoundRect(at(10), at(16), sz(80), sz(68), sz(9), FELT);

  // Left card: face down, with the cabinet's diamond on its back.
  cv.fillRoundRect(at(17), at(25), sz(30), sz(50), sz(6), BACK);
  cv.fillRoundRect(at(20), at(28), sz(24), sz(44), sz(4), BACK2);
  const dcx = at(32), dcy = at(50), d = sz(8);
  cv.fillTriangle(dcx, dcy - d, dcx + d * 0.72, dcy, dcx, dcy + d, BACKINK);
  cv.fillTriangle(dcx, dcy - d, dcx - d * 0.72, dcy, dcx, dcy + d, BACKINK);

  // Right card: turned over, showing a coloured plaque with a symbol on it.
  cv.fillRoundRect(at(53), at(25), sz(30), sz(50), sz(6), PAPER);
  cv.fillRoundRect(at(56), at(28), sz(24), sz(44), sz(4), PLAQUE);
  // The symbol: a simple creature — a round head with two ears and two eyes,
  // which reads at 32px far better than anything more detailed.
  const hx = at(68), hy = at(51), hr = sz(11);
  cv.fillCircle(hx - hr * 0.72, hy - hr * 0.78, hr * 0.44, PAPER);
  cv.fillCircle(hx + hr * 0.72, hy - hr * 0.78, hr * 0.44, PAPER);
  cv.fillCircle(hx, hy, hr, PAPER);
  cv.fillCircle(hx - hr * 0.38, hy - hr * 0.12, hr * 0.15, "#1a120a");
  cv.fillCircle(hx + hr * 0.38, hy - hr * 0.12, hr * 0.15, "#1a120a");
  cv.fillEllipse(hx, hy + hr * 0.4, hr * 0.26, hr * 0.18, "#1a120a");

  // Brass rim last, so it sits over both cards' edges like a real frame.
  cv.fillRect(at(8), at(14), sz(84), sz(2.5), BRASS);
  cv.fillRect(at(8), at(83.5), sz(84), sz(2.5), BRASS);
  cv.fillRect(at(8), at(14), sz(2.5), sz(72), BRASS);
  cv.fillRect(at(89.5), at(14), sz(2.5), sz(72), BRASS);

  return encodePNG(size, size, downsample(cv.px, big, SS));
}

fs.writeFileSync(path.join(OUT, "icon-192.png"), paint(192, false));
fs.writeFileSync(path.join(OUT, "icon-512.png"), paint(512, false));
fs.writeFileSync(path.join(OUT, "maskable-512.png"), paint(512, true));
console.log("icons written to", OUT);
