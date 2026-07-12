#!/usr/bin/env node

/**
 * `microfe-lint` — run the monorepo's bundled Biome.
 *
 * Resolves the `biome` CLI from this package, so consumer packages only need
 * to depend on `@microfe/biome` (they don't list `@biomejs/biome` directly,
 * which is why the `biome` CLI itself is not otherwise on their PATH).
 * Arguments are forwarded straight through to Biome, so the calling script
 * decides what to do:
 *
 *   microfe-lint check src           # lint + format check the src folder
 *   microfe-lint check --fix src     # apply safe fixes (maps to Biome's --write)
 *   microfe-lint check --fix --unsafe src
 *   microfe-lint format --fix .
 *
 * As a convenience, `--fix` is translated to Biome's `--write` flag (Biome has
 * no `--fix`); pair it with `--unsafe` to also apply unsafe fixes. Everything
 * else is passed through verbatim, so `--write` still works if you prefer it.
 *
 * Configuration is resolved by Biome itself from the nearest `biome.json`
 * (the repo-wide config at the monorepo root).
 */

const { spawnSync } = require('node:child_process')

// Resolve the Biome CLI launcher bundled with this package.
const biomeBin = require.resolve('@biomejs/biome/bin/biome')

// Translate the friendlier `--fix` into Biome's `--write`.
const args = process.argv.slice(2).map((arg) => (arg === '--fix' ? '--write' : arg))

const result = spawnSync(process.execPath, [biomeBin, ...args], {
  stdio: 'inherit',
})

if (result.error) {
  throw result.error
}

process.exit(result.status ?? 1)
