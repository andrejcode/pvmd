# pvmd

`pvmd` is a terminal-first Markdown previewer for local files that turns a Markdown document into a polished local preview from a single command. It serves your file on `127.0.0.1` in a GitHub-style view, keeps the workflow straightforward, and stays responsive as you edit so you can review, refine, and publish Markdown with less friction.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [CLI Options](#cli-options)
- [Architecture](#architecture)
- [Security](#security)
- [Development](#development)
- [License](#license)

## Features

- Local Markdown preview in the browser from a single terminal command
- GitHub-style Markdown rendering for README, docs, and contribution guide reviews before publishing changes
- Incremental live updates with block-level DOM patching instead of full-page replacement
- Multi-client update delivery over Server-Sent Events
- GitHub-style Markdown rendering with syntax highlighting, alerts, footnotes, heading anchors, emoji, and KaTeX
- Copy buttons for fenced code blocks and local static image serving for Markdown content
- Optional browser auto-open, browser selection, and `--https-only` filtering for remote links and images
- Strict file validation, path traversal protection, and user-friendly error handling

## Installation

```bash
npm install -g @andrejcode/pvmd
```

Or run it without installing globally:

```bash
npx @andrejcode/pvmd ./README.md
```

## Usage

```bash
pvmd [options] <file>
```

Typical workflow: preview a Markdown file locally, iterate quickly, and optionally verify how it will look in a GitHub-style view before publishing changes.

Preview a Markdown file:

```bash
pvmd ./docs/guide.md
```

Open the preview automatically in your browser:

```bash
pvmd --open ./docs/guide.md
```

When the preview starts, `pvmd` prints a local address such as `Preview ready at http://127.0.0.1:8765/` so you can always open it manually if auto-open is unavailable.

Open the preview in a specific supported browser:

```bash
pvmd --open --browser chrome ./docs/guide.md
```

Short flag form:

```bash
pvmd -o -b firefox ./docs/guide.md
```

Preview with stricter remote-content handling:

```bash
pvmd --open --https-only ./docs/guide.md
```

Disable file watching:

```bash
pvmd --no-watch ./docs/guide.md
```

## CLI Options

```text
-p, --port <port>       Port number (default: 8765; use 0 for a random port)
--no-size-check         Skip file size validation
--max-size <mb>         Maximum file size in MB (default: 2)
--no-watch              Skip file watching
--https-only            Only allow HTTPS URLs for images and links
-o, --open              Open in default browser automatically
-b, --browser <browser> Browser to open automatically (supported: default, chrome, firefox, edge, brave; default: default)
-h, --help              Show help
-v, --version           Show version
```

Supported browser values: `default`, `chrome`, `firefox`, `edge`, `brave`.

If you choose a named browser such as `brave` or `chrome`, `pvmd` checks that it is available before trying to launch it and falls back to a warning if it is not installed.

## Architecture

1. `pvmd` resolves and validates the Markdown file path.
2. The file is rendered with `marked`, the project's Markdown extensions, syntax highlighting, and server-side sanitization.
3. The result is split into top-level DOM blocks so live updates can patch only the changed sections.
4. A local server on `127.0.0.1` serves the rendered page, static local assets, and live-update events, then prints the preview address for manual opening or sharing across local browser sessions.

### Live Update Model

`pvmd` uses Server-Sent Events for one-way updates from the local server to the browser. When the source file changes, the client receives either a full initial render or a block patch message that inserts and removes only the affected sections.

This keeps HTML transfer smaller, preserves untouched DOM nodes, and reruns client-side enhancements only for updated blocks. Multiple browser clients can stay connected at the same time, and the browser shows a visible alert if the event stream disconnects.

### Static Local Files

The server can also serve local image files referenced by the Markdown document. File resolution is scoped to the Markdown file directory, protected against traversal, and limited to an allowlist of supported image types. SVG responses receive an additional restrictive Content Security Policy.

### Error Handling

The project favors explicit, user-readable failure modes. Common file-system issues such as missing files, permission errors, directories passed as files, symbolic links, invalid file types, null bytes, or oversized inputs are converted into direct error messages rather than low-level Node.js output.

Server startup errors are handled the same way. If the selected port is already in use, `pvmd` prints a custom message explaining how to recover.

`pvmd` also validates port choices before startup. Port `0` is supported to request a random available local port, while browser-blocked ports such as `6000` or `6667` are rejected up front with a direct error because browsers refuse to open them.

## Security

Markdown previewing is inherently a browser-rendering problem, so `pvmd` uses a defense-in-depth approach instead of reducing Markdown support to a minimal subset.

Rather than removing richer GitHub-style features, the project combines server-side sanitization, restrictive response headers, and controlled local file serving to reduce risk while preserving alerts, syntax highlighting, emoji, footnotes, and mathematical notation.

Key protections include:

- Local-only HTTP serving on `127.0.0.1`
- Render-time stripping of active HTML content such as `<script>` tags, inline event handlers, and unsafe URL schemes
- Content Security Policy with per-response script nonces
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: no-referrer`
- `X-Frame-Options: DENY`
- Restrictive `Permissions-Policy`
- Optional `--https-only` mode that blocks insecure remote links and images in the browser client
- Path traversal protection for local file resolution
- Validation that rejects directories, symbolic links, unsupported file types, and oversized files
- Restrictive CSP for served SVG assets

This keeps the preview feature-rich while still applying meaningful browser-side and server-side controls.

You should still preview only Markdown that you trust. Even with the available safeguards, review the source of any Markdown file before opening it, especially if it comes from an external or unverified source.

## Development

Install dependencies:

```bash
npm install
```

Build the project:

```bash
npm run build
```

Run it in development:

```bash
npm run dev
```

During development, the client build is written into `.dev-build`, and the server reads the template from `.dev-build/client/index.html` when `NODE_ENV=development`.

This allows client changes to rebuild in place without restarting the application process. In practice, `npm run dev` runs the app and client build processes together so the local preview loop stays short.

## License

MIT
