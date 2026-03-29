import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1]
const githubPagesBase =
  process.env.VITE_APP_BASE_PATH ??
  (process.env.GITHUB_ACTIONS === 'true' && repositoryName ? `/${repositoryName}/` : '/')

export default defineConfig({
  plugins: [react()],
  base: githubPagesBase,
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
})
