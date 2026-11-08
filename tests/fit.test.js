// Run with: node --test tests/fit.test.js
// Uses a fake width function (0.5em per character) so results are exact.

const test = require("node:test");
const assert = require("node:assert/strict");
const TextMeasure = require("../src/measure.js");
const BlockFit = require("../src/fit.js");

const fakeRaw = (text) => text.length * 50; // 0.5em per character at the 100px reference
const makeM = () => TextMeasure.createMeasurer(fakeRaw);

test("sizes run from 48 down to 36 in 2pt steps", () => {
  assert.deepEqual(BlockFit.SIZES, [48, 46, 44, 42, 40, 38, 36]);
});

test("a short block fits at 48pt in one evaluation", () => {
  const r = BlockFit.fitBlock(["aa"], makeM(), { w: 1000, h: 500 });
  assert.equal(r.fits, true);
  assert.equal(r.sizePt, 48);
  assert.equal(r.evaluations, 1);
});

test("picks the largest size that fits the height", () => {
  // 10 single-line lines: height = 10 * size * 1.2. Box height 500 allows size <= 41.6,
  // so the largest 2pt step that fits is 40 (480pt). 42 would be 504pt.
  const lines = Array(10).fill("a");
  const r = BlockFit.fitBlock(lines, makeM(), { w: 1000, h: 500 });
  assert.equal(r.fits, true);
  assert.equal(r.sizePt, 40);
  assert.equal(r.heightPt, 480);
});

test("reports not fitting at 36pt when even the smallest size is too tall", () => {
  // 20 lines at 36pt = 864pt, which is taller than the 500pt box.
  const lines = Array(20).fill("a");
  const r = BlockFit.fitBlock(lines, makeM(), { w: 1000, h: 500 });
  assert.equal(r.fits, false);
  assert.equal(r.sizePt, 36);
});

test("each source line is wrapped on its own and never merges with the next", () => {
  const r = BlockFit.fitBlock(["aa", "bb"], makeM(), { w: 1000, h: 500 });
  assert.deepEqual(r.visual, ["aa", "bb"]);
});

test("a line wider than the box wraps and adds height", () => {
  // "aaaa bbbb" is 9 chars. At 48pt it is 216pt wide, so a 150pt box wraps it into 2 lines.
  const r = BlockFit.fitBlock(["aaaa bbbb"], makeM(), { w: 150, h: 1000 });
  assert.equal(r.visual.length, 2);
  assert.equal(r.fits, true);
});

test("a character wider than the box at every size means it does not fit", () => {
  // One character is 24pt at 48pt and 18pt at 36pt, both wider than a 10pt box.
  const r = BlockFit.fitBlock(["ab"], makeM(), { w: 10, h: 1000 });
  assert.equal(r.tooNarrow, true);
  assert.equal(r.fits, false);
});

test("an empty block fits at 48pt with zero height", () => {
  const r = BlockFit.fitBlock([], makeM(), { w: 1000, h: 500 });
  assert.equal(r.fits, true);
  assert.equal(r.sizePt, 48);
  assert.equal(r.heightPt, 0);
});

test("binary search agrees with a brute-force scan over many blocks", () => {
  const m = makeM();
  const samples = [
    "a", "ab cd", "the quick brown fox", "one two three four five six seven",
    "x y z", "longer words here to wrap around the box width nicely"
  ];

  // Brute force: the largest size at which the whole block fits, checked directly.
  const bruteForce = (lines, box) => {
    for (const size of BlockFit.SIZES) {
      const visual = [];
      let tooNarrow = false;
      for (const l of lines) {
        const r = m.wrap(l, size, box.w);
        if (r.tooNarrow) tooNarrow = true;
        if (r.lines.length === 0) visual.push("");
        else visual.push(...r.lines);
      }
      if (!tooNarrow && m.blockHeight(visual.length, size) <= box.h) return size;
    }
    return null;
  };

  let checked = 0;
  for (let count = 1; count <= 25; count++) {
    for (const h of [100, 250, 400, 537, 800]) {
      for (const w of [120, 300, 600, 1000]) {
        const lines = [];
        for (let i = 0; i < count; i++) lines.push(samples[i % samples.length]);
        const box = { w, h };
        const fit = BlockFit.fitBlock(lines, m, box);
        const expected = bruteForce(lines, box);
        if (expected === null) {
          assert.equal(fit.fits, false, `count=${count} h=${h} w=${w}`);
          assert.equal(fit.sizePt, 36);
        } else {
          assert.equal(fit.fits, true, `count=${count} h=${h} w=${w}`);
          assert.equal(fit.sizePt, expected, `count=${count} h=${h} w=${w}`);
        }
        checked++;
      }
    }
  }
  assert.equal(checked, 25 * 5 * 4);
});

test("evaluations stay within a logarithmic bound", () => {
  // 7 candidate sizes need at most about log2(7) + 2 layouts.
  const lines = Array(12).fill("alpha beta gamma");
  for (const h of [50, 200, 350, 500, 700]) {
    const r = BlockFit.fitBlock(lines, makeM(), { w: 400, h });
    assert.ok(r.evaluations <= 5, `h=${h} evaluations=${r.evaluations}`);
  }
});
