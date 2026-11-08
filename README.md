# Lyrics to Slides

A Chrome extension that turns text you paste in into a PowerPoint file. Each section of the text becomes one or more slides, with the text sized to fit.

It runs entirely in your browser. It makes no network requests and stores nothing except your draft text, which is kept in the extension's local storage so closing the popup doesn't lose it.

Only paste text you have the rights to use.

## Install

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and select this folder.
4. Pin the extension from the puzzle-piece menu if you want it on the toolbar.

After any change to the code, click the **reload** icon for the extension on `chrome://extensions`.

## Use

1. Open the popup and type a **title**. It appears once, on the first slide.
2. Paste the text into the **Lyrics** box, using this format:
   - A line in square brackets starts a new section and becomes its header, for example `[Verse 1]`.
   - A blank line ends a section.
   - Text after a tag on the same line becomes the first line of that section: `[Chorus] first line`.
3. Click **Build PPTX**. The status line shows the slide count and any notes.

## What the slides look like

- Black background, white text, all in **Aharoni**.
- Title: 54pt, dark-red (`#E57373`), on the first slide only. If it won't fit on one line, it drops in size to 36pt, then wraps.
- Section headers: 20pt yellow, shown above the lyrics. A header repeats on every slide that continues the section.
- Lyrics: 48pt, dropping in 2pt steps to 36pt as needed to fit.
- A section that is too long for one slide is split across slides at line boundaries. Lines are never cut in the middle.
- A continuation slide is never left with one line; the lines are rebalanced across the two slides.
- A line that is too long to fit even at 36pt is kept and reported in the status line.

## Notes and limits

- Aharoni ships with Microsoft Office, not Windows. If it's missing, the status line says fitting used a fallback font, and the slides may need manual adjustment in PowerPoint.
- Limits: 200,000 characters and 5,000 lines of input, a title of 120 characters.
- The fitter estimates line height at 1.2 times the font size. This has not been checked against PowerPoint's real spacing for Aharoni.

## Project layout

```
manifest.json        Chrome extension manifest (Manifest V3, storage permission only)
popup.html           The popup UI
popup.js             Builds the file: parse -> measure -> assemble -> render -> download
src/
  layout.js          All slide geometry and text styles (the one place to change them)
  parse.js           Parses pasted text into sections, with warnings
  measure.js         Measures text width (canvas, cached) and wraps lines
  fit.js             Finds the largest font size (48 to 36pt) that fits a block
  split.js           Splits a too-tall section into chunks that fit
  assemble.js        Title, header space, per-slide boxes, orphan rebalancing
  render.js          Draws the slides with PptxGenJS
lib/
  pptxgen.bundle.js  PptxGenJS 4.0.1, bundled locally (Manifest V3 forbids remote scripts)
tests/
  parse.test.js
  measure.test.js
  fit.test.js
  split.test.js
  assemble.test.js
  render.test.js
```

## Tests

The unit tests use Node's built-in test runner (Node 18 or newer). They don't need Chrome, and they use a fake text-width function so the results are exact.

Run them from the project folder:

```
node --test tests/parse.test.js tests/measure.test.js tests/fit.test.js tests/split.test.js tests/assemble.test.js tests/render.test.js
```

Pass the files explicitly. On this Node version, `node --test tests/` fails because it treats the folder as a module.

Syntax check the browser scripts:

```
node --check popup.js
```

## Changing the layout

All slide geometry and text styles live in `src/layout.js`. Every module reads from it, so change values there only:

- `CONTENT`, `LEFT`, `GAP`: the content width (centred on the slide), margins, and spacing.
- `TITLE`, `HEADER`, `LYRIC`: sizes, colours, alignment (all centred), and the 1.2 line factor.
- `FONT`, `BACKGROUND`, `TEXT_MARGIN`: the font, background colour, and text padding.

Every text box is centred: horizontally on the slide, with centred text, and vertically within its box.

If you change a size or colour, run the tests, since some assertions check the defaults.
