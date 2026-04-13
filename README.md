# pvmd

`pvmd` is a terminal-first Markdown previewer for local files that turns a Markdown document into a polished local preview from a single command. It serves your file on `127.0.0.1` in a GitHub-style view, keeps the workflow straightforward, and stays responsive as you edit so you can review, refine, and publish Markdown with less friction.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [CLI Options](#cli-options)
- [Local Config](#local-config)
- [Security](#security)
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

Preview with a specific GitHub Markdown theme:

```bash
pvmd --theme dark-dimmed ./docs/guide.md
```

Short flag form:

```bash
pvmd -t light-colorblind ./docs/guide.md
```

Disable file watching:

```bash
pvmd --no-watch ./docs/guide.md
```

Use a local config file for project defaults:

```json
{
  "open": true,
  "browser": "firefox",
  "theme": "dark-dimmed",
  "port": 9000
}
```

`pvmd` prints a local preview address such as `http://127.0.0.1:8765/` when it starts. If browser auto-open is unavailable or disabled, open that address manually.

For very large Markdown files with many lines, the first preview load can take longer and memory usage will increase because more content has to be processed and kept in sync. This is a current limitation and is planned for future optimization.

## CLI Options

The built-in defaults below are the fallback values when no local config is present. `pvmd --help` shows the effective defaults after applying `~/.pvmd/config.json`, and explicit CLI flags still take precedence.

```text
-p, --port <port>       Port number (default: 8765; use 0 for a random port)
--no-size-check         Skip file size validation
--max-size <mb>         Maximum file size in MB (default: 2)
--no-watch              Skip file watching
--https-only            Only allow HTTPS URLs for images and links
-o, --open              Open in default browser automatically
-b, --browser <browser> Browser to open automatically (supported: default, chrome, firefox, edge, brave; default: default)
-t, --theme <theme>     GitHub Markdown theme to use (supported: default, light, dark, dark-dimmed, dark-high-contrast, dark-colorblind, light-colorblind; default: default)
-h, --help              Show help
-v, --version           Show version
```

Supported browser values: `default`, `chrome`, `firefox`, `edge`, `brave`.

Supported theme values: `default`, `light`, `dark`, `dark-dimmed`, `dark-high-contrast`, `dark-colorblind`, `light-colorblind`.

If you omit `--theme`, `pvmd` uses the package default stylesheet, which switches automatically between GitHub's light and dark variants based on the system `prefers-color-scheme` setting.

If you choose a named browser such as `brave` or `chrome`, `pvmd` checks that it is available before trying to launch it and falls back to a warning if it is not installed.

## Local Config

`pvmd` supports a global `.pvmd/config.json` file in your home directory so you do not need to repeat common flags.

The CLI looks for `.pvmd/config.json` in your OS user home directory

- Linux and macOS: `~/.pvmd/config.json`
- Windows: `%USERPROFILE%\.pvmd\config.json`

There is only one shared config location for the current user. Those config values override the built-in defaults, and explicit CLI flags override the config.

Supported config keys are: `port`, `skipSizeCheck`, `maxFileSizeMB`, `watch`, `httpsOnly`, `open`, `browser`, and `theme`.

Example:

```json
{
  "open": true,
  "browser": "chrome",
  "theme": "dark",
  "port": 9000,
  "watch": true,
  "httpsOnly": false
}
```

Save that as `~/.pvmd/config.json`. Running `pvmd README.md` then uses those values automatically, while a command such as `pvmd README.md --port 8765 --theme light` still overrides the configured defaults.

## Security

`pvmd` is designed to improve preview safety without stripping away useful GitHub-style Markdown features. It combines server-side sanitization, restrictive response headers, controlled local file serving, and optional `--https-only` filtering to reduce risk while keeping the preview feature-rich.

You should still preview only Markdown that you trust. Even with the available safeguards, review the source of any Markdown file before opening it, especially if it comes from an external or unverified source.

## License

MIT
