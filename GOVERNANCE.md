# Governance

StandardNotes Milkdown is a small project with a single maintainer. This page says who decides,
how contributions are accepted and what happens when people disagree.

## Decision making

The maintainer, [@Esl1h](https://github.com/Esl1h), makes all final decisions on scope, design,
merging and releases. Decisions that shape the project are recorded as short ADRs in
[`docs/adr/`](docs/adr/), so the reasons outlive the discussion. The boundaries of the project are
in [Scope guidance](CONTRIBUTING.md#scope-guidance): the note stays plain Markdown, and nothing is
stored outside it.

## Contributions

Anyone may open an issue or a pull request, following [CONTRIBUTING.md](CONTRIBUTING.md) and the
[Code of Conduct](CODE_OF_CONDUCT.md). A pull request is accepted when:

- CI passes, including the tests that cover the change
- the change fits the scope guidance
- the maintainer finds the code and its tests understandable and maintainable

Changes reach `main` only through pull requests with signed commits and passing CI, also the
maintainer's own ([ADR 0006](docs/adr/0006-merge-commits-signed-history-verifiable-releases.md)).
A pull request that does not fit is declined with a reason.

## Settling disagreements

Discussion happens in the issue or pull request. If contributor and maintainer still disagree, the
maintainer decides and explains the decision in the thread. Reports of unacceptable behavior follow
the [Code of Conduct](CODE_OF_CONDUCT.md). The license ([AGPL-3.0-or-later](LICENSE)) always allows
a fork.

## Roles and responsibilities

- **Maintainer** ([@Esl1h](https://github.com/Esl1h), the only one today): reviews and merges
  pull requests, triages issues, answers vulnerability reports, keeps the dependencies current,
  cuts releases, and enforces the Code of Conduct. Owns the repository, the GitHub Pages site and
  the release workflow. Listed in [`.github/CODEOWNERS`](.github/CODEOWNERS).
- **Contributor** (anyone): reports bugs, proposes features and sends pull requests with tests,
  following [CONTRIBUTING.md](CONTRIBUTING.md). Contributors have no write access.
- **Security reporter** (anyone): reports a vulnerability privately as described in
  [SECURITY.md](SECURITY.md) and is credited in the release notes unless they ask for anonymity.

## Releases

Only the maintainer publishes releases, by pushing a version tag. The steps and the checks the
release workflow runs are under [Releases](README.md#releases) in the README; users can verify a
download as described in [Verifying a release](README.md#verifying-a-release).

## Support policy

Only the [latest release](https://github.com/Esl1h/StandardNotes-Milkdown/releases/latest) is
supported and receives fixes, security fixes included. Older versions are not maintained. To
upgrade, let Standard Notes update the plugin from its `ext.json` URL (or install the new
`extension.zip`). Notes stay plain Markdown, so nothing in a note has to be migrated and a note
opens the same in any version.

## Continuity

The project depends on one person. No second person holds access to the repository, the release
workflow, the signing identity of the releases (the GitHub Actions identity of this repository) or
the hosting, so the continuity criterion of the OpenSSF Best Practices badge (`access_continuity`)
is **not met**, and neither is a bus factor of 2. If the maintainer becomes unavailable, issues,
pull requests and releases stop until access is handed over. The code is AGPL-3.0-or-later and
the releases are verifiable, so anyone can fork and continue. Adding a second maintainer with the
required access is the way to close this gap; until it happens, this page will say so.
