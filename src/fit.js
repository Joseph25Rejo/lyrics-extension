// Block fitting (Phase 3).
// For one block of lyric lines, find the largest font size (48pt down to 36pt, in 2pt steps)
// at which the wrapped text fits the box. Pure logic: the measurer is passed in.
//
// Why binary search is valid: as the size drops, the box width in reference units grows, so greedy
// word wrap never produces more lines. Height = lines * size * factor, which also never grows as size
// drops. So "fits" is monotone in size, and the largest fitting size can be found in O(log n) steps.
//
// Each source line is wrapped on its own, so separate lyric lines never merge.

const BlockFit = (() => {
  const LayoutModule = typeof Layout !== "undefined" ? Layout : require("./layout.js");
  const MAX_PT = LayoutModule.LYRIC.maxPt;
  const MIN_PT = LayoutModule.LYRIC.minPt;
  const STEP_PT = LayoutModule.LYRIC.stepPt;

  // Candidate sizes, largest first: [48, 46, ..., 36].
  const SIZES = [];
  for (let s = MAX_PT; s >= MIN_PT; s -= STEP_PT) SIZES.push(s);

  // Wrap every source line at one size and measure the stack.
  // box: { w, h } in points. Returns the layout plus whether it fits.
  function layout(lines, sizePt, box, measurer) {
    const visual = [];
    let tooNarrow = false;
    for (const line of lines) {
      const r = measurer.wrap(line, sizePt, box.w);
      if (r.tooNarrow) tooNarrow = true;
      if (r.lines.length === 0) visual.push("");
      else for (const v of r.lines) visual.push(v);
    }
    const heightPt = measurer.blockHeight(visual.length, sizePt);
    return {
      sizePt,
      visual,
      heightPt,
      tooNarrow,
      fits: !tooNarrow && heightPt <= box.h
    };
  }

  // Find the largest size that fits.
  // lines: string[] (already cleaned). box: { w, h } in points. measurer: from TextMeasure.createMeasurer.
  // Returns { fits, sizePt, visual, heightPt, tooNarrow, evaluations }.
  // If nothing fits, fits is false and sizePt is MIN_PT, so the caller can split the block.
  function fitBlock(lines, measurer, box, sizes = SIZES) {
    let evaluations = 0;
    const at = (i) => {
      evaluations++;
      return layout(lines, sizes[i], box, measurer);
    };

    const n = sizes.length;
    if (n === 0) throw new Error("fitBlock needs at least one size");

    // Fast path: the largest size fits.
    const top = at(0);
    if (top.fits) return { ...top, evaluations };

    // Smallest size is the last resort. If it doesn't fit, nothing does.
    const bottom = at(n - 1);
    if (!bottom.fits) return { ...bottom, evaluations };

    // Invariant: index 0 does not fit and index hi fits. Find the smallest index that fits.
    let lo = 1;
    let hi = n - 1;
    let best = bottom;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      const r = at(mid);
      if (r.fits) {
        hi = mid;
        best = r;
      } else {
        lo = mid + 1;
      }
    }
    return { ...best, evaluations };
  }

  return { fitBlock, layout, SIZES, MAX_PT, MIN_PT, STEP_PT };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = BlockFit;
}
