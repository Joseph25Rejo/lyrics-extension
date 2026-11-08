// Run with: node --test tests/render.test.js
// Uses a fake PptxGenJS that records what would be drawn, plus the fake width function.

const test = require("node:test");
const assert = require("node:assert/strict");
const TextMeasure = require("../src/measure.js");
const SlideAssembly = require("../src/assemble.js");
const DeckRender = require("../src/render.js");

const fakeRaw = (text) => text.length * 50;
const makeM = () => TextMeasure.createMeasurer(fakeRaw);

class FakePptx {
  constructor() {
    this.slides = [];
    this.layout = null;
    this.title = null;
  }
  addSlide() {
    const slide = {
      background: null,
      texts: [],
      addText(text, options) {
        this.texts.push({ text, options });
      }
    };
    this.slides.push(slide);
    return slide;
  }
}

const sec = (header, lines) => ({
  header,
  lines: lines.map((text, i) => ({ text, src: i + 1 }))
});

function renderFrom(sections, title) {
  const assembled = SlideAssembly.assemble(sections, title, makeM());
  const pptx = DeckRender.render(assembled, new FakePptx());
  return { assembled, pptx };
}

test("every slide has a black background", () => {
  const { pptx } = renderFrom([sec("A", ["aa"]), sec("B", ["bb"])], "T");
  for (const s of pptx.slides) assert.deepEqual(s.background, { color: "000000" });
});

test("one PowerPoint slide per assembled slide, and the layout is widescreen", () => {
  const { assembled, pptx } = renderFrom([sec("A", ["aa"]), sec("B", ["bb"])], "T");
  assert.equal(pptx.slides.length, assembled.slides.length);
  assert.equal(pptx.layout, "LAYOUT_WIDE");
  assert.equal(pptx.title, "T");
});

test("every piece of text uses Aharoni", () => {
  const { pptx } = renderFrom([sec("A", ["aa"]), sec("B", ["bb"])], "Title");
  for (const s of pptx.slides) {
    for (const t of s.texts) assert.equal(t.options.fontFace, "Aharoni");
  }
});

test("the title is drawn on the first slide only, in the paler red at 54pt or less", () => {
  const { pptx } = renderFrom([sec("A", ["aa"]), sec("B", ["bb"])], "My Song");
  const titleTexts = pptx.slides.map((s) => s.texts.filter((t) => t.text === "My Song"));
  assert.equal(titleTexts[0].length, 1);
  assert.equal(titleTexts[1].length, 0);
  assert.equal(titleTexts[0][0].options.color, "E57373");
  assert.ok(titleTexts[0][0].options.fontSize <= 54 && titleTexts[0][0].options.fontSize >= 36);
});

test("lyric text uses the fitted size of its slide and is white", () => {
  const { assembled, pptx } = renderFrom([sec("A", ["aa", "bb"])], "T");
  const slide = assembled.slides[0];
  const lyric = pptx.slides[0].texts.find((t) => t.text === slide.lines.join("\n"));
  assert.ok(lyric, "lyric text box is present");
  assert.equal(lyric.options.fontSize, slide.sizePt);
  assert.equal(lyric.options.color, "FFFFFF");
  assert.equal(lyric.options.align, "center");
});

test("a header is drawn only on slides that have one", () => {
  const { pptx } = renderFrom([sec("Verse", ["aa"]), sec(null, ["bb"])], "T");
  const headerTexts = pptx.slides.map((s) => s.texts.filter((t) => t.text === "Verse"));
  assert.equal(headerTexts[0].length, 1);
  assert.equal(headerTexts[0][0].options.color, "FFFF64");
  assert.equal(pptx.slides[1].texts.length, 1); // lyrics only
});

test("positions are converted from points to inches", () => {
  const { assembled, pptx } = renderFrom([sec(null, ["aa"])], "Title");
  const b = assembled.slides[0].box;
  const lyric = pptx.slides[0].texts[pptx.slides[0].texts.length - 1];
  assert.equal(lyric.options.x, b.x / 72);
  assert.equal(lyric.options.y, b.y / 72);
  assert.equal(lyric.options.w, b.w / 72);
  assert.equal(lyric.options.h, b.h / 72);
});

test("all text boxes have zero internal margin", () => {
  const { pptx } = renderFrom([sec("A", ["aa"])], "T");
  for (const s of pptx.slides) {
    for (const t of s.texts) assert.equal(t.options.margin, 0);
  }
});

test("every text box is centred horizontally on the slide with centred text", () => {
  const { pptx } = renderFrom([sec("A", ["aa"]), sec(null, ["bb"])], "Title");
  const slideCentre = 960 / 2 / 72; // inches
  for (const s of pptx.slides) {
    for (const t of s.texts) {
      const o = t.options;
      assert.ok(Math.abs(o.x + o.w / 2 - slideCentre) < 1e-9, `box centred: ${t.text}`);
      assert.equal(o.align, "center", `text centred: ${t.text}`);
      assert.equal(o.valign, "middle", `vertically centred in box: ${t.text}`);
    }
  }
});

test("the title box sits above the first slide's lyric box", () => {
  const { assembled, pptx } = renderFrom([sec("A", ["aa"])], "T");
  const titleBox = pptx.slides[0].texts.find((t) => t.text === "T").options;
  const lyricBox = pptx.slides[0].texts.find((t) => t.text !== "T" && t.text !== "A").options;
  assert.ok(titleBox.y + titleBox.h <= lyricBox.y + 1e-9);
  assert.equal(assembled.slides[0].title.text, "T");
});
