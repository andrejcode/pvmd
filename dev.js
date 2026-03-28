import { spawn } from 'node:child_process'

process.env.NODE_ENV = 'development'

const args = process.argv.slice(2)

const colors = {
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  reset: '\x1b[0m',
}

function prefix(name, color) {
  return `${colors[color]}[${name}]${colors.reset} `
}

let isCleaningUp = false
let finalExitCode = 0

const client = spawn('node', ['esbuild.client.dev.js'], {
  stdio: 'pipe',
  env: { ...process.env },
})

client.stdout.on('data', (data) => {
  const lines = data.toString().split('\n')
  lines.forEach((line, i) => {
    if (i === lines.length - 1 && line === '') return
    console.log(prefix('client', 'cyan') + line)
  })
})

client.stderr.on('data', (data) => {
  const lines = data.toString().split('\n')
  lines.forEach((line, i) => {
    if (i === lines.length - 1 && line === '') return
    console.error(prefix('client', 'cyan') + line)
  })
})

const app = spawn('tsx', ['src/index.ts', ...args], {
  stdio: 'pipe',
  env: { ...process.env },
})

app.stdout.on('data', (data) => {
  const lines = data.toString().split('\n')
  lines.forEach((line, i) => {
    if (i === lines.length - 1 && line === '') return
    console.log(prefix('app', 'green') + line)
  })
})

app.stderr.on('data', (data) => {
  const lines = data.toString().split('\n')
  lines.forEach((line, i) => {
    if (i === lines.length - 1 && line === '') return
    console.error(prefix('app', 'green') + line)
  })
})

function cleanup(exitCode = 0) {
  if (isCleaningUp) {
    return
  }

  isCleaningUp = true
  finalExitCode = exitCode
  client.kill('SIGINT')
  app.kill('SIGINT')
  setTimeout(() => {
    process.exit(finalExitCode)
  }, 1000)
}

process.on('SIGINT', () => cleanup(0))
process.on('SIGTERM', () => cleanup(0))

client.on('exit', (code) => {
  console.error(prefix('client', 'cyan') + `Process exited with code ${code}`)
  cleanup(code ?? 0)
})

app.on('exit', (code) => {
  console.error(prefix('app', 'green') + `Process exited with code ${code}`)
  cleanup(code ?? 0)
})
