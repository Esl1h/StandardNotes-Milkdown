# Security Policy

## Supported versions

Only the [latest release](https://github.com/Esl1h/StandardNotes-Milkdown/releases/latest)
receives security fixes.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting (Security tab > Report a
vulnerability) instead of opening a public issue. Please include the
affected version and, if possible, the note content that triggers the
problem.

## Responding to reports

The maintainer ([@Esl1h](https://github.com/Esl1h)) handles every report:

- A report is acknowledged within 7 days.
- Within 60 days the report is either fixed or answered with an explanation (for example, why it
  is out of scope or not exploitable), and the reporter is told which.
- A fix comes with a test that fails without it, is merged through the normal protected-branch
  flow and is published as a new release (the only supported version). The release notes,
  generated from the changelog, say what was fixed.
- Reporters are credited by name in the release notes of the fix, unless they ask for anonymity.
- Reports that are not about this project go to the owner of the component concerned, for example
  [Standard Notes](https://standardnotes.com/help/2/has-standard-notes-completed-a-third-party-security-audit)
  or [Milkdown](https://github.com/Milkdown/milkdown).

The [changelog](CHANGELOG.md) records no vulnerability reported by an external party, so there is
no reporter to credit yet. Hardening found by the maintainer's own reviews (for example image
address filtering, SVG handling and export sanitizing) appears there as ordinary `fix` entries.

## Security requirements

What users can expect:

- The editor makes no network requests of its own, has no telemetry and no AI features. The only
  remote content it loads is images that a note links by URL (`![](https://...)`), fetched by the
  browser from their host, as in any Markdown viewer. Embedded images stay inside the note.
- Note content is treated as untrusted input. Markdown and HTML in a note cannot run script in
  the editor, in the exported page or in a Mermaid diagram.
- The built page carries a Content Security Policy: scripts and connections only from the
  plugin's own origin, no inline code, no eval, no plugins ([ADR 0005](docs/adr/0005-content-security-policy.md)).
- Image addresses are limited to `http:`, `https:`, `data:image/` and relative paths; others are
  emptied.
- Uploaded, pasted or dropped SVG files are stored as pixels, never as SVG.
- Exported HTML is sanitized and carries its own CSP that blocks scripts entirely.
- Releases are verifiable: `SHA256SUMS` and a build provenance attestation
  ([Verifying a release](README.md#verifying-a-release)).

What users cannot expect:

- Confidentiality or integrity of notes beyond what Standard Notes provides. Encryption, sync and
  accounts belong to Standard Notes, not to this plugin.
- Privacy of remote images: the host of a linked image sees the request (address, time, browser
  data) when the note is shown. Embedding the image avoids this.
- Protection from a compromised Standard Notes app, browser or device, or from a malicious host
  page that embeds the plugin.
- Support for versions other than the latest release.

Out of scope: vulnerabilities in Standard Notes, Milkdown, Mermaid, KaTeX or other dependencies
that this project does not alter (report them upstream; they are fixed here by updating), and
issues that need a modified build of the plugin or an attacker who already controls the user's
device.

## Dependency monitoring

- [Dependabot](.github/dependabot.yml) checks npm dependencies weekly and GitHub Actions monthly.
  The Milkdown packages are updated together, as they are published in lockstep.
- CI runs `npm audit --audit-level=critical` on every push and pull request
  ([`ci.yml`](.github/workflows/ci.yml)). It is advisory and does not block a build.
- On a finding, the dependency is updated (through the Dependabot pull request or by hand), CI
  must pass, and the fix ships in the next release. An advisory that is not exploitable in this
  plugin is documented in the pull request that dismisses it.
- `check:lockfile` fails the build if a git dependency appears outside the two pinned commits
  ([ADR 0002](docs/adr/0002-pin-standard-notes-git-dependencies.md)).
- The OpenSSF Scorecard also checks for known vulnerabilities weekly.

## Supply chain

- Every change reaches `main` through a pull request with signed commits and passing CI; force pushes and deletions are blocked, and release tags cannot be moved or deleted
- Workflow actions are pinned to commit hashes and run with read-only tokens unless a job needs more
- Releases are immutable and carry `SHA256SUMS` and a build provenance attestation; the README explains how to verify them
- The [OpenSSF Scorecard](https://scorecard.dev/viewer/?uri=github.com/Esl1h/StandardNotes-Milkdown) checks these practices weekly. Its Code-Review and Branch-Protection checks stay low by design: this is a single-maintainer project, so pull requests are not reviewed by a second person

## Scope

- The editor runs entirely client side; notes live inside your Standard
  Notes account, encrypted with the rest of your data
- Nothing is transmitted anywhere except through Standard Notes itself;
  the editor has no network access of its own
- Images and other remote content referenced in a note load from their
  original hosts, like in any other Markdown view
- The hosted build is static content served from GitHub Pages
- Vulnerabilities in Standard Notes itself belong to
  [Standard Notes security](https://standardnotes.com/help/2/has-standard-notes-completed-a-third-party-security-audit)

## Assurance case

This section argues that the requirements above are met. Each claim points to code, tests or
configuration in the repository. The architecture is described in [ARCHITECTURE.md](ARCHITECTURE.md).

### Threat model

Assets: the content of the user's notes (and the images embedded in them), the integrity of the
note when saved, and the Standard Notes session that hosts the iframe.

Attackers:

- Someone who can place Markdown in a note the user opens: an imported file, a pasted snippet, a
  note synced from another device, a shared template.
- A remote host that serves an image linked by a note.
- A compromised dependency or build step (supply chain).
- Someone who convinces the user to open an exported HTML file.

Entry points:

- Markdown text of the note, including raw HTML nodes, links and image addresses
- Mermaid diagram sources in `mermaid` code blocks
- Images and SVG files uploaded, pasted or dropped
- URLs in images and links
- Messages from the host through the editor-kit relay
- Dependencies and the release pipeline

### Trust boundaries

The boundaries are listed in [ARCHITECTURE.md](ARCHITECTURE.md#trust-boundaries): host to iframe
(`postMessage` relay), note content to renderer (untrusted), plugin origin to network (CSP), and
static hosting. Everything a note contains is on the untrusted side; the Standard Notes host,
which owns encryption and accounts, is outside the plugin and is trusted for those duties.

### Secure design principles

- **Least privilege.** The plugin has no accounts, no storage and no network access of its own.
  The CSP allows scripts and connections only from its origin and forbids plugins, `base` and
  form targets (`CONTENT_SECURITY_POLICY` in [`vite.config.ts`](vite.config.ts), ADR 0005). CI
  jobs get read-only tokens by default and write permissions only in the release and badge jobs
  ([`release.yml`](.github/workflows/release.yml), [`coverage.yml`](.github/workflows/coverage.yml)).
- **Fail-safe defaults.** `safeImageSrc` returns an empty address unless the scheme is
  `http(s):`, `data:image/` or none ([`src/lib/image.ts`](src/lib/image.ts), tests in
  `image.test.ts`). Mermaid runs with `securityLevel: 'strict'`
  ([`src/lib/mermaid.ts`](src/lib/mermaid.ts)). The export page uses `default-src 'none'`
  ([`src/lib/exportHtml.ts`](src/lib/exportHtml.ts)). If the visual editor fails, the raw text is
  shown and the note is not lost ([`ErrorBoundary.tsx`](src/components/ErrorBoundary.tsx)).
- **Complete mediation.** Every image goes through the same filter: Crepe's `proxyDomURL` is set
  to `safeImageSrc` for inline images and image blocks ([`src/lib/crepe.ts`](src/lib/crepe.ts)),
  and the export applies it again to every `<img>` (`noteHtml`). Mermaid output is sanitized by
  Mermaid and again with DOMPurify on redraw (`sanitizeSvg`). The whole exported page goes
  through DOMPurify.
- **Economy of mechanism.** There is no backend and no custom protocol: the plugin reuses the
  editor-kit relay, Milkdown's schema, DOMPurify and the browser's own CSP instead of its own
  sanitizer. Releases are plain static files.
- **Open design.** The code is AGPL-3.0-or-later, the decisions are public ADRs
  ([`docs/adr/`](docs/adr/)) and nothing in the security depends on secrecy. Releases can be
  verified with `gh attestation verify` (see [README](README.md#verifying-a-release)); the
  provenance is signed with the GitHub Actions identity of the release workflow, and no signing
  key lives on the hosting site.
- **Separation and immutability of releases.** Releases are immutable, tags cannot be moved, and
  the release workflow requires green CI for the tagged commit ([ADR 0006](docs/adr/0006-merge-commits-signed-history-verifiable-releases.md),
  `release.yml`).

### Common weaknesses countered

- **Cross-site scripting through Markdown or HTML nodes.** Notes are rendered through the
  Milkdown schema: an HTML node of a note is shown as text (Milkdown's `html` node sets
  `textContent`, in `@milkdown/preset-commonmark`, pinned at 7.23.0 in `package.json`), and
  the note text is never assigned to `innerHTML`. The CSP blocks inline scripts and
  `eval` even if markup slipped through; an e2e test loads a note with math, a diagram and an
  image and fails on any CSP violation ([`e2e/csp.spec.js`](e2e/csp.spec.js)). The HTML export is
  rebuilt from the schema, sanitized with DOMPurify and carries its own CSP; tests drop
  `javascript:` links, event handlers and meta refresh ([`src/lib/exportHtml.test.ts`](src/lib/exportHtml.test.ts)).
- **Unsafe URLs.** `safeImageSrc` skips leading control characters and whitespace as browsers do
  and rejects every scheme except those allowed; tests cover `javascript:` and padded variants
  ([`src/lib/image.test.ts`](src/lib/image.test.ts)). Link URLs in the editor are filtered by
  Milkdown's own `sanitizeLinkHref` (an upstream control, not code of this project); the export
  sanitizer removes unsafe ones from the saved page.
- **Script in SVG.** An uploaded SVG is drawn to a canvas and stored as a WebP or JPEG data
  URI, never as SVG (`svgBitmap` and `embedFile` in `image.ts`; test "is stored as pixels, never
  as SVG"). Mermaid diagrams are sanitized as described above
  ([`src/lib/mermaid.test.ts`](src/lib/mermaid.test.ts), "sanitizes a diagram drawn again").
- **Unbounded work and memory.** The notes list preview scans at most 2000 characters after
  images are removed, and its tag cleanup is tested against many `<` without `>`
  ([`src/lib/preview.ts`](src/lib/preview.ts), `preview.test.ts`). Images are capped at 500 KB
  per data URI and 5 MB per note ([`src/lib/image.ts`](src/lib/image.ts)); a file that cannot fit
  is not read into memory. The echo guard keeps fingerprints, not copies, and only for 60 seconds
  (`echoGuard.ts`); `sentMessages.ts` drops payloads of past saves; Mermaid keeps at most 200
  sources and renders one at a time.
- **Supply chain.** Dependencies are declared in `package.json` and locked in
  `package-lock.json`; CI installs with `npm ci`, and `npm run check:lockfile` allows git
  dependencies only at two pinned commits (ADR 0002). Dependabot and `npm audit` monitor them
  (see above). Workflow actions are pinned to commit hashes, tokens are read-only by default, the
  release job installs with `--ignore-scripts`, and releases are immutable with a provenance
  attestation. The OpenSSF Scorecard runs weekly
  ([`scorecard.yml`](.github/workflows/scorecard.yml)) and CodeQL code scanning is enabled on the
  repository (see the badge in the README).
- **Information exposure.** There is no telemetry and no outbound connection of the plugin's
  own (`connect-src 'self'`). Embedded images do not contact any host.

Known limits: the project is maintained by one person, and the CSP leaves styles, fonts and
images open on purpose, so that the host's theme and remote images in notes keep working.
