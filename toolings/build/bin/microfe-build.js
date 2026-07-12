#!/usr/bin/env node

/**
 * `microfe-build` — build a micro app from its microfe.config.js.
 *
 * Run from the micro app's root (the folder holding microfe.config.js):
 *
 *   microfe-build build   # one-shot build + publish dist/manifest.json
 *   microfe-build dev     # watch mode: rebuild + republish on save
 *
 * The config declares what varies per app (name, exposed modules, entry
 * points); everything else — esbuild settings, host SDK shims, manifest
 * publishing — lives in this package so micro apps carry no build code.
 */
import { runBuild } from '../lib/build.mjs'
import { loadConfig } from '../lib/config.mjs'

const [command = 'build'] = process.argv.slice(2)

if (!['build', 'dev'].includes(command)) {
  console.error(
    `microfe-build: unknown command '${command}'\n\nUsage:\n  microfe-build build\n  microfe-build dev`,
  )
  process.exit(1)
}

const config = await loadConfig(process.cwd())
await runBuild(config, { watch: command === 'dev' })
