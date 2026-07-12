#!/usr/bin/env node

/**
 * `microfe-build-app` — build a micro app from its microfe.config.js.
 *
 * Run from the micro app's root (the folder holding microfe.config.js):
 *
 *   microfe-build-app build   # one-shot build + publish dist/manifest.json
 *   microfe-build-app dev     # watch mode: rebuild + republish on save
 *
 * The config declares what varies per app (name, exposed modules, entry
 * points); everything else — esbuild settings, host SDK shims, manifest
 * publishing — lives in this package so micro apps carry no build code.
 */
import { runBuild } from '../lib/build.mjs'
import { loadAppConfig } from '../lib/config.mjs'

const [command = 'build'] = process.argv.slice(2)

if (!['build', 'dev'].includes(command)) {
  console.error(
    `microfe-build-app: unknown command '${command}'\n\nUsage:\n  microfe-build-app build\n  microfe-build-app dev`,
  )
  process.exit(1)
}

const config = await loadAppConfig(process.cwd())
await runBuild(config, { watch: command === 'dev' })
