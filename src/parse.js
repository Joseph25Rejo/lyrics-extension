// Lyrics parser (Phase 1).
// Pure logic: no DOM, no network, no storage. Works in the browser (global) and in Node (module.exports).
//
// Input:  raw text pasted by the user, plus an optional title.
// Output: { ok, title, sections, warnings, stats } or { ok: false, error, warnings }.
//   sections: [{ header: string|null, lines: [{ text, src }] }]
//   src is the 1-based line number in the original input, for error reporting.
//
// Rules:
//   - A blank line ends the current section.
//   - A line like "[Tag]" starts a new section with that header.
//     "[Tag] some text" starts a section and makes "some text" its first line.
//   - Text before any tag goes into a section with header null.

const LyricsParser = (() => {
  const MAX_CHARS = 200000;      // refuse absurdly large input so the popup doesn't freeze
  const MAX_LINES = 5000;
  const MAX_TAG_LENGTH = 60;     // longer bracketed text is treated as a lyric line
  const MAX_LINE_LENGTH = 300;   // longer lines are kept but reported (they will need splitting)
  const MAX_TITLE_LENGTH = 120;
  const DEFAULT_TITLE = "Untitled";

  // Characters that look like spaces or are invisible but break layout or measurement.
  const INVISIBLE = /[­​-‍⁠﻿]/g;          // soft hyphen, zero-width chars, word joiner, BOM
  const SPACE_LIKE = /[\t   -   　]/g; // tabs, NBSP and other Unicode spaces
  const LINE_BREAK = /\r\n|\r|\n|\u2028|\u2029/;                     // CRLF, CR, LF, line/paragraph separators
  const TAG_LINE = /^\[([^\[\]]*)\](.*)$/;

  function cleanText(s) {
    return s
      .normalize("NFC")
      .replace(INVISIBLE, "")
      .replace(SPACE_LIKE, " ")
      .replace(/ {2,}/g, " ")
      .trim();
  }

  function fail(error, warnings = []) {
    return { ok: false, error, warnings };
  }

  function parse(input, options = {}) {
    const warnings = [];

    if (typeof input !== "string") return fail("Lyrics must be text.");
    if (input.length > MAX_CHARS) {
      return fail(`Too much text (${input.length} characters). The limit is ${MAX_CHARS}.`);
    }

    // ---- Title ----
    let title = cleanText(typeof options.title === "string" ? options.title : "");
    if (!title) {
      title = DEFAULT_TITLE;
      warnings.push("No title given, so the title is \"Untitled\".");
    } else if (title.length > MAX_TITLE_LENGTH) {
      title = title.slice(0, MAX_TITLE_LENGTH).trimEnd();
      warnings.push(`Title was cut to ${MAX_TITLE_LENGTH} characters.`);
    }

    // ---- Split lines ----
    const text = input.replace(/^﻿/, "");
    const rawLines = text.split(LINE_BREAK);
    if (rawLines.length > MAX_LINES) {
      return fail(`Too many lines (${rawLines.length}). The limit is ${MAX_LINES}.`);
    }

    // ---- Walk the lines ----
    const sections = [];
    let current = null; // the section currently receiving lines; null after a blank line

    const newSection = (header) => {
      current = { header, lines: [] };
      sections.push(current);
    };

    const addLine = (text, src) => {
      if (!current) newSection(null);
      if (text.length > MAX_LINE_LENGTH) {
        warnings.push(`Line ${src} is ${text.length} characters long. It may need to be split.`);
      }
      current.lines.push({ text, src });
    };

    rawLines.forEach((raw, index) => {
      const src = index + 1;
      const line = cleanText(raw);

      if (line === "") {
        current = null; // blank line ends the section
        return;
      }

      const tag = line.match(TAG_LINE);
      if (tag) {
        const name = cleanText(tag[1]);
        if (!name) {
          warnings.push(`Line ${src} has an empty [] tag, so it was kept as text.`);
          addLine(line, src);
          return;
        }
        if (name.length > MAX_TAG_LENGTH) {
          warnings.push(`Line ${src} is a long bracketed line, so it was kept as text.`);
          addLine(line, src);
          return;
        }
        newSection(name);
        const rest = cleanText(tag[2]);
        if (rest) addLine(rest, src);
        return;
      }

      addLine(line, src);
    });

    // ---- Clean up ----
    const kept = [];
    for (const s of sections) {
      if (s.lines.length === 0) {
        if (s.header) warnings.push(`Section "${s.header}" has no lyrics, so it was skipped.`);
        continue;
      }
      kept.push(s);
    }

    if (kept.length === 0) {
      return fail("No lyric text found. Paste some lyrics first.", warnings);
    }

    let lineCount = 0;
    let longest = 0;
    for (const s of kept) {
      lineCount += s.lines.length;
      for (const l of s.lines) longest = Math.max(longest, l.text.length);
    }

    return {
      ok: true,
      title,
      sections: kept,
      warnings,
      stats: { sections: kept.length, lines: lineCount, longestLine: longest }
    };
  }

  return { parse, cleanText, MAX_CHARS, MAX_LINES };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = LyricsParser;
}
