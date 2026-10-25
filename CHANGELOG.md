# Changelog

All notable changes to this project are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and the project adheres to [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-10-25

### Added

- Set a Content Security Policy on the page

### Fixed

- Sync the stale dev manifest version
- Drop unclosed tag openings from the preview
- Drop repeated < before a tag in the preview
- Drop a < that emphasis markers hid
- **export:** Keep emoji whole in the file name

### Documentation

- Adopt the Contributor Covenant
- Record the shared decisions as ADRs
- Align the README with the other plugins

## [0.8.1] - 2026-10-25

- Maintenance release

## [0.8.0] - 2026-10-24

### Added

- Editor layout polish, Mermaid templates and more bar buttons (#35)

## [0.7.4] - 2026-10-16

- Maintenance release

## [0.7.3] - 2026-10-16

### Added

- **export:** Add a CSP to the exported page

### Fixed

- **mermaid:** Sanitize diagrams drawn again
- **image:** Only load images from safe addresses
- **image:** Store uploaded SVGs as pixels

## [0.7.2] - 2026-10-06

### Fixed

- **deps:** Pin katex to the patched 0.18

## [0.7.1] - 2026-10-06

### Added

- **sample:** Fill Add sample with a full tour

### Documentation

- **readme:** New screenshots and the focus mode

## [0.7.0] - 2026-10-06

### Fixed

- **bar:** Give Export as HTML its own icon

## [0.6.3] - 2026-10-06

### Fixed

- **visual:** Stop undoing keys typed after a sync

## [0.6.2] - 2026-10-06

### Fixed

- **sync:** Ignore echoes that differ in spacing

## [0.6.1] - 2026-10-05

### Fixed

- **sync:** Ignore late echoes of our own saves

## [0.6.0] - 2026-10-05

### Added

- **editor:** Visual layer and active block
- **editor:** Rounded task checkboxes
- **layout:** Add a focus mode

### Fixed

- **theme:** Apply the StyleKit palette
- **layout:** Use the phone width for the note text
- **theme:** Cover the whole note with the theme

## [0.5.0] - 2026-10-05

### Added

- **count:** Show the reading time
- **bar:** Move secondary actions into a menu
- **outline:** Include nested headings
- **frontmatter:** Keep TOML front matter
- **mermaid:** Follow a change of the app theme
- **export:** Save the note as an HTML page
- **toc:** Add a table of contents block

### Documentation

- **readme:** Document the new editor features

## [0.4.2] - 2026-10-04

### Fixed

- **image:** Keep untitled images and alt text
- **source:** Keep external text out of undo
- **markdown:** Write bullet lists with a dash

### Performance

- **split:** Debounce source to visual sync

### Documentation

- **readme:** Note the image resize alt limit
- **readme:** Explain the first edit normalization

## [0.4.1] - 2026-10-04

### Added

- **preview:** Add a plain text note preview
- **sync:** Add a guard for stale save echoes

### Fixed

- **deps:** Drop the brace-expansion override
- **save:** Store a short note preview
- **sync:** Ignore stale echoes of our own saves

## [0.4.0] - 2026-10-03

### Added

- **search:** Find and replace
- **outline:** Add a table of contents panel

### Fixed

- **markdown:** Keep YAML front matter intact
- **markdown:** Keep GitHub alerts and wiki links

### Documentation

- **readme:** Document search, outline and kept syntaxes

## [0.3.0] - 2026-10-03

### Added

- **crepe:** Point empty lines to the slash menu
- **counter:** Show a word count in the formatting bar
- **layout:** Copy the note as Markdown
- **print:** Print the rendered note
- **latex:** Render math with KaTeX
- **mermaid:** Preview mermaid code blocks as diagrams

### Fixed

- **layout:** Keep preferences in the component data
- **image:** Embed uploaded images in the note

### Documentation

- **readme:** Refresh the screenshots for v0.2.0
- **readme:** Document math, diagrams, images and tools

## [0.2.0] - 2026-10-03

### Added

- **layout:** Use icons for the layout buttons
- **layout:** Hide the layout bar behind a button

### Fixed

- **crepe:** Save an undo back to the opened text
- **crepe:** Drop updates from a disposed instance
- **source:** Keep the cursor across external syncs
- **html:** Use the Milkdown title and description
- **layout:** Make the toolbar button hover visible
- **layout:** Pin the bottom bar on short notes

### Performance

- **crepe:** Build only the features in use

### Changed

- **crepe:** Drop the unreachable destroy wait

### Documentation

- **readme:** Fix the install steps and data format
- **readme:** Add screenshots, install steps and checks
- **readme:** Describe the icon bar and its fold button

### Security

- **github:** Add issue and pull request templates

## [0.1.0] - 2026-10-03

### Added

- **editor:** Bootstrap the editor with the component relay
- **crepe:** Wrap the milkdown crepe editor
- **source:** Add the markdown source pane
- **layout:** Modes, orientation and top bar preferences
