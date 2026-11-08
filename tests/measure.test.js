// Run with: node --test tests/measure.test.js
// Uses a fake width function (0.5em per character) so results are exact.

const test = require("node:test");
const assert = require("node:assert/strict");
const TextMeasure = require("../src/measure.js");

// Each character is 50px wide at the reference size (100px), i.e. 0.5em.
const fakeRaw = (text) => text.length * 50;
const makeM = () => TextMeasure.createMeasurer(fakeRaw);

test("width scales linearly with font size", () => {
  const m = makeM();
  assert.equal(m.width("abcd", 100), 200);   // 4 chars * 50 * (100/100)
  assert.equal(m.width("abcd", 48), 96);     // 4 chars * 50 * 0.48
  assert.equal(m.width("abcd", 36), 72);
});

test("block height uses the 1.2 line factor", () => {
  const m = makeM();
  assert.equal(m.blockHeight(3, 48), 3 * 48 * 1.2);
  assert.equal(m.blockHeight(0, 48), 0);
});

test("repeated measurements hit the cache", () => {
  const m = makeM();
  m.width("hello", 48);
  m.width("hello", 36);
  m.width("hello", 48);
  const s = m.stats();
  assert.equal(s.misses, 1);
  assert.equal(s.hits, 2);
});

test("cache is bounded and clears when full", () => {
  const m = makeM();
  for (let i = 0; i < 20001; i++) m.width("w" + i, 48);
  assert.ok(m.stats().cached <= 20000);
});

test("wrap returns no lines for empty or space-only text", () => {
  const m = makeM();
  assert.deepEqual(m.wrap("", 48, 500).lines, []);
  assert.deepEqual(m.wrap("   ", 48, 500).lines, []);
});

test("wrap keeps short text on one line", () => {
  const m = makeM();
  // "abc def" = 7 chars = 350px ref. At 48pt: 7 * 50 * 0.48 = 168pt. Width 200pt fits.
  assert.deepEqual(m.wrap("abc def", 48, 200).lines, ["abc def"]);
});

test("wrap breaks lines greedily at word boundaries", () => {
  const m = makeM();
  // At 100pt, each char is 50pt. Width 150pt fits 3 chars.
  // "aa bb cc" -> "aa" (2 chars), "bb" (2), "cc" (2), since "aa bb" is 5 chars = 250pt.
  const r = m.wrap("aa bb cc", 100, 150);
  assert.deepEqual(r.lines, ["aa", "bb", "cc"]);
  assert.equal(r.tooNarrow, false);
});

test("wrap packs words that fit together", () => {
  const m = makeM();
  // At 100pt, width 300pt fits 6 chars. "aa bb" (5 chars) fits; adding " cc" (8) does not.
  assert.deepEqual(m.wrap("aa bb cc dd", 100, 300).lines, ["aa bb", "cc dd"]);
});

test("a word wider than the box is broken by character", () => {
  const m = makeM();
  // At 100pt, width 150pt fits 3 chars. "abcdefgh" -> "abc", "def", "gh".
  const r = m.wrap("abcdefgh", 100, 150);
  assert.deepEqual(r.lines, ["abc", "def", "gh"]);
  assert.equal(r.tooNarrow, false);
});

test("a single character wider than the box sets tooNarrow", () => {
  const m = makeM();
  // At 100pt, width 40pt is narrower than one 50pt character.
  const r = m.wrap("ab", 100, 40);
  assert.equal(r.tooNarrow, true);
  assert.deepEqual(r.lines, ["a", "b"]);
});

test("wrap splits accented characters as whole characters", () => {
  const m = makeM();
  // Accented letters are single code points; the fake width is 50px each, so 100pt fits two.
  const r = m.wrap("ééé", 100, 100);
  assert.deepEqual(r.lines, ["éé", "é"]);
});

test("wrap is deterministic for the same input", () => {
  const m = makeM();
  const a = m.wrap("the quick brown fox jumps", 48, 300).lines;
  const b = m.wrap("the quick brown fox jumps", 48, 300).lines;
  assert.deepEqual(a, b);
});

test("font detection reports installed when widths differ from fallback", () => {
  const fakeCtx = {
    font: "",
    measureText(t) {
      const isFamily = this.font.includes("Aharoni");
      return { width: t.length * (isFamily ? 50 : 60) };
    }
  };
  assert.equal(TextMeasure.isFontInstalled("Aharoni", fakeCtx), true);
});

test("font detection reports missing when widths match the fallback", () => {
  const fakeCtx = {
    font: "",
    measureText(t) {
      return { width: t.length * 60 }; // same width whatever the family, i.e. fallback used
    }
  };
  assert.equal(TextMeasure.isFontInstalled("Aharoni", fakeCtx), false);
});

test("the line factor comes from the shared layout module", () => {
  const Layout = require("../src/layout.js");
  assert.equal(TextMeasure.LINE_FACTOR, Layout.LYRIC.lineFactor);
});
