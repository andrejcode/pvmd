# Contributing

This guide covers how to work on `pvmd`, how the app is put together, and what to update when behavior changes.

## Requirements

`pvmd` targets Node.js `>=20.19.0`. Install dependencies before running any local scripts:

```bash
npm install
```

Install the optional local Git hooks for this clone:

```bash
npm run hooks:install
```

## Common Scripts

```bash
npm run dev            # run the app with the client rebuild watcher
npm run build          # typecheck and build the Node app and browser client
npm run typecheck      # typecheck app and client projects
npm test               # run all Vitest projects
npm run test:app       # run Node-side tests
npm run test:client    # run browser/client tests in jsdom
npm run lint           # run ESLint
npm run format:check   # check Prettier formatting
```

`npm run dev -- README.md` starts the development server for a file. The dev script launches two processes: `tsx src/index.ts ...` for the Node app and `esbuild.client.dev.js` for the browser bundle watcher.

## Source Layout

- `src/index.ts` is the CLI entry point. It parses arguments and calls `run()`.
- `src/cli/` owns CLI options, default config, local config loading, supported browser names, supported themes, and value parsing.
- `src/app.ts` is the runtime coordinator. It resolves and validates the markdown path, decides whether watch is enabled, creates the watcher, creates the server, and installs shutdown cleanup.
- `src/markdown/` owns file validation, markdown parsing, rendering, syntax highlighting, render caches, sanitization, block IDs, and full HTML assembly for rendered markdown blocks.
- `src/watcher/` owns `fs.watch`, debounce/recovery behavior, block diffing, and Server-Sent Event payload creation.
- `src/server.ts` owns the local HTTP server, response headers, CSP nonce injection, body data attributes, `/events`, static image serving, browser auto-open, and startup errors.
- `src/client/` is the browser app. It connects to live updates, applies full or patch updates, preserves `<details>` state, adds copy buttons, disables rendered form controls, opens external links in new tabs, and shows the disconnected alert.
- `src/shared/` contains types and constants shared by the Node app and browser client.
- `src/tests/`, `src/**/tests/`, and `src/client/tests/` contain Node and jsdom tests.

## Runtime Flow

1. `src/index.ts` calls `parseArguments()`.
2. CLI flags and `~/.pvmd/config.json` are merged into the runtime `config`.
3. `run()` resolves the user path and validates the target markdown file.
4. The app creates a watcher only when watch is enabled and the file is not larger than the built-in default max size.
5. The HTTP server renders the markdown on `GET /`, injects the selected GitHub Markdown theme, injects the client bundle, applies security headers, and serves the page on `127.0.0.1`.
6. If a watcher exists, `/events` streams live update messages to connected browsers.
7. The browser client applies content enhancements on first load and patches the preview when live update messages arrive.

## CLI And Config

Built-in defaults live in `src/cli/config.ts`. Supported config keys are `port`, `skipSizeCheck`, `maxFileSize`, `watch`, `httpsOnly`, `open`, `browser`, and `theme`.

Config precedence is:

1. Built-in defaults.
2. `~/.pvmd/config.json`, unless `--no-local-config` is present.
3. Explicit CLI flags.

`pvmd --help` intentionally shows effective defaults after local config is applied. `pvmd --help --no-local-config` shows the built-in defaults. Explicit CLI flags still override configured defaults, including when help is rendered.

Each CLI option may be provided at most once, and the command accepts exactly one markdown file path. Keep tests in `src/cli/tests/` aligned with any CLI parsing, help text, config, or validation changes.

## Markdown Rendering

Markdown rendering is block based. `renderMarkdownBlocks()` turns the markdown source into stable top-level blocks, and `renderBlocksHtml()` wraps those blocks with `data-pvmd-block-id` attributes.

The renderer uses Marked with GitHub-oriented extensions for alerts, emoji, footnotes, heading IDs, syntax highlighting, and KaTeX. Rendered HTML is sanitized server-side before it reaches the browser.

Render caches are bounded LRU caches for syntax highlighting and per-block HTML. They should preserve output behavior: heading IDs, footnotes, sanitized HTML, and highlighted code must remain stable with or without cache hits.

When changing markdown behavior, update tests in `src/markdown/tests/` and consider how the change affects both full-page rendering and live-update block rendering.

## Live Updates

The watcher reads the markdown file after changes, renders the next block list, and creates a live update message from the previous and next block states.

The first update for a connected browser may be a full HTML payload. Later updates can be patch payloads that remove or insert block wrappers. The browser applies those patches in `src/client/markdown-content-updater.ts` and reruns enhancements only on inserted blocks.

The server derives the browser watch state from whether an SSE handler exists. If no watcher exists, `/events` is not registered and the rendered page gets `data-watch="false"`, so the browser does not open an `EventSource`.

## Large Files

File size validation uses `config.maxFileSize`, which defaults to 512 KB and can be changed with `--max-size` or skipped with `--no-size-check`.

Watch behavior is intentionally stricter. Files larger than the built-in default max size disable watching even if validation is skipped or raised. This keeps large previews possible while avoiding repeated expensive reprocessing during edits. When that happens, `pvmd` prints a startup notice explaining that watch is disabled and the first browser render may take longer, especially in Safari.

When changing large-file behavior, update the app tests, file-validation tests, README, and changelog together.

## Browser Client

The client starts in `src/client/main.ts`. It reads `document.body.dataset.watch` to decide whether to connect to `/events`.

Client enhancements are intentionally small and should be safe to run more than once:

- Add one copy button per code block.
- Disable rendered interactive controls so previewed markdown cannot submit forms or accept input.
- Open external HTTP/HTTPS links in a new tab with `noopener noreferrer`.
- Preserve manually opened or closed `<details>` elements across updates.
- Show and dismiss the disconnected alert for live-update connection errors.

Client tests run in jsdom. Use `src/client/tests/` for browser behavior and keep fixtures close to the markup in `src/client/index.html`.

## Server And Static Files

The server binds to `127.0.0.1` only. It serves:

- `/` for the rendered preview page.
- `/events` for Server-Sent Events when watch is enabled.
- Image files referenced by markdown, scoped to the markdown file directory.

Static file serving is intentionally narrow. Paths are decoded, normalized relative to the markdown directory, protected against traversal, and limited to supported image extensions. SVG responses receive a restrictive CSP.

Server responses include defensive headers such as CSP, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, and `Permissions-Policy`. The app script gets a per-response nonce; markdown-provided scripts are not allowed to run.

## Build Outputs

Production builds write to `dist/`:

- `esbuild.config.js` bundles the Node CLI to `dist/index.js`.
- `esbuild.client.js` bundles the browser app to `dist/client/index.html`.

The client build inlines CSS, JavaScript, and favicons into the generated HTML. The Node app reads `dist/client/index.html` in production and `.dev-build/client/index.html` when `NODE_ENV=development`.

Do not commit `dist/` or `.dev-build/`.

## Security Model

Markdown previewing is inherently a browser-rendering problem, so `pvmd` uses layered controls while preserving useful GitHub-style Markdown features.

Key protections include:

- Local-only HTTP serving on `127.0.0.1`.
- Markdown path validation before startup and during watcher recovery.
- Rejection of directories, symbolic links, unsupported extensions, missing files, and oversized files unless size validation is explicitly skipped.
- Server-side sanitization that strips active HTML content, inline event handlers, and unsafe URL schemes.
- Optional `--https-only` mode for stricter remote links and images.
- Restrictive response headers and script nonce injection.
- Scoped static image serving with traversal protection.
- Browser-unsafe port rejection before startup.

Preview only Markdown you trust. These safeguards reduce risk, but the app still renders local content in a browser.

## Testing Guidance

Use targeted tests while developing, then run broader checks before submitting.

- CLI and config changes: `src/cli/tests/`.
- App startup and watcher wiring: `src/tests/app.test.ts`.
- Server responses, CSP, body attributes, startup errors, and static files: `src/tests/server.test.ts`.
- Markdown rendering, sanitization, file validation, and caching: `src/markdown/tests/`.
- Watcher and diff behavior: `src/watcher/tests/`.
- Browser behavior: `src/client/tests/`.

Run at least:

```bash
npm run typecheck
npm test
npm run lint
```

For docs-only changes, still run formatting and linting because Markdown is part of the formatted repository.

## Git Hooks

The repository uses Husky and lint-staged for local development hooks.

- `npm run hooks:install` installs Husky for the current clone.
- `.husky/pre-commit` runs `lint-staged`, `npm run lint`, `npm run typecheck`, and `npm run test`.
- `lint-staged` runs `npm run format` and `npm run lint:fix` for staged changes.

Husky's generated internals live in `.husky/_`. That folder is local install state and should not be edited manually.

## Pull Requests

Keep pull requests focused. Include tests for behavior changes and update README or CHANGELOG when user-visible behavior changes.

Before opening a pull request, confirm:

- The relevant tests pass.
- `npm run typecheck` passes.
- `npm run lint` passes.
- User-facing changes are documented.
- The changelog entry is clear and placed in the correct release section.
