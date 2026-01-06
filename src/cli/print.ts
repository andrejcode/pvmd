import { version } from '../../package.json' with { type: 'json' }

export function printHelp() {
  // TODO: Add options
  // -p, --port <number>     Port number (default: 8765)
  // -H, --hostname <host>   Hostname (default: 127.0.0.1)
  // --max-size <mb>         Maximum file size in MB (default: 2)
  // --no-size-check         Skip file size validation
  // -y, --yes               Skip confirmation prompt
  // --no-watch              Skip file watching
  console.log(`
Usage: pvmd [options] <file>

Options:
-h, --help              Show help
-v, --version           Show version
`)
}

export function printVersion() {
  console.log(`pvmd v${version}`)
}
