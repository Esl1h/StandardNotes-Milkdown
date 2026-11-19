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

## Build and release pipeline

`npm run build` (Vite, output in `build/`) also writes `THIRD_PARTY_LICENSES.md` and the CSP meta
tag. CI ([`ci.yml`](.github/workflows/ci.yml)) runs lockfile check, `npm ci`, typecheck, lint,
format check, unit tests, build, build content check and `npm audit` on Node 22 and 24, plus the
Playwright e2e suite against a fake Standard Notes host (`e2e/snHost.js`). A pushed `v*` tag
starts [`release.yml`](.github/workflows/release.yml): it requires green CI for the commit,
rebuilds, packs `extension.zip`, writes `SHA256SUMS`, attests the build provenance, creates the
release and publishes the build to the `gh-pages` branch, which GitHub Pages serves at the URL
in `ext.json`. See [Releases](README.md#releases) for the maintainer steps.
