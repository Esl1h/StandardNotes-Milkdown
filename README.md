# StandardNotes Milkdown

[![CI](https://github.com/Esl1h/StandardNotes-Milkdown/actions/workflows/ci.yml/badge.svg)](https://github.com/Esl1h/StandardNotes-Milkdown/actions/workflows/ci.yml)
[![CodeQL](https://github.com/Esl1h/StandardNotes-Milkdown/actions/workflows/github-code-scanning/codeql/badge.svg)](https://github.com/Esl1h/StandardNotes-Milkdown/actions/workflows/github-code-scanning/codeql)
[![Coverage](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/Esl1h/StandardNotes-Milkdown/badges/coverage.json)](https://github.com/Esl1h/StandardNotes-Milkdown/actions/workflows/coverage.yml)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/Esl1h/StandardNotes-Milkdown/badge)](https://scorecard.dev/viewer/?uri=github.com/Esl1h/StandardNotes-Milkdown)
[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/15958/badge)](https://www.bestpractices.dev/projects/15958)
[![Release](https://img.shields.io/github/v/release/Esl1h/StandardNotes-Milkdown)](https://github.com/Esl1h/StandardNotes-Milkdown/releases/latest)
[![License](https://img.shields.io/github/license/Esl1h/StandardNotes-Milkdown)](LICENSE)

A WYSIWYG Markdown editor for [Standard Notes](https://standardnotes.com), a
free, open-source, end-to-end encrypted notes app, powered by
[Milkdown Crepe](https://milkdown.dev). Notes stay plain Markdown inside the
note, so they remain readable, searchable, exportable and portable; the
plugin only changes how you edit them.

![Milkdown editor running inside Standard Notes](.github/screenshots/milkdown-app.png)

## Features

1. Visual editing of the whole Markdown feature set without seeing the
   source: headings, lists, todo lists, tables, links, images, blockquotes
   and code blocks with syntax highlighting
2. A floating toolbar on the selection, a `/` slash menu and drag handles
   to add and move blocks. A focus mode button in the icon bar dims every
   block but the one with the cursor
3. Math with KaTeX: `$inline$` formulas and `$$` blocks
4. Diagrams: ` ```mermaid ` code blocks show a live preview of the diagram, while the note keeps its source; the diagrams follow a change of the app theme without reopening the note
5. Images uploaded, pasted or dropped are embedded in the note; large ones
   are scaled down so the note stays light
6. Three modes, switched from the icon bar at the top: **Visual**,
   **Split** (the Markdown source next to the visual editor, side by side
   or stacked) and **Source** (a plain CodeMirror pane for fine grained
   edits)
7. An optional fixed formatting bar, at the top or the bottom of the editor, with a word count and the reading time at its right end (`132 words · 1 min`, or `12 of 132 words` while text is selected)
8. **Copy as Markdown**, **Print** and **Export as HTML** buttons in the icon bar; printing shows only the rendered note, and the export saves it as a page of its own (light or dark by the system, named after the first heading; the front matter is left out and a diagram is saved as its code). Below 520 px of width these actions, and the formatting bar settings, move into a `...` menu
9. Find and replace (`Ctrl/Cmd+F` or the search button), with highlighted
   matches and a `2/7` count; source mode uses CodeMirror's own search
10. An outline of the note's headings in a side panel, to jump around long notes; headings inside quotes and lists are listed too
11. The icon bar floats at the top, centered, and folds away with the `>`
    button at its right end, leaving only a small `<` in the corner to
    bring it back. Layout choices
    are saved with the editor in your Standard Notes account
12. Opening a note never rewrites it: nothing is saved until you edit
13. Undo never reaches into the previously opened note
14. Works with the Standard Notes web, desktop and mobile apps; follows
    the theme selected in the app. On narrow screens the split view stacks
15. A new empty note shows an `Add sample` button that seeds it with a tour
    of what the editor can draw: front matter, a table of contents, lists
    and todos, the five alerts, a table, code, math, diagrams and an image
16. If the editor ever fails to render, the raw note text stays available
    and editable in a plain text area, and edits are still saved

## Screenshots

The icon bar folded away and the formatting bar at the bottom, leaving
only the note:

![Clean interface with the formatting bar at the bottom](.github/screenshots/milkdown-clean.png)

The `/` slash menu, for adding lists, images, code blocks, tables, math
and a table of contents:

![Slash menu](.github/screenshots/milkdown-slash-menu.png)

The Split mode, with the Markdown source next to the visual editor:

![Split mode with the Markdown source next to the visual editor](.github/screenshots/milkdown-split.png)

Math and Mermaid diagrams, drawn live while the note keeps their source:

![Math and Mermaid diagrams](.github/screenshots/milkdown-math-diagrams.png)

## Installation

1. Run the Standard Notes web or desktop app.
2. Click the **Preferences** (gear) icon.
3. Select **Plugins** in the Preferences menu.
4. Scroll to the bottom and paste this URL into the
   **Install Custom Plugin** box:

   ```
   https://esli.cafe/StandardNotes-Milkdown/ext.json
   ```

5. Confirm the installation.
6. Create a new note, open the **Editor** menu and pick **Milkdown**.

The app checks that URL for updates, so new releases arrive on their own.
Each [release](https://github.com/Esl1h/StandardNotes-Milkdown/releases/latest)
also carries the packaged build as `extension.zip`.

### Self-hosting

The hosted build is plain static files, so it can be served from anywhere. Unzip `extension.zip` from a release (or run `npm run build` and take `build/`), serve the files over HTTPS with CORS enabled, and change `url`, `download_url` and `latest_url` in `ext.json` to your host. Install your `ext.json` URL as above. To keep both the hosted and your copy installed, also change `identifier`.

## Verifying a release

Releases published from November 2026 on attach a `SHA256SUMS` file and a build provenance attestation next to `extension.zip`, the package the desktop app installs. To check a downloaded zip, run in the folder that holds both files:

```
sha256sum -c SHA256SUMS
gh attestation verify extension.zip -R Esl1h/StandardNotes-Milkdown
```

The second command confirms that the zip was built by this repository's release workflow from the tagged commit. Releases are immutable: once published, their tag and files cannot be changed.

## Note format

The note body is plain Markdown: CommonMark plus GitHub Flavored Markdown
(tables, task lists, strikethrough).

````markdown
# Shopping

- [x] bread
- [ ] coffee

| Item  | Price |
| ----- | ----- |
| bread | 2.50  |

> Everything stays in the note as plain text.

Energy: $E = mc^2$

```mermaid
graph LR
  Idea --> Draft --> Done
```
````

- Nothing is stored outside the note: open the same note with the built in
  editor and the content is identical
- Opening a note never changes it. The first edit rewrites the whole note in the shape the visual editor writes. What changes:
  - `*` list markers become `-`
  - reference links become inline links and the `[1]: url` definition goes away
  - a line break made of two trailing spaces becomes a backslash
  - setext headings (`Title` over `=====`) become `# Title`
  - a horizontal rule `---` becomes `***`
  - tables are padded with spaces and their alignment row is rewritten
  - a stray `*` is escaped (`5\*3`) and a bare URL gets angle brackets (`<https://...>`)
  - block HTML gets a blank line before its closing tag
- Footnotes, inline HTML, ordered lists that start at a number other than 1, inline math, `__bold__` and `_italic_`, front matter, wiki links and the `[TOC]` line are kept as written
- Images are either links (`![](https://...)`), loaded from their host,
  or embedded as data URIs when uploaded, pasted or dropped. Embedded
  images up to 500 KB go in as they are; larger ones are scaled down and
  recompressed, since the note syncs to every device
- Images keep their alt text and title when the note is edited. One limit: Crepe stores the resize ratio of an image in its alt text, so resizing an image that has alt text replaces the alt with the ratio (for example `![0.50](https://...)`)
- YAML front matter (between `---` fences), TOML front matter (between `+++` fences), GitHub alerts (`> [!NOTE]`, rendered as colored callouts) and `[[wiki links]]` are kept exactly as written, so notes imported from GitHub, Obsidian, Jekyll or Hugo are not rewritten
- A line that says only `[TOC]` is a table of contents: add it from the `/` menu (**Table of contents**) and the editor draws a live list of the headings under it, each one a link. The note keeps just the `[TOC]` line, which Typora, GitLab and other Markdown tools read the same way
- Math uses the `$...$` / `$$...$$` syntax and diagrams the ` ```mermaid `
  fence, both understood by GitHub, Obsidian and most Markdown tools

## Compatibility

- Standard Notes web app and desktop app (Windows, macOS, Linux)
- Standard Notes mobile apps (iOS and Android): on narrow screens the split view stacks and the bar actions move into a `...` menu, and the e2e suite drives the editor through a host with the mobile app's opaque origin and a throttled CPU
- Follows the theme selected in the app, light or dark, including the Mermaid diagrams
- The note stays plain Markdown, so the built in editor, other Markdown editors and tools such as GitHub and Obsidian read it as written

## Privacy and network

Everything is stored inside your Standard Notes note, so it is encrypted with the rest of your data. The editor has no telemetry, no AI features and no network access of its own: the only remote content it loads is images linked by URL in the note. Uploaded, pasted or dropped images are embedded in the note instead of being sent anywhere. Mermaid renders diagrams with its strict security level.

The page's Content Security Policy allows scripts and connections only from the plugin's own origin, and the HTML export carries a policy of its own that blocks scripts entirely.

## Development and running locally

**Prerequisites:**

1. (Optional) Fork this repo on GitHub.
2. [Clone](https://docs.github.com/en/repositories/creating-and-managing-repositories/cloning-a-repository)
   this repo or your fork.
3. Run `cd StandardNotes-Milkdown` and then `npm install` to install all
   dependencies.

### Testing inside your local Standard Notes app

The editor waits for Standard Notes to send the note, so it needs a host:
the Standard Notes app, or the fake host of the e2e suite.

1. Run `npm run build` to build the app, then:

```
npm run server-cors
```

2. In Standard Notes, follow the Installation steps above but paste:

```
http://localhost:3000/ext.dev.json
```

The dev extension uses a separate identifier (`Milkdown (Dev)`) so it does
not clash with the hosted one.

3. When you're done, press `Ctrl + C` to shut down the server.

If you run into issues, please refer to the
[Standard Notes instructions for local plugin setup](https://standardnotes.com/help/plugins/local-setup).

### Checks

CI runs these on every push and pull request; run them before opening a PR:

```
npm run typecheck       # TypeScript
npm run lint            # ESLint
npm run format:check    # Prettier
npm test                # unit and property tests (Vitest, fast-check)
npm run build           # production build
npm run check:build     # no unreferenced file in build/
npm run check:lockfile  # git dependencies only at the known commits
npm run e2e             # end to end tests (Playwright)
```

Run `npx playwright install chromium` once before the first `npm run e2e`. The e2e suite builds the plugin and drives it through a fake Standard Notes host (`e2e/snHost.js`), including a throttled CPU (slow mobile WebView) and the opaque origin of the mobile app.

Only the Crepe features in use are bundled (no AI): the main chunk is about 390 KB gzipped. KaTeX (about 80 KB gzipped) loads in its own chunk at startup, Mermaid only when a note has a diagram, and code block languages on demand.

### Releases

The extension is hosted on GitHub Pages from the `gh-pages` branch, served at `https://esli.cafe/StandardNotes-Milkdown/`. To cut a release:

1. On a branch, run `npm run version:bump X.Y.Z`, which writes the version to `package.json`, `package-lock.json`, `public/package.json`, `public/ext.json` (with its `download_url`) and `public/ext.dev.json`, then `npm run changelog -- --tag vX.Y.Z`, which adds the section for the new version to `CHANGELOG.md` from the commits since the last tag. Commit both as `chore(release): vX.Y.Z` and merge the pull request.
2. On `main`, push the tag:

```
git tag -a vX.Y.Z -m vX.Y.Z && git push origin vX.Y.Z
```

The `Release` workflow fails unless the tag matches every version file. It runs the checks, attaches `extension.zip` (the package the desktop app installs) with `SHA256SUMS` and a provenance attestation to the GitHub release, writes the release notes with git-cliff and publishes the hosted build to Pages. The app finds the update by comparing the version in the `ext.json` at `latest_url`.

## Credits and license

- Built on [Standard Notes](https://standardnotes.com),
  [@standardnotes/editor-kit](https://github.com/standardnotes/editor-kit)
  and [Milkdown](https://milkdown.dev) (MIT)
- Licensed under [AGPL-3.0](LICENSE) or later
