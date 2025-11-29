import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'app',
          globals: true,
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: ['src/client/**'],
        },
      },
      {
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
