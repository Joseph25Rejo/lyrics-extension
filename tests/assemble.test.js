// Run with: node --test tests/assemble.test.js
// Uses a fake width function (0.5em per character) so results are exact.

const test = require("node:test");
const assert = require("node:assert/strict");
const TextMeasure = require("../src/measure.js");
const BlockFit = require("../src/fit.js");
const SlideAssembly = require("../src/assemble.js");
const L = require("../src/layout.js");

const fakeRaw = (text) => text.length * 50;
const makeM = () => TextMeasure.createMeasurer(fakeRaw);

// Build parser-shaped sections from plain strings: one section per [header, [lines...]] pair.
const sec = (header, lines) => ({
  header,
  lines: lines.map((text, i) => ({ text, src: i + 1 }))
});

test("every lyric box is centred on the slide's vertical middle", () => {
  const middle = L.SLIDE.h / 2;
  for (const titleH of [0, 43.2, 64.8, 100]) {
    for (const hasHeader of [false, true]) {
      const b = L.lyricBox(titleH, hasHeader);
      assert.ok(Math.abs(b.y + b.h / 2 - middle) < 1e-9, `titleH=${titleH} header=${hasHeader}`);
      assert.equal(b.x, L.LEFT);
      assert.equal(b.w, L.CONTENT.w);
    }
  }
});

test("a lyric box never overlaps the title and header above it, or the bottom margin", () => {
  for (const titleH of [0, 64.8, 300]) {
    for (const hasHeader of [false, true]) {
      const b = L.lyricBox(titleH, hasHeader);
      let stackBottom = L.CONTENT.top;
      if (titleH > 0) stackBottom += titleH + L.GAP;
      if (hasHeader) stackBottom += L.HEADER.heightPt + L.GAP;
      assert.ok(b.y >= stackBottom - 1e-9, `overlaps stack: titleH=${titleH} header=${hasHeader}`);
      assert.ok(b.y + b.h <= L.CONTENT.bottom + 1e-9, `below bottom margin: titleH=${titleH}`);
    }
  }
});

test("lyricBox moves down for a title and for a header", () => {
  const noExtras = L.lyricBox(0, false);
  const withHeader = L.lyricBox(0, true);
  const withTitle = L.lyricBox(64.8, false);
  assert.ok(withHeader.y > noExtras.y);
  assert.ok(withTitle.y > noExtras.y);
  assert.ok(withHeader.h < noExtras.h);
  assert.ok(Math.abs(withTitle.y - (L.CONTENT.top + 64.8 + L.GAP)) < 1e-9);
});

test("a short title uses 54pt on one line", () => {
  const t = SlideAssembly.layoutTitle("abc", makeM());
  assert.equal(t.sizePt, 54);
  assert.deepEqual(t.lines, ["abc"]);
  assert.equal(t.heightPt, 54 * 1.2);
  assert.deepEqual(t.warnings, []);
});

test("a long title drops size until it fits one line", () => {
  // 40 chars at 54pt = 40*50*0.54 = 1080pt, wider than the content width. At 36pt: 720pt, which fits.
  const title = "a".repeat(40);
  const t = SlideAssembly.layoutTitle(title, makeM());
  assert.equal(t.lines.length, 1);
  assert.ok(t.sizePt < 54 && t.sizePt >= 36);
});

test("a very long title falls back to 36pt over several lines with a warning", () => {
  const title = "word ".repeat(120).trim(); // far too long for one line even at 36pt
  const t = SlideAssembly.layoutTitle(title, makeM());
  assert.equal(t.sizePt, 36);
  assert.ok(t.lines.length > 2);
  assert.ok(t.warnings.some((w) => /wraps to/.test(w)));
});

test("the title appears on slide 1 only", () => {
  const r = SlideAssembly.assemble(
    [sec("A", ["aa"]), sec("B", ["bb"]), sec("C", ["cc"])],
    "My Song",
    makeM()
  );
  assert.equal(r.slides.length, 3);
  assert.equal(r.slides[0].title.text, "My Song");
  assert.equal(r.slides[1].title, null);
  assert.equal(r.slides[2].title, null);
});

test("the first slide's lyric box sits below the title", () => {
  const r = SlideAssembly.assemble([sec("A", ["aa"]), sec("B", ["bb"])], "T", makeM());
  assert.ok(r.slides[0].box.y > r.slides[1].box.y);
  assert.ok(r.slides[0].box.h < r.slides[1].box.h);
});

test("headers are placed under the title on slide 1", () => {
  const r = SlideAssembly.assemble([sec("Verse", ["aa"])], "T", makeM());
  const s = r.slides[0];
  assert.equal(s.header, "Verse");
  assert.equal(s.headerBox.y, L.CONTENT.top + r.slides[0].title.heightPt + L.GAP);
  assert.equal(s.box.y, s.headerBox.y + L.HEADER.heightPt + L.GAP);
});

test("a section with no header has no header box and a taller lyric box", () => {
  const r = SlideAssembly.assemble([sec(null, ["aa"]), sec(null, ["bb"])], "T", makeM());
  assert.equal(r.slides[1].header, null);
  assert.equal(r.slides[1].headerBox, null);
  assert.ok(r.slides[1].box.h > L.lyricBox(0, true).h);
});

test("each slide's sizePt is the size its fit was computed at", () => {
  const r = SlideAssembly.assemble([sec("A", ["aa", "bb"])], "T", makeM());
  assert.ok(r.slides[0].sizePt >= 36 && r.slides[0].sizePt <= 48);
});

test("a single line that is too tall is flagged as overflow with a warning", () => {
  const huge = "a".repeat(400);
  const r = SlideAssembly.assemble([sec("A", [huge])], "T", makeM());
  assert.equal(r.overflowCount, 1);
  assert.ok(r.warnings.some((w) => /too long to fit/.test(w)));
});

test("no orphan continuation slide: identical lines split evenly", () => {
  // Slide 1 is a plain section with a header (box height 417.6). Nine lines fit one slide,
  // so ten lines would leave one orphan. Rebalancing should give 5 and 5.
  const r = SlideAssembly.assemble(
    [sec("P", ["x"]), sec("S", Array(10).fill("a"))],
    "T",
    makeM()
  );
  const s = r.slides.filter((x) => x.header === "S");
  assert.deepEqual(s.map((x) => x.lines.length), [5, 5]);
  assert.equal(s[1].continued, true);
  assert.ok(s.every((x) => x.overflow === false));
});

test("rebalancing keeps every line, in order", () => {
  const lines = Array.from({ length: 19 }, (_, i) => `l${i}`);
  const r = SlideAssembly.assemble([sec("S", lines)], "T", makeM());
  assert.deepEqual(r.slides.flatMap((s) => s.lines), lines);
});

test("property: lines are conserved, slides fit, and no continuation is left as a lone line", () => {
  const m = makeM();
  let checked = 0;
  for (let n = 1; n <= 30; n += 2) {
    for (const title of ["Short", "A medium length title here", "t"]) {
      const sections = [
        sec("Intro", ["one two"]),
        sec("Verse", Array.from({ length: n }, (_, i) => `v ${i} ${"x".repeat(i % 7)}`)),
        sec(null, Array.from({ length: n + 3 }, () => "fill"))
      ];
      const r = SlideAssembly.assemble(sections, title, m);
      const expected = sections.flatMap((s) => s.lines.map((l) => l.text));
      assert.deepEqual(r.slides.flatMap((s) => s.lines), expected, `n=${n} title=${title}`);
      for (const s of r.slides) {
        // Re-check each slide against the box it was given, at the size it was given.
        if (!s.overflow) {
          const check = BlockFit.layout(s.lines, s.sizePt, s.box, m);
          assert.equal(check.fits, true, `slide ${s.index} does not fit at n=${n} title=${title}`);
        }
      }
      for (const s of r.slides) {
        if (s.continued && !s.overflow) {
          assert.ok(s.lines.length >= 2, `lone continuation line at n=${n}`);
        }
      }
      checked++;
    }
  }
  assert.equal(checked, 15 * 3);
});
