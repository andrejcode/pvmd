# Changelog

All notable changes to this project will be documented in this file.

## 0.2.1 - 2026-03-29

### Fixed

- Prevented the browser client from starting live-update EventSource connections or showing reconnect UI when previews are launched with `--no-watch`.
- Improved oversized file validation errors with clearer guidance for `--no-size-check` and `--max-size`, including more readable formatting for very small size limits.
- Enforced markdown file validation earlier in startup and during watcher-driven refreshes so invalid paths and late file changes fail consistently.
- Treated render-time validation failures as fatal CLI errors so invalid markdown input exits consistently.

## 0.2.0 - 2026-03-27

### Added

- Block-level live updates that patch only changed markdown sections in the browser instead of replacing the full document.
- Stable DOM block wrappers and patch operations for incremental browser updates over Server-Sent Events.

### Changed

- Reworked the live update pipeline to render markdown as top-level blocks and diff documents by block identity.
- Updated incremental markdown rendering to run Marked document hooks and token walking so extension behavior stays aligned with full-document rendering.
- Derived live-update block identities from rendered output so generated sections such as footnotes update correctly when their content changes.
- Filtered empty rendered blocks from the live document model so placeholder tokens do not create empty DOM wrappers or unstable patches.
- Expanded the documentation to describe the block patching model and the supported markdown extension set.

### Fixed

- Restored syntax highlighting during incremental block rendering.
- Restored GitHub-style alert rendering in live updates.
- Restored heading IDs and in-page anchor navigation in incremental rendering.
- Restored emoji shortcode rendering in the markdown pipeline.
- Restored KaTeX rendering support in both full and incremental markdown rendering.
- Restored footnote ordering and live updates so footnotes render at the end of the document and patch correctly when note content changes.

## 0.1.0 - Initial Release

### Added

- Terminal-launched Markdown preview server with browser rendering.
- Live reload support for watched Markdown files.
- GitHub-style markdown presentation with syntax highlighting and server-side sanitization.
- CLI entry point for opening and previewing local Markdown documents.
