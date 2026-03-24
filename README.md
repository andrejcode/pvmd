# pvmd

`pvmd` is a local Markdown previewer for the terminal. It starts a small HTTP server, renders a Markdown file into an HTML document, and serves it in the browser with optional live updates when the source file changes.

The project is designed for fast local previewing of Markdown documents while keeping the runtime model simple: a single CLI command, a localhost server, and a lightweight browser client.

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

- Local preview of Markdown files in the browser
- Live reload when the source file changes
- Block-level live updates that patch only the changed markdown sections in the browser
- Multi-client update delivery over Server-Sent Events
- GitHub-flavored Markdown support
- Syntax highlighting for fenced code blocks
- Footnotes, alerts, heading anchors, emoji rendering, and KaTeX support
- Heading anchor support for table-of-contents and `#section` navigation
- Copy buttons for code blocks
- Local static image serving for Markdown content
- Disconnection status alert in the browser when the live update stream is unavailable
- Optional browser auto-open
- Optional HTTPS-only filtering for remote links and images
- Input validation for Markdown files, extensions, file size, and file-system edge cases
- User-friendly error handling for common file-system failures
- Explicit custom error message when the selected port is already in use

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

Preview a Markdown file:

```bash
pvmd ./docs/guide.md
```

Open the preview automatically in your browser:

```bash
pvmd --open ./docs/guide.md
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
-p, --port <port>       Port number (default: 8765)
--no-size-check         Skip file size validation
--max-size <mb>         Maximum file size in MB (default: 2)
--no-watch              Skip file watching
--https-only            Only allow HTTPS URLs for images and links
-o, --open              Open in default browser automatically
-h, --help              Show help
-v, --version           Show version
```

## Architecture

1. `pvmd` resolves and validates the Markdown file path.
2. The file is checked before reading: path resolution blocks traversal, the extension must be a supported Markdown extension, and the target must be a regular file within the allowed size limit.
3. The file is rendered to HTML with `marked`, the project's Markdown extensions, syntax-highlighted code blocks, and server-side sanitization, then wrapped into top-level DOM blocks for incremental updates.
4. A local server serves the rendered page on `127.0.0.1` and injects the parsed HTML into the client template.
5. When watch mode is enabled, file changes are pushed to connected browsers through Server-Sent Events as either full document payloads or block patch operations.

### Live Update Model

`pvmd` uses Server-Sent Events for one-way update delivery from the local server to the browser. This matches the preview use case well: the browser only needs to receive rendered HTML updates when the source Markdown file changes.

The server can keep multiple browser clients connected at the same time. When the watched file changes, each active client receives either a full initial render or a block-level patch message that inserts and removes only the changed sections. This reduces HTML transfer size, preserves untouched DOM nodes in the browser, and reruns client-side enhancements only for the affected blocks. If the event stream disconnects, the browser client shows a visible status alert so the user knows live updates are no longer being received.

### Static Local Files

In addition to the main rendered document, the server can serve local static image files referenced by the Markdown document. File resolution is scoped to the Markdown file directory, validated against path traversal, and restricted to an allowlist of image file types. SVG responses receive an additional restrictive Content Security Policy.

### Error Handling

The project favors explicit and user-readable failure modes. Common file-system issues such as missing files, permission errors, directories passed as files, symbolic links, invalid file types, null bytes, or oversized inputs are converted into direct error messages rather than low-level Node.js output.

Server startup errors are also handled deliberately. If the configured port is already in use, `pvmd` prints a custom message instructing the user to choose a different port.

## Security

Markdown previewing is inherently a browser-rendering problem, so `pvmd` takes a defense-in-depth approach instead of stripping Markdown features down to a minimal subset.

Rather than removing the richer GitHub-style rendering capabilities, the project relies on restrictive response headers and controlled serving behavior to reduce risk while preserving features such as alerts, syntax highlighting, emoji rendering, footnotes, and mathematical notation.

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

This setup allows the project to keep useful GitHub-like Markdown behavior while still applying meaningful browser-side and server-side controls.

You should only preview Markdown that you trust. Even with the available safeguards, review the source of any Markdown file before opening it, especially if it comes from an external or unverified source. When appropriate, enable additional safety-oriented flags such as `--https-only`.

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

During development, the client build is written into the `.dev-build` directory. The server-side template loader reads the HTML template from `.dev-build/client/index.html` when `NODE_ENV=development`.

This matters because the browser client is served by the same local HTTP server as the rendered Markdown page. When client code changes, the development client build can be rebuilt in place without requiring the developer to restart `npm run dev`. The application process keeps serving the updated client assets from `.dev-build`, which shortens the edit-refresh loop during frontend work.

In practice, `npm run dev` runs the application process and the client build process together so both sides can evolve during local development.

## License

MIT
