#!/usr/bin/env node

/**
 * `microfe-build-host` — build the host from its microfe.config.js.
 *
 * Run from the host's root (the folder holding microfe.config.js):
 *
 *   microfe-build-host build   # one-shot build of the client SDK + server bundle
 *   microfe-build-host dev     # watch mode: rebuild both on save
 *
 * The config declares what varies (name, client/server entries); the esbuild
 * settings that produce the client SDK (public/microfe-sdk.js) and the server
 * bundle (server/server.js) live in this package.
 */
import { runHostBuild } from '../lib/build-host.mjs'
import { loadHostConfig } from '../lib/config.mjs'

const [command = 'build'] = process.argv.slice(2)

if (!['build', 'dev'].includes(command)) {
  console.error(
    `microfe-build-host: unknown command '${command}'\n\nUsage:\n  microfe-build-host build\n  microfe-build-host dev`,
  )
  process.exit(1)
}

const config = await loadHostConfig(process.cwd())
await runHostBuild(config, { watch: command === 'dev' })
