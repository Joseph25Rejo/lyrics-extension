// Slide assembly (Phase 5).
// Turns parsed sections into final slide specs: title on the first slide only, header space,
// per-slide boxes, and rebalancing so a continuation slide is never left with a single orphan line.
// Pure logic: the measurer is passed in, and nothing touches the DOM or PptxGenJS.
// All geometry comes from src/layout.js.

const SlideAssembly = (() => {
  const L = typeof Layout !== "undefined" ? Layout : require("./layout.js");
  const BF = typeof BlockFit !== "undefined" ? BlockFit : require("./fit.js");
  const BS = typeof BlockSplit !== "undefined" ? BlockSplit : require("./split.js");

  // Title: one line at the largest size from 54pt down that fits the width.
  // If none fits on one line, use the fallback size and let it wrap, with a warning past maxLines.
  function layoutTitle(title, measurer) {
    const warnings = [];
    for (const size of L.TITLE.sizes) {
      const r = measurer.wrap(title, size, L.CONTENT.w);
      if (r.lines.length === 1 && !r.tooNarrow) {
        return { text: title, sizePt: size, lines: r.lines, heightPt: measurer.blockHeight(1, size), warnings };
      }
    }
    const size = L.TITLE.fallbackPt;
    const r = measurer.wrap(title, size, L.CONTENT.w);
    const lines = r.lines.length ? r.lines : [title];
    if (lines.length > L.TITLE.maxLines) {
      warnings.push(`The title wraps to ${lines.length} lines at ${size}pt. Consider a shorter title.`);
    }
    return {
      text: title,
      sizePt: size,
      lines,
      heightPt: measurer.blockHeight(lines.length, size),
      warnings
    };
  }

  // Rebalance: if a continuation slide has only one line, redistribute the lines of it and the
  // previous slide so both have at least two lines and both fit. Chooses the most even split.
  function rebalanceOrphans(slides, measurer, boxFor) {
    for (let i = 1; i < slides.length; i++) {
      const cur = slides[i];
      const prev = slides[i - 1];
      if (!cur.continued || cur.overflow || prev.overflow) continue;
      if (cur.lines.length !== 1) continue;

      const all = prev.lines.concat(cur.lines);
      const n = all.length;
      if (n < 3) continue; // a 1+1 split changes nothing

      const hasHeader = cur.header !== null && cur.header !== undefined;
      const boxA = boxFor(i - 1, hasHeader);
      const boxB = boxFor(i, hasHeader);

      // Try split points closest to the middle first, so the result is as even as possible.
      const ks = [];
      for (let k = 1; k < n; k++) ks.push(k);
      ks.sort((a, b) => Math.abs(a - n / 2) - Math.abs(b - n / 2));

      for (const k of ks) {
        const a = BF.fitBlock(all.slice(0, k), measurer, boxA);
        if (!a.fits) continue;
        const b = BF.fitBlock(all.slice(k), measurer, boxB);
        if (!b.fits) continue;
        prev.lines = all.slice(0, k);
        prev.fit = a;
        cur.lines = all.slice(k);
        cur.fit = b;
        break;
      }
    }
  }

  // sections: [{ header: string|null, lines: [{ text, src }] }] as produced by LyricsParser.
  // title: the title string. Returns { title, slides, warnings, overflowCount }.
  function assemble(sections, title, measurer) {
    const titleLayout = layoutTitle(title, measurer);
    const titleH = titleLayout.heightPt;

    // Only the first slide has a title, and header presence changes the box.
    const boxForSlide = (slideIndex, hasHeader) =>
      L.lyricBox(slideIndex === 0 ? titleH : 0, hasHeader);

    const plain = sections.map((s) => ({
      header: s.header,
      lines: s.lines.map((l) => l.text)
    }));

    const { slides: raw } = BS.splitSections(plain, measurer, boxForSlide);
    rebalanceOrphans(raw, measurer, boxForSlide);

    const warnings = [...titleLayout.warnings];
    const slides = raw.map((s, index) => {
      const hasHeader = s.header !== null && s.header !== undefined;
      if (s.overflow) {
        warnings.push(`Slide ${index + 1} has a line that is too long to fit even at ${BF.MIN_PT}pt.`);
      }
      return {
        index,
        title: index === 0 ? titleLayout : null,
        header: hasHeader ? s.header : null,
        headerBox: hasHeader ? L.headerBox(index === 0 ? titleH : 0) : null,
        lines: s.lines,
        sizePt: s.fit.sizePt,
        box: boxForSlide(index, hasHeader),
        continued: s.continued,
        overflow: s.overflow
      };
    });

    const overflowCount = slides.filter((s) => s.overflow).length;
    return { title, slides, warnings, overflowCount };
  }

  return { assemble, layoutTitle, rebalanceOrphans };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = SlideAssembly;
}
