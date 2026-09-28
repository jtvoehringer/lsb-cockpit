import { defineConfig } from 'vitest/config'

// Ende-zu-Ende-Tests gegen Supabase – nur manuell, nie im Build (brauchen ein fiktives Testkonto)
export default defineConfig({ test: { include: ['e2e/**/*.e2e.ts'], environment: 'node', testTimeout: 120_000, fileParallelism: false } })
