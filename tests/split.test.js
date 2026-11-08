// Run with: node --test tests/split.test.js
// Uses a fake width function (0.5em per character) so results are exact.

const test = require("node:test");
const assert = require("node:assert/strict");
const TextMeasure = require("../src/measure.js");
const BlockFit = require("../src/fit.js");
const BlockSplit = require("../src/split.js");

const fakeRaw = (text) => text.length * 50;
const makeM = () => TextMeasure.createMeasurer(fakeRaw);

// At 36pt a line is 43.2pt tall. A 500pt box holds floor(500 / 43.2) = 11 lines.
const BOX = { w: 1000, h: 500 };

test("a section that fits stays on one slide, not continued", () => {
  const r = BlockSplit.splitSections([{ header: "Verse", lines: ["aa", "bb"] }], makeM(), BOX);
  assert.equal(r.slides.length, 1);
  assert.equal(r.slides[0].header, "Verse");
  assert.deepEqual(r.slides[0].lines, ["aa", "bb"]);
  assert.equal(r.slides[0].continued, false);
  assert.equal(r.overflowCount, 0);
});

test("a tall section is split into chunks that each fit", () => {
  // 20 lines at 36pt need 864pt, so the box (500pt) forces a split: 11 lines, then 9.
  const lines = Array(20).fill("a");
  const r = BlockSplit.splitSections([{ header: "Chorus", lines }], makeM(), BOX);
  assert.deepEqual(r.slides.map((s) => s.lines.length), [11, 9]);
  for (const s of r.slides) {
    assert.equal(s.overflow, false);
    assert.equal(s.fit.fits, true);
  }
});

test("continuation slides repeat the header and are marked continued", () => {
  const lines = Array(20).fill("a");
  const r = BlockSplit.splitSections([{ header: "Chorus", lines }], makeM(), BOX);
  assert.deepEqual(r.slides.map((s) => s.header), ["Chorus", "Chorus"]);
  assert.deepEqual(r.slides.map((s) => s.continued), [false, true]);
});

test("lines are never split: every chunk is made of whole source lines in order", () => {
  const lines = Array.from({ length: 30 }, (_, i) => `line ${i}`);
  const r = BlockSplit.splitSections([{ header: null, lines }], makeM(), BOX);
  const flattened = r.slides.flatMap((s) => s.lines);
  assert.deepEqual(flattened, lines);
});

test("no source line is lost or duplicated across many sizes and boxes", () => {
  for (let count = 1; count <= 40; count += 3) {
    for (const h of [120, 300, 500, 900]) {
      const lines = Array.from({ length: count }, (_, i) => "word ".repeat((i % 4) + 1).trim());
      const r = BlockSplit.splitSections([{ header: "S", lines }], makeM(), { w: 400, h });
      assert.deepEqual(r.slides.flatMap((s) => s.lines), lines, `count=${count} h=${h}`);
    }
  }
});

test("sections are never mixed on one slide", () => {
  const sections = [
    { header: "A", lines: ["a1", "a2"] },
    { header: "B", lines: ["b1"] }
  ];
  const r = BlockSplit.splitSections(sections, makeM(), BOX);
  assert.deepEqual(r.slides.map((s) => s.header), ["A", "B"]);
  assert.deepEqual(r.slides.map((s) => s.lines), [["a1", "a2"], ["b1"]]);
});

test("section order is preserved across split and unsplit sections", () => {
  const tall = Array(20).fill("x");
  const sections = [
    { header: "First", lines: ["one"] },
    { header: "Second", lines: tall },
    { header: "Third", lines: ["three"] }
  ];
  const r = BlockSplit.splitSections(sections, makeM(), BOX);
  assert.deepEqual(r.slides.map((s) => s.header), ["First", "Second", "Second", "Third"]);
});

test("a line that cannot fit even alone is kept and flagged as overflow", () => {
  // 200 characters in a 100pt box wrap into many lines, which is taller than the 500pt box at any size.
  const huge = "a".repeat(200);
  const r = BlockSplit.splitSections([{ header: "H", lines: [huge, "ok"] }], makeM(), { w: 100, h: 500 });
  const overflowed = r.slides.filter((s) => s.overflow);
  assert.equal(overflowed.length, 1);
  assert.deepEqual(overflowed[0].lines, [huge]);
  assert.equal(r.overflowCount, 1);
});

test("a single character wider than the box is flagged as overflow", () => {
  const r = BlockSplit.splitSections([{ header: null, lines: ["ab"] }], makeM(), { w: 10, h: 1000 });
  assert.equal(r.slides.length, 1);
  assert.equal(r.slides[0].overflow, true);
});

test("empty sections produce no slides", () => {
  const r = BlockSplit.splitSections([{ header: "Empty", lines: [] }], makeM(), BOX);
  assert.deepEqual(r.slides, []);
});

test("packLines chunks each fit, and each chunk is maximal", () => {
  const m = makeM();
  const lines = Array(25).fill("a");
  const chunks = BlockSplit.packLines(lines, m, BOX);
  // Maximal: adding the next line to a chunk must make it stop fitting.
  for (let i = 0; i < chunks.length - 1; i++) {
    const next = [...chunks[i].lines, chunks[i + 1].lines[0]];
    assert.equal(BlockFit.fitBlock(next, m, BOX).fits, false, `chunk ${i} is not maximal`);
  }
});
