// Single source of truth for slide geometry and text style.
// Every text box is centred: horizontally on the slide and with centred text, and vertically within its box.
// All other modules read their numbers from here. Points (pt) throughout; 72 pt = 1 inch.

const Layout = (() => {
  const SLIDE = { w: 960, h: 540 };                 // 13.333 x 7.5 in, LAYOUT_WIDE

  const CONTENT = {
    w: 878.4,                                       // 12.2 in: the width every text box uses
    top: 28.8,                                      // 0.4 in from the top
    bottom: 489.6                                   // 50.4 pt bottom margin
  };
  const LEFT = (SLIDE.w - CONTENT.w) / 2;           // 40.8 pt: centred horizontally
  const GAP = 7.2;                                  // space between stacked boxes

  const FONT = "Aharoni";
  const BACKGROUND = "000000";
  const TEXT_MARGIN = 0;                            // no internal padding, so boxes are exact

  // Every text style lives here.
  const TITLE = {
    sizes: descending(54, 36, 2),                   // tried from largest to smallest
    fallbackPt: 36,                                 // used when no size gives one line
    maxLines: 2,                                    // warn past this many lines
    colour: "E57373",                               // a paler red
    bold: true,
    align: "center",
    valign: "middle"
  };
  const HEADER = {
    heightPt: 36,                                   // one line of header text
    sizePt: 20,
    colour: "FFFF64",                               // yellow
    bold: true,
    align: "center",
    valign: "middle"
  };
  const LYRIC = {
    sizes: descending(48, 36, 2),                   // largest first; 36 is the floor
    minPt: 36,
    maxPt: 48,
    stepPt: 2,
    colour: "FFFFFF",
    align: "center",
    valign: "middle",
    lineFactor: 1.2                                 // line height as a multiple of font size (unverified in PowerPoint)
  };

  function descending(max, min, step) {
    const out = [];
    for (let s = max; s >= min; s -= step) out.push(s);
    return out;
  }

  // Boxes, in points. A box is { x, y, w, h }.
  function titleBox(heightPt) {
    return { x: LEFT, y: CONTENT.top, w: CONTENT.w, h: heightPt };
  }

  function headerBox(titleHeightPt) {
    const y = CONTENT.top + (titleHeightPt > 0 ? titleHeightPt + GAP : 0);
    return { x: LEFT, y, w: CONTENT.w, h: HEADER.heightPt };
  }

  // The lyric box for a slide. It is centred on the slide's vertical middle, so the lyrics sit in the
  // middle of the slide. It is as tall as the room allows: it stops short of the title/header stack
  // above, and of the bottom margin below. The title and header keep their place at the top.
  function lyricBox(titleHeightPt, hasHeader) {
    let stackBottom = CONTENT.top;
    if (titleHeightPt > 0) stackBottom += titleHeightPt + GAP;
    if (hasHeader) stackBottom += HEADER.heightPt + GAP;

    const middle = SLIDE.h / 2;
    const half = Math.min(middle - stackBottom, CONTENT.bottom - middle);
    return { x: LEFT, y: middle - half, w: CONTENT.w, h: 2 * half };
  }

  return {
    SLIDE, CONTENT, LEFT, GAP,
    FONT, BACKGROUND, TEXT_MARGIN,
    TITLE, HEADER, LYRIC,
    titleBox, headerBox, lyricBox
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = Layout;
}
