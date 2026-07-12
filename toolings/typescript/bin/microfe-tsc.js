#!/usr/bin/env node

/**
 * `microfe-tsc` — run the monorepo's bundled TypeScript compiler.
 *
 * Resolves `tsc` from this package, so consumer packages only need to depend
 * on `@microfe/typescript` (they don't list `typescript` directly, which is
 * why the `tsc` CLI itself is not otherwise on their PATH). All arguments are
 * forwarded straight through to `tsc`, so the calling script decides what to
 * do:
 *
 *   microfe-tsc -p tsconfig.json     # check (or emit) per the tsconfig
 *   microfe-tsc --noEmit             # type-check only, no output
 *   microfe-tsc --watch
 */

const { spawnSync } = require('node:child_process')

// Resolve the tsc CLI bundled with this package.
const tscBin = require.resolve('typescript/bin/tsc')

const args = process.argv.slice(2)

const result = spawnSync(process.execPath, [tscBin, ...args], {
  stdio: 'inherit',
})

if (result.error) {
  throw result.error
}

process.exit(result.status ?? 1)
