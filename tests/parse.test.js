// Run with: node --test tests/
// Uses placeholder text only.

const test = require("node:test");
const assert = require("node:assert/strict");
const { parse } = require("../src/parse.js");

const texts = (result) => result.sections.map((s) => s.lines.map((l) => l.text));
const headers = (result) => result.sections.map((s) => s.header);

test("empty and whitespace-only input is an error", () => {
  assert.equal(parse("").ok, false);
  assert.equal(parse("   \n\t\n  ").ok, false);
});

test("non-string input is an error", () => {
  assert.equal(parse(null).ok, false);
  assert.equal(parse(42).ok, false);
});

test("oversized input is rejected", () => {
  const r = parse("a".repeat(200001));
  assert.equal(r.ok, false);
  assert.match(r.error, /Too much text/);
});

test("too many lines is rejected", () => {
  const r = parse("a\n".repeat(5001));
  assert.equal(r.ok, false);
  assert.match(r.error, /Too many lines/);
});

test("tags split sections and blank lines end them", () => {
  const r = parse("[Verse 1]\nalpha\nbeta\n\n[Chorus]\ngamma\n");
  assert.equal(r.ok, true);
  assert.deepEqual(headers(r), ["Verse 1", "Chorus"]);
  assert.deepEqual(texts(r), [["alpha", "beta"], ["gamma"]]);
});

test("untagged text before the first tag gets a null header", () => {
  const r = parse("alpha\nbeta\n[Chorus]\ngamma");
  assert.equal(r.ok, true);
  assert.deepEqual(headers(r), [null, "Chorus"]);
});

test("a blank line starts an untagged section", () => {
  const r = parse("alpha\n\nbeta");
  assert.deepEqual(headers(r), [null, null]);
  assert.deepEqual(texts(r), [["alpha"], ["beta"]]);
});

test("CRLF, CR and LF give identical results", () => {
  const lf = parse("[A]\nx\ny\n\n[B]\nz");
  const crlf = parse("[A]\r\nx\r\ny\r\n\r\n[B]\r\nz");
  const cr = parse("[A]\rx\ry\r\r[B]\rz");
  assert.deepEqual(crlf.sections, lf.sections);
  assert.deepEqual(cr.sections, lf.sections);
});

test("BOM and zero-width characters are removed", () => {
  const r = parse("﻿[A]\nal​pha­\n");
  assert.equal(r.ok, true);
  assert.equal(r.sections[0].lines[0].text, "alpha");
});

test("tabs, non-breaking spaces and repeated spaces are normalized", () => {
  const r = parse("\talpha  beta   gamma\t");
  assert.equal(r.sections[0].lines[0].text, "alpha beta gamma");
});

test("decomposed and composed accents compare equal after NFC", () => {
  const composed = parse("café");
  const decomposed = parse("café");
  assert.equal(composed.sections[0].lines[0].text, decomposed.sections[0].lines[0].text);
});

test("a tag with text after it makes that text the first line", () => {
  const r = parse("[Chorus] alpha\nbeta");
  assert.deepEqual(headers(r), ["Chorus"]);
  assert.deepEqual(texts(r), [["alpha", "beta"]]);
});

test("tag whitespace is trimmed", () => {
  const r = parse("[   Verse 2   ]\nalpha");
  assert.equal(r.sections[0].header, "Verse 2");
});

test("an empty [] tag is kept as text with a warning", () => {
  const r = parse("[]\nalpha");
  assert.equal(r.ok, true);
  assert.deepEqual(texts(r), [["[]", "alpha"]]);
  assert.ok(r.warnings.some((w) => /empty \[\] tag/.test(w)));
});

test("a very long bracketed line is kept as text with a warning", () => {
  const long = "[" + "x".repeat(61) + "]";
  const r = parse(`${long}\nalpha`);
  assert.equal(r.sections[0].header, null);
  assert.equal(r.sections[0].lines[0].text, long);
  assert.ok(r.warnings.some((w) => /long bracketed line/.test(w)));
});

test("a header with no lyrics is skipped with a warning", () => {
  const r = parse("[Intro]\n\n[Verse]\nalpha");
  assert.equal(r.ok, true);
  assert.deepEqual(headers(r), ["Verse"]);
  assert.ok(r.warnings.some((w) => /"Intro" has no lyrics/.test(w)));
});

test("only empty headers is an error", () => {
  const r = parse("[Intro]\n\n[Outro]");
  assert.equal(r.ok, false);
});

test("multiple blank lines collapse into one section break", () => {
  const r = parse("alpha\n\n\n\nbeta");
  assert.equal(r.sections.length, 2);
});

test("line numbers point at the original input", () => {
  const r = parse("\n\n[A]\n\nalpha");
  assert.equal(r.sections[0].lines[0].src, 5);
});

test("lines containing only invisible characters are dropped", () => {
  const r = parse("alpha\n​​\nbeta");
  assert.deepEqual(texts(r), [["alpha"], ["beta"]]);
});

test("a very long lyric line is kept with a warning", () => {
  const r = parse("y".repeat(301));
  assert.equal(r.sections[0].lines[0].text.length, 301);
  assert.ok(r.warnings.some((w) => /may need to be split/.test(w)));
});

test("title defaults to Untitled with a warning", () => {
  const r = parse("alpha");
  assert.equal(r.title, "Untitled");
  assert.ok(r.warnings.some((w) => /Untitled/.test(w)));
});

test("title is cleaned and trimmed", () => {
  const r = parse("alpha", { title: "  My\tSong  " });
  assert.equal(r.title, "My Song");
});

test("long titles are cut with a warning", () => {
  const r = parse("alpha", { title: "t".repeat(130) });
  assert.equal(r.title.length, 120);
  assert.ok(r.warnings.some((w) => /cut to 120/.test(w)));
});

test("stats report sections, lines and the longest line", () => {
  const r = parse("[A]\nabc\nde\n\n[B]\nf");
  assert.deepEqual(r.stats, { sections: 2, lines: 3, longestLine: 3 });
});
