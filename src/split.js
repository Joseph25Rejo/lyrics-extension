// Overflow splitting (Phase 4, extended in Phase 5).
// Takes sections (header + lines) and produces slides. A section that fits as one slide stays whole.
// A section that does not fit is packed greedily into chunks, each of which fits.
//
// Rules:
//   - Lines are never split. Each chunk is a run of whole source lines.
//   - A slide never mixes two sections, so every slide has one header.
//   - Continuation chunks repeat the header and are marked `continued`.
//   - A single line that cannot fit even alone is kept on its own slide with `overflow: true`,
//     so nothing is dropped silently and the caller can report it.
//
// Box selection: the box can differ per slide (the first slide has the title, and headers take space).
// Pass either a fixed box { w, h } or a function boxFor(slideIndex, hasHeader) returning one.
//
// Packing uses binary search. Whether lines[start..end) fits is monotone in end, because adding
// lines never makes the block shorter. So each chunk costs O(log n) fit checks, not O(n).

const BlockSplit = (() => {
  const BF = typeof BlockFit !== "undefined" ? BlockFit : require("./fit.js");

  // Accept a fixed box or a per-slide function. Always returns a function.
  function asBoxFor(boxOrFn) {
    return typeof boxOrFn === "function" ? boxOrFn : () => boxOrFn;
  }

  // Greedy packing of one section's lines into chunks that each fit.
  // boxAt(chunkIndex) gives the box for the chunk at that position.
  // Returns [{ lines, fit, overflow }].
  function packLines(lines, measurer, boxAt) {
    const getBox = asBoxFor(boxAt);
    const chunks = [];
    const n = lines.length;
    const fitRange = (s, e) => BF.fitBlock(lines.slice(s, e), measurer, getBox(chunks.length));

    let start = 0;
    while (start < n) {
      const single = fitRange(start, start + 1);
      if (!single.fits) {
        // Even alone, this line does not fit. Keep it and flag it.
        chunks.push({ lines: [lines[start]], fit: single, overflow: true });
        start += 1;
        continue;
      }

      // Largest end in [start+1, n] such that lines[start..end) fits. lo always fits.
      let lo = start + 1;
      let hi = n;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (fitRange(start, mid).fits) lo = mid;
        else hi = mid - 1;
      }

      const fit = fitRange(start, lo);
      chunks.push({ lines: lines.slice(start, lo), fit, overflow: false });
      start = lo;
    }
    return chunks;
  }

  // sections: [{ header: string|null, lines: string[] }]
  // boxFor: fixed box, or function(slideIndex, hasHeader) -> box.
  // Returns { slides, overflowCount }, where each slide is
  //   { header, lines, fit, overflow, continued }.
  function splitSections(sections, measurer, boxFor) {
    const getBox = asBoxFor(boxFor);
    const slides = [];

    for (const section of sections) {
      const lines = section.lines;
      if (lines.length === 0) continue;
      const hasHeader = section.header !== null && section.header !== undefined;
      const base = slides.length;
      const boxAt = (chunkIndex) => getBox(base + chunkIndex, hasHeader);

      const whole = BF.fitBlock(lines, measurer, boxAt(0));
      if (whole.fits) {
        slides.push({ header: section.header, lines, fit: whole, overflow: false, continued: false });
        continue;
      }

      const chunks = packLines(lines, measurer, boxAt);
      chunks.forEach((c, i) => {
        slides.push({
          header: section.header,
          lines: c.lines,
          fit: c.fit,
          overflow: c.overflow,
          continued: i > 0
        });
      });
    }

    const overflowCount = slides.filter((s) => s.overflow).length;
    return { slides, overflowCount };
  }

  return { splitSections, packLines, asBoxFor };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = BlockSplit;
}
