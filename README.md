# StandardNotes-Milkdown

A WYSIWYG Markdown editor for [Standard Notes](https://standardnotes.com), powered by
[Milkdown Crepe](https://milkdown.dev). Notes stay plain, portable Markdown; the plugin
only changes how you edit them.

## Features

- **Visual editing**: the whole Markdown feature set (tables, code blocks with syntax
  highlighting, todo lists, links, images, blockquotes) without seeing the source.
- **Split view**: the Markdown source next to the visual editor, side by side or
  stacked, with the choice persisted per browser.
- **Source mode**: a plain CodeMirror pane for fine grained edits.
- **Fixed formatting bar**: the Crepe top bar, on/off and top/bottom, your choice.
- **Follows the app theme**: the Crepe palette is mapped onto the Standard Notes
  StyleKit, so light and dark follow the app with no detection.
- **Mobile ready**: single column layout on narrow screens, and a bootstrap that
  survives slow mobile WebViews.

## Data format

The note is Markdown, in the same dialect the [VS Code REST Client / commonmark + GFM]
world uses. Nothing is stored outside the note: open the same note with the built in
editor and the content is identical.

## Install

Download the [latest extension.zip](https://github.com/Esl1h/StandardNotes-Milkdown/releases/latest/download/extension.zip)
and add it in Standard Notes via *Advanced options → Install external extension*,
pointing to the
[ext.json](https://esli.cafe/StandardNotes-Milkdown/ext.json) URL.

## Development

```bash
npm ci
npm start        # dev server on :3002 (install as a dev extension in SN)
npm test         # unit tests (vitest)
npm run e2e      # end to end against the build, incl. the fake Standard Notes host
npm run typecheck && npm run lint && npm run build
```

The e2e suite drives the plugin through a fake Standard Notes host (`e2e/snHost.js`),
including the throttled mobile registration scenario and the opaque-origin mobile app
case.

## Releases

Tags (`v*`) trigger the release workflow: it builds, packs `extension.zip`, publishes
the GitHub release and deploys the build to the `gh-pages` branch. `package.json` and
`public/ext.json` must carry the tag's version.

## License

AGPL-3.0-or-later. Milkdown is MIT.
