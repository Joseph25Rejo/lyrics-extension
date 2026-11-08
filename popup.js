// Lyrics to Slides: builds a .pptx from text the user pastes in.
// No network requests. The draft is kept in local extension storage so closing the popup doesn't lose it.
// Pipeline: parse (src/parse.js) -> measure (src/measure.js) -> assemble (src/assemble.js)
//           -> render (src/render.js) -> download via PptxGenJS.

const DRAFT_KEY = "lyricsDraft";

const $ = (id) => document.getElementById(id);
const statusEl = $("status");

function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.className = isError ? "error" : "";
}

// ---- Draft persistence ----
async function restoreDraft() {
  try {
    const { [DRAFT_KEY]: draft } = await chrome.storage.local.get(DRAFT_KEY);
    if (draft) {
      $("title").value = draft.title || "";
      $("lyrics").value = draft.text || "";
    }
  } catch {
    // Storage unavailable: start with an empty form.
  }
}

async function saveDraft() {
  try {
    await chrome.storage.local.set({
      [DRAFT_KEY]: { title: $("title").value, text: $("lyrics").value }
    });
  } catch {
    // Ignore: the form still works without saving.
  }
}

$("title").addEventListener("input", saveDraft);
$("lyrics").addEventListener("input", saveDraft);

// ---- Measurement ----
// Aharoni is a Windows font, so on other systems the browser falls back to another font and the
// measurements would be wrong. We check for it and say so in the status instead of failing silently.
function buildMeasurer() {
  const ctx = document.createElement("canvas").getContext("2d");
  const installed = TextMeasure.isFontInstalled("Aharoni", ctx);
  const measurer = TextMeasure.createMeasurer(TextMeasure.canvasRawWidth("Aharoni"));
  return { measurer, installed };
}

// ---- Building ----
$("build").addEventListener("click", async () => {
  const parsed = LyricsParser.parse($("lyrics").value, { title: $("title").value });
  if (!parsed.ok) return setStatus(parsed.error, true);

  const btn = $("build");
  btn.disabled = true;
  setStatus("Building...");
  try {
    const { measurer, installed } = buildMeasurer();
    const assembled = SlideAssembly.assemble(parsed.sections, parsed.title, measurer);

    const pptx = DeckRender.render(assembled, new PptxGenJS());
    await pptx.writeFile({ fileName: `${safeFileName(parsed.title)}.pptx` });

    const notes = [...parsed.warnings, ...assembled.warnings];
    if (!installed) {
      notes.push("Aharoni is not installed on this computer, so fitting used a fallback font. Check the slides in PowerPoint.");
    }
    const count = assembled.slides.length;
    const summary = `Downloaded: ${safeFileName(parsed.title)}.pptx (${count} slide${count === 1 ? "" : "s"}).`;
    setStatus(notes.length ? `${summary} Notes: ${notes.join(" ")}` : summary, assembled.overflowCount > 0);
  } catch (err) {
    setStatus(`Could not build the file: ${err.message}`, true);
  } finally {
    btn.disabled = false;
  }
});

function safeFileName(name) {
  return name.replace(/[\\/:*?"<>|]+/g, "_").slice(0, 80) || "lyrics";
}

restoreDraft();
