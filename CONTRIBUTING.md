# Contributing to StandardNotes Milkdown

Thanks for helping out. This is a small, focused editor: a WYSIWYG Markdown
editor for Standard Notes, powered by Milkdown Crepe, that keeps the note
as plain Markdown.

## Development setup

```
git clone https://github.com/Esl1h/StandardNotes-Milkdown.git
cd StandardNotes-Milkdown
npm install
npm start
```

`npm start` runs the dev server at `http://localhost:3002`.

To test inside your Standard Notes app:

```
npm run build
npm run server-cors
```

Then install `http://localhost:3000/ext.dev.json` via Preferences > Plugins
(dev extension, separate identifier).

## Before opening a PR

1. `npm run typecheck`
2. `npm run lint`
3. `npm test`
4. `npm run build`
5. `npm run e2e` (run `npx playwright install chromium` once first)

All five must pass. CI runs the same steps.

## Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org/): one
logical change per commit, subject in the imperative mood, body explaining
the why when the what is not enough.

## Scope guidance

The note stays plain Markdown, round trippable with any other editor.
Features that store data outside the note, change the Markdown dialect
incompatibly, or add network access (no AI providers) do not fit the
project.
