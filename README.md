# pvmd

`pvmd` is a command-line tool that previews local Markdown files in your browser with GitHub-style rendering. Run it from your terminal, then edit in your usual editor and see the preview update as you save.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
  - [Large Files](#large-files)
  - [Local Images](#local-images)
- [CLI Options](#cli-options)
- [Local Config](#local-config)
- [Security](#security)
- [License](#license)

## Features

- GitHub-style rendering with syntax highlighting, alerts, footnotes, emoji, and math
- Live preview updates as you save, without full-page reloads
- Synchronized previews across multiple browser tabs
- Code-block copy buttons and heading links
- Local images in Markdown and HTML
- Light, dark, and accessibility-focused themes
- Optional browser auto-open and browser selection
- Configurable file-size limits and local image controls
- HTML sanitization and optional HTTPS-only links and images

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

Open automatically in a specific browser and choose a theme:

```bash
pvmd -o -b firefox -t dark-dimmed ./docs/guide.md
```

`pvmd` prints a local preview address such as `http://127.0.0.1:8765/` when it starts. If browser auto-open is unavailable or disabled, open that address manually.

### Large Files

Use `--max-size <kb>` or `--no-size-check` to preview Markdown above the default limit. Files over 512 KB always have live updates disabled and may take longer to render, even if the size limit is raised or skipped.

### Local Images

Local images work in both Markdown image syntax and HTML `<img>` tags. Paths such as `./screenshots/example.png` are relative to the Markdown file's folder and must stay within that folder. Supported formats are AVIF, GIF, ICO, JPEG, PNG, SVG, and WebP.

Disable local image serving with `--no-local-files` or `"localFiles": false` in config. Local image requests then return HTTP `404`. The Markdown preview, live updates, and remote images are unaffected.

Images have a separate per-file limit, independent of `--max-size` and `--no-size-check`. Oversized images return HTTP `413 Content Too Large`, and the terminal prints the filename, effective limit, and remedy.

For example, allow local images up to 40 MiB:

```bash
pvmd README.md --max-image-size 40960
```

## CLI Options

The table lists built-in settings. `pvmd --help` shows effective defaults after config and CLI overrides. Add `--no-local-config` to ignore the config file.

| Option                    | Config Key      | Built-In Default | Purpose                                                        |
| ------------------------- | --------------- | ---------------- | -------------------------------------------------------------- |
| `-p, --port <port>`       | `port`          | `8765`           | Server port. Use `0` to pick an available port.                |
| `--max-size <kb>`         | `maxFileSize`   | `512`            | Maximum Markdown file size in KB.                              |
| `--no-size-check`         | `skipSizeCheck` | `false`          | Skip Markdown size validation.                                 |
| `--max-image-size <kb>`   | `maxImageSize`  | `20480` (20 MiB) | Maximum local image size in KB.                                |
| `--no-local-files`        | `localFiles`    | `true`           | Disable local file serving by setting `localFiles` to `false`. |
| `--no-watch`              | `watch`         | `true`           | Disable live updates by setting `watch` to `false`.            |
| `--https-only`            | `httpsOnly`     | `false`          | Restrict remote links and images to HTTPS.                     |
| `-o, --open`              | `open`          | `false`          | Open the preview in the selected browser.                      |
| `-b, --browser <browser>` | `browser`       | `default`        | Browser used by `--open`.                                      |
| `-t, --theme <theme>`     | `theme`         | `default`        | GitHub Markdown theme.                                         |
| `--no-local-config`       | -               | -                | Ignore the user config file.                                   |
| `-h, --help`              | -               | -                | Show help.                                                     |
| `-v, --version`           | -               | -                | Show version.                                                  |

Size values must be finite positive numbers. Each option may be provided once, and the command accepts exactly one Markdown file path.

Supported browser values: `default`, `chrome`, `firefox`, `edge`, `brave`.

Supported theme values: `default`, `light`, `dark`, `dark-dimmed`, `dark-high-contrast`, `dark-colorblind`, `light-colorblind`.

If you omit `--theme`, `pvmd` uses the package default stylesheet, which switches automatically between GitHub's light and dark variants based on the system `prefers-color-scheme` setting.

If you choose a named browser such as `brave` or `chrome`, `pvmd` checks that it is available before trying to launch it and falls back to a warning if it is not installed.

## Local Config

Set user-wide defaults in:

- Linux and macOS: `~/.pvmd/config.json`
- Windows: `%USERPROFILE%\.pvmd\config.json`

Use the config keys in the table above. CLI flags override config, and config overrides built-in defaults. For example:

```json
{
  "open": true,
  "browser": "chrome",
  "theme": "dark",
  "maxImageSize": 40960
}
```

Running `pvmd README.md` uses these settings. `pvmd README.md --theme light` overrides only the theme. Invalid JSON or settings produce warnings and are ignored.

## Security

`pvmd` is designed to improve preview safety without stripping away useful GitHub-style Markdown features. It combines server-side sanitization, restrictive response headers, controlled local file serving, and optional `--https-only` filtering to reduce risk while keeping the preview feature-rich.

You should still preview only Markdown that you trust. Even with the available safeguards, review the source of any Markdown file before opening it, especially if it comes from an external or unverified source.

## License

MIT
