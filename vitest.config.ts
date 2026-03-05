import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

const alias = {
  '@': resolve(import.meta.dirname, 'src'),
}

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'app',
          globals: true,
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: ['src/client/**'],
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'client',
          globals: true,
          environment: 'jsdom',
          include: ['src/client/**/*.test.ts'],
        },
      },
    ],
  },
})
