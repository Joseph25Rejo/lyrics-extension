// Text measurement (Phase 2).
// Measures text width in points for a font, word-wraps lines to a box width, and estimates block height.
// No DOM access at load time, so Node tests can inject a fake width function.
//
// Approach: measure once at a reference size (REF_PX), cache the result, and scale linearly to any size.
// Glyph advances scale linearly with font size, so this is accurate and avoids re-measuring per size.

const TextMeasure = (() => {
  const LayoutModule = typeof Layout !== "undefined" ? Layout : require("./layout.js");

  const REF_PX = 100;          // reference font size used for all raw measurements
  const LINE_FACTOR = LayoutModule.LYRIC.lineFactor; // line height as a multiple of font size
  const CACHE_LIMIT = 20000;   // bound memory; the cache is cleared when it fills up
  const FALLBACK_FAMILY = "monospace";

  // Build a measurer around a raw width function: rawWidth(text) -> width in px at REF_PX.
  function createMeasurer(rawWidth) {
    const cache = new Map();
    let hits = 0;
    let misses = 0;

    function refWidth(text) {
      const cached = cache.get(text);
      if (cached !== undefined) {
        hits++;
        return cached;
      }
      misses++;
      const w = rawWidth(text);
      if (cache.size >= CACHE_LIMIT) cache.clear();
      cache.set(text, w);
      return w;
    }

    // Width in points of text at sizePt.
    function width(text, sizePt) {
      return refWidth(text) * (sizePt / REF_PX);
    }

    // Height in points of `lineCount` lines at sizePt.
    function blockHeight(lineCount, sizePt) {
      return lineCount * sizePt * LINE_FACTOR;
    }

    // Split one word that is wider than the limit into pieces that fit, by code point.
    // A single code point wider than the limit is kept on its own; the caller is told via tooNarrow.
    function breakWord(word, limitRef, state) {
      const pieces = [];
      let cur = "";
      for (const ch of word) {
        const cand = cur + ch;
        if (cur === "" || refWidth(cand) <= limitRef) {
          if (cur === "" && refWidth(ch) > limitRef) state.tooNarrow = true;
          cur = cand;
        } else {
          pieces.push(cur);
          cur = ch;
          if (refWidth(ch) > limitRef) state.tooNarrow = true;
        }
      }
      if (cur) pieces.push(cur);
      return pieces;
    }

    // Greedy word wrap of `text` to maxWidthPt at sizePt.
    // Returns { lines, tooNarrow }. tooNarrow means some character alone does not fit the width.
    function wrap(text, sizePt, maxWidthPt) {
      const state = { tooNarrow: false };
      const words = String(text).split(" ").filter((w) => w.length > 0);
      if (words.length === 0) return { lines: [], tooNarrow: false };

      const scale = sizePt / REF_PX;
      const limitRef = maxWidthPt / scale; // compare in reference px to avoid per-candidate scaling

      const lines = [];
      let line = "";
      for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (refWidth(candidate) <= limitRef) {
          line = candidate;
          continue;
        }
        if (line) {
          lines.push(line);
          line = "";
        }
        if (refWidth(word) <= limitRef) {
          line = word;
          continue;
        }
        const pieces = breakWord(word, limitRef, state);
        lines.push(...pieces.slice(0, -1));
        line = pieces[pieces.length - 1];
      }
      if (line) lines.push(line);
      return { lines, tooNarrow: state.tooNarrow };
    }

    return {
      width,
      wrap,
      blockHeight,
      stats: () => ({ hits, misses, cached: cache.size }),
      clear: () => { cache.clear(); hits = 0; misses = 0; }
    };
  }

  // Canvas-backed raw width function for a font family (browser only).
  function canvasRawWidth(family) {
    const canvas = typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(1, 1)
      : document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    ctx.font = `${REF_PX}px "${family}", ${FALLBACK_FAMILY}`;
    return (text) => ctx.measureText(text).width;
  }

  // True if `family` is really installed. A missing family silently falls back to the monospace
  // font, so we compare widths against the fallback alone. `ctx` is a 2D context (injectable for tests).
  function isFontInstalled(family, ctx) {
    const sample = "mmmmmmmmmlli WWW iiiii 0123456789 ";
    ctx.font = `${REF_PX}px ${FALLBACK_FAMILY}`;
    const base = ctx.measureText(sample).width;
    ctx.font = `${REF_PX}px "${family}", ${FALLBACK_FAMILY}`;
    const test = ctx.measureText(sample).width;
    return Math.abs(test - base) > 0.5;
  }

  return { createMeasurer, canvasRawWidth, isFontInstalled, REF_PX, LINE_FACTOR };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = TextMeasure;
}
