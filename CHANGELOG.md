# Changelog

All notable changes to this project will be documented in this file.

## 0.2.3 - Unreleased

### Fixed

- Warned with the local preview URL when browser auto-open fails, so `--open` still gives users a clear manual fallback instead of failing silently.

## 0.2.2 - 2026-03-30

### Fixed

- Improved watcher rename handling so atomic-save editors such as Vim and Neovim no longer terminate the preview when they replace the file during save.
- Added retry-based watcher recovery that reattaches to the same markdown path after transient rename events instead of treating every rename as a permanent deletion.
- Kept live reload validation strict during watcher recovery by revalidating the original path before reattaching and before rereading file contents, so renamed, missing, or invalid targets still fail safely.
- Escaped markdown preview page titles before injecting the source file name into the HTML template, preventing file names with HTML-special characters from introducing markup into the document head.
- Validated CLI port values before server startup, allowing port `0` for OS-assigned random ports while replacing Node's raw out-of-range error with a direct `0` to `65535` validation message.
- Rejected browser-unsafe ports such as `6000` and `6667` up front so the CLI fails with a clear message instead of letting the browser refuse the preview URL later.
- Used the actual bound port in startup logs and browser auto-open URLs so `--port 0` opens the assigned preview address instead of `127.0.0.1:0`.
- Replaced raw permission-denied startup crashes on restricted ports with a friendlier message that explains low-port permission requirements and suggests using a higher port.

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
