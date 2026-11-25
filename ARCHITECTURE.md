# Architecture

StandardNotes Milkdown is a static single-page app (React, Vite, TypeScript) that Standard Notes
loads in an iframe as an editor component. It has no server and no backend of its own. Decisions
behind it are in [`docs/adr/`](docs/adr/).

## Components and data flow

- **Editor** ([`src/components/Editor.tsx`](src/components/Editor.tsx)) owns the note text. It
  creates the `@standardnotes/editor-kit` relay, which talks to the host with `postMessage`.
  Nothing is rendered until the host streams the note in (a status message appears after 5
  seconds without one). The editor-kit delivers the note through `setEditorRawText` and the user's
  edits go back through `onEditorValueChanged`, coalesced by the kit (350 ms).
- **Echo guard** ([`src/lib/echoGuard.ts`](src/lib/echoGuard.ts)): the host may hand a save back
  late. The guard keeps a length and FNV-1a fingerprint of each save of the open note for 60
  seconds and drops a returning text that is an earlier save, or only spells the current one
  differently, so typing is never reverted. Other text (remote edit, other note) passes.
- **sentMessages release** ([`src/lib/sentMessages.ts`](src/lib/sentMessages.ts)): the relay
  keeps every message it sent, each `save-items` with a copy of the whole note. Before a new save
  the payloads of earlier ones are emptied, so a long session does not leak memory.
- **MilkdownEditor** ([`src/components/MilkdownEditor.tsx`](src/components/MilkdownEditor.tsx))
  is the layout shell: mode (visual, split, source), orientation, outline, search, export. Layout
  preferences are stored in the component data of the host, with `localStorage` as a fallback
  ([`src/lib/layout.ts`](src/lib/layout.ts)). **ModeSwitcher**
  ([`src/components/ModeSwitcher.tsx`](src/components/ModeSwitcher.tsx)) is the icon bar that
  changes them and triggers copy, print and export.
- **CrepeView** ([`src/components/CrepeView.tsx`](src/components/CrepeView.tsx)) owns the Milkdown
  Crepe instance, built by [`src/lib/crepe.ts`](src/lib/crepe.ts) from the Crepe features in use
  (no AI feature) plus plugins of this project: frontmatter, syntax preservation, TOC, active
  block, search. The instance is recreated on note switch, so undo never reaches another note.
  User edits flow up through `onTextChange`; external text (note switch, remote sync, source
  edit) is applied with `replaceAll` under a suppress flag, so it is never saved back.
- **SourceView** ([`src/components/SourceView.tsx`](src/components/SourceView.tsx)) is a slim
  CodeMirror 6 pane over the same text with the same sync contract. Embedded image data is
  displayed as `[image data]` and left untouched in the document.
- **Images** ([`src/lib/image.ts`](src/lib/image.ts)): uploads, pastes and drops become data
  URIs in the note. Images over 500 KB (as a data URI) are scaled and recompressed, a note may
  carry about 5 MB of them, and an SVG is rasterized, never stored. `safeImageSrc` is the filter
  for every image address.
- **Mermaid and KaTeX** load lazily. KaTeX is a separate chunk requested at startup
  (`loadLatex` in `crepe.ts`); Mermaid ([`src/lib/mermaid.ts`](src/lib/mermaid.ts)) is imported
  the first time a note has a `mermaid` block, with `securityLevel: 'strict'`, a render queue and
  a redraw when the app theme changes. A failed chunk load is retried on the next use.
- **Export and print**: [`src/lib/exportHtml.ts`](src/lib/exportHtml.ts) serializes the rendered
  document to a standalone page, sanitizes it with DOMPurify, adds its own CSP and downloads it
  as a Blob ([`src/lib/download.ts`](src/lib/download.ts)). Print calls `window.print()` of the
  iframe, with print styles showing only the rendered note.
- **Notes list preview** ([`src/lib/preview.ts`](src/lib/preview.ts)): the plain-text preview
  handed to the host, bounded to the first 2000 characters after images are removed.

## Trust boundaries

1. **Standard Notes host to plugin iframe**: messages cross by `postMessage` through the
   editor-kit relay. The host owns encryption, sync and the account; the plugin never sees keys
   or credentials. This project does not re-implement the relay.
2. **Note content to the renderer**: the Markdown of a note is untrusted input (it may come from
   an import or a synced device). It reaches the Milkdown schema, the Mermaid renderer, the image
   filter and the HTML export, each of which is described in the assurance case of
   [SECURITY.md](SECURITY.md#assurance-case).
3. **Plugin origin to the network**: the built page carries a Content Security Policy (scripts
   and connections only from the plugin's origin, see [ADR 0005](docs/adr/0005-content-security-policy.md)
   and [`vite.config.ts`](vite.config.ts)). The only remote content loaded is images a note links
   by URL.
4. **Static hosting**: the build is plain files on GitHub Pages and in `extension.zip`; there is
   no server-side code to attack.

## Key properties

- The note remains plain Markdown; nothing is stored outside it.
- Opening a note never saves it; saves happen only after an edit.
- If the visual editor fails, [`ErrorBoundary`](src/components/ErrorBoundary.tsx) shows the raw
  text in an editable area, and edits are still saved.
- No telemetry and no network access of its own.

## Performance

What runs on every key should cost as much as what changed, not as much as the note.

- **Decorations.** Callouts and wiki links are redrawn for the changed top level blocks only
  (`redecorate` in [`src/lib/markdownSyntax.ts`](src/lib/markdownSyntax.ts)). The table of
  contents reads each unedited block once and is redrawn only when a heading or a marker changes
  ([`src/lib/toc.ts`](src/lib/toc.ts)). Property tests compare both with a redraw of the whole
  document ([`src/lib/decorations.test.ts`](src/lib/decorations.test.ts)).
- **Word counts.** A selection counts the selected text. The document is counted once per pause,
  on the `updated` event Milkdown delays by 200 ms.
- **Rendering.** What changes while typing (word counts, headings) lives in small stores
  ([`src/lib/store.ts`](src/lib/store.ts)) read by the counter and the outline alone; the panes
  and bars are memoized. A test counts the renders.
- **Caret.** The browser's own ([ADR 0007](docs/adr/0007-native-caret.md)).
- **Saving.** Milkdown serializes the whole document after each pause. The schema types are kept
  in objects that are quick to copy ([`src/lib/crepe.ts`](src/lib/crepe.ts)), and embedded image
  data is written without escaping ([`src/lib/imageMarkdown.ts`](src/lib/imageMarkdown.ts)).

### Measured and left as it is

- **Blur behind the floating bars.** `backdrop-filter` showed no difference with software
  rendering. On a desktop GPU, scrolling was the same with and without it. The selection toolbar
  took 0.4 to 5 ms more GPU time per step over three runs; its frames were not timed. Weak GPUs
  were not measured, and touch devices already get opaque surfaces.
- **KaTeX at boot.** The editor waits for the LaTeX chunk, because the math nodes are part of the
  schema: without them a note with math would not open as it was written, and adding them later
  means creating the editor again. The wait was close to 0 ms on a local server, about 60 ms on a
  fast 4G profile and 350 ms on a slow one, on the first load only.

### Known costs

- The serialization after a pause is one task of about 70 ms on a 50k character note and 200 ms
  on a 200k one. Most of it is in Milkdown and remark.
- Arrow keys that move the cursor into or out of a code block recalculate the style of the whole
  page, with tasks of up to 150 ms on a 50k character note. The cause is not isolated yet.
- The editor-kit copies the whole note for every save, about 45 ms with 5 MB of images.

### Budget

`npm run perf` ([`e2e/perf.spec.js`](e2e/perf.spec.js)) fails, and so does its CI job, a required
check of `main`, when typing in the 50k character note goes over any of these:

| Metric                               | Limit  | CI runners  | Desktop     | Desktop, before the budget |
| ------------------------------------ | ------ | ----------- | ----------- | -------------------------- |
| Keydown to paint, 95th percentile    | 50 ms  | 19 to 23 ms | 23 ms       | 39 ms                      |
| Main thread time per key             | 28 ms  | 13 to 20 ms | 20 to 23 ms | 55 ms                      |
| Longest task while typing and pauses | 150 ms | up to 50 ms | 68 to 76 ms | 91 ms                      |

The CI numbers are of two runs on different processors. Main thread time per key is the limit that
catches a regression: it is 1.4 to 2 times the runners', and scaled by the same ratios the editor
before the budget would take 36 to 55 ms there. The other two only catch large ones. A frame at
60 Hz is already 16 ms, and a 5k note takes 15 ms from keydown to paint, so a tighter paint limit
would measure the screen and not the editor. A limit of 50 ms per task is out of reach while a
pause serializes the whole note in one task. A runner slower than these may go over the budget
with nothing wrong; look at the numbers of `main` before blaming a change.

## Build and release pipeline

`npm run build` (Vite, output in `build/`) also writes `THIRD_PARTY_LICENSES.md` and the CSP meta
tag. CI ([`ci.yml`](.github/workflows/ci.yml)) runs lockfile check, `npm ci`, typecheck, lint,
format check, unit tests, build, build content check and `npm audit` on Node 22 and 24, plus the
Playwright e2e suite against a fake Standard Notes host (`e2e/snHost.js`) and the latency
benchmark. A pushed `v*` tag
starts [`release.yml`](.github/workflows/release.yml): it requires green CI for the commit,
rebuilds, packs `extension.zip`, writes `SHA256SUMS`, attests the build provenance, creates the
release and publishes the build to the `gh-pages` branch, which GitHub Pages serves at the URL
in `ext.json`. See [Releases](README.md#releases) for the maintainer steps.
