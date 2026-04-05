# Contributing

This guide covers how to work on `pvmd`, run the project locally, and prepare changes for review.

## Table of Contents

- [Getting Started](#getting-started)
- [Git Hooks](#git-hooks)
- [Contribution Workflow](#contribution-workflow)
- [Architecture](#architecture)
- [Security Model](#security-model)
- [Testing Notes](#testing-notes)

## Getting Started

Install dependencies:

```bash
npm install
```

Enable local Git hooks for this clone:

```bash
npm run hooks:install
```

Run the project in development:

```bash
npm run dev
```

During development, the client build is written into `.dev-build`, and the server reads the template from `.dev-build/client/index.html` when `NODE_ENV=development`.

This allows client changes to rebuild in place without restarting the application process. In practice, `npm run dev` runs the app and client build processes together so the local preview loop stays short.

## Git Hooks

The repository uses Husky and lint-staged for local development hooks.

- `npm run hooks:install` installs Husky for the current clone without using the `prepare` lifecycle.
- `.husky/pre-commit` runs `lint-staged`, `npm run lint`, `npm run typecheck`, and `npm run test` before a commit completes.
- `lint-staged` runs `npm run format` and `npm run lint:fix` for staged changes.

Husky's generated internals live in `.husky/_`. That folder is local install state and should not be edited manually.

## Contribution Workflow

1. Fork the repository or create a branch from `main`.
2. Make focused changes with tests when behavior changes.
3. Run the relevant checks locally before opening a pull request.
4. Open a pull request with a clear summary of the problem and the change.

When you update behavior or CLI output, update tests and documentation in the same change.

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

## Security Model

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

## Testing Notes

- Prefer targeted tests when working in a narrow area, but keep the relevant app or client suite green before opening a pull request.
- If you change rendering, sanitization, file validation, CLI behavior, or live updates, add or adjust tests in the matching test directories.
- Keep documentation aligned with any user-visible CLI, config, or behavior changes.
