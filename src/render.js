// PowerPoint rendering (Phase 6).
// Draws the assembled slide specs with PptxGenJS. Every position and style comes from src/layout.js.
// PptxGenJS takes inches, so positions are converted here (1 inch = 72 pt).
// No measurement happens here; the sizes and boxes were already decided by the fitter.
// Every text box is centred: horizontally with centred text, and vertically within its box.

const DeckRender = (() => {
  const L = typeof Layout !== "undefined" ? Layout : require("./layout.js");

  const toIn = (pt) => pt / 72;

  function inchBox(b) {
    return { x: toIn(b.x), y: toIn(b.y), w: toIn(b.w), h: toIn(b.h) };
  }

  // Style shared by every text box, plus the per-box settings.
  function textStyle(style, fontSize) {
    return {
      fontFace: L.FONT,
      fontSize,
      bold: style.bold === true,
      color: style.colour,
      align: style.align,
      valign: style.valign,
      margin: L.TEXT_MARGIN
    };
  }

  // assembled: output of SlideAssembly.assemble.
  // pptx: a new PptxGenJS() instance (injected so tests can pass a fake).
  // Returns the same pptx instance with slides added. The caller writes the file.
  function render(assembled, pptx) {
    pptx.layout = "LAYOUT_WIDE";
    pptx.title = assembled.title;

    for (const slide of assembled.slides) {
      const s = pptx.addSlide();
      s.background = { color: L.BACKGROUND };

      // Title: first slide only, in the title box at the top of the content area.
      if (slide.title) {
        s.addText(slide.title.text, {
          ...inchBox(L.titleBox(slide.title.heightPt)),
          ...textStyle(L.TITLE, slide.title.sizePt)
        });
      }

      // Section header, when the slide has one.
      if (slide.headerBox) {
        s.addText(slide.header, {
          ...inchBox(slide.headerBox),
          ...textStyle(L.HEADER, L.HEADER.sizePt)
        });
      }

      // Lyrics: the fitted size, in the box the assembler gave this slide.
      s.addText(slide.lines.join("\n"), {
        ...inchBox(slide.box),
        ...textStyle(L.LYRIC, slide.sizePt)
      });
    }

    return pptx;
  }

  return { render, inchBox };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = DeckRender;
}
