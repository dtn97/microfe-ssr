import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const CONFIG_FILE = 'microfe.config.js'

const fail = (message) => {
  console.error(`microfe-build: ${message}`)
  process.exit(1)
}

/**
 * Load and validate a micro app's microfe.config.js (see index.d.ts for the
 * shape). Returns the config with defaults applied plus the app root.
 */
export async function loadConfig(root) {
  const configPath = path.join(root, CONFIG_FILE)
  if (!fs.existsSync(configPath)) {
    fail(`no ${CONFIG_FILE} found in ${root} — run from a micro app root`)
  }

  const config = (await import(pathToFileURL(configPath).href)).default
  if (!config || typeof config !== 'object') {
    fail(`${CONFIG_FILE} must default-export a config object`)
  }
  if (!config.name || typeof config.name !== 'string') {
    fail(`${CONFIG_FILE}: 'name' is required (the micro app name published in the manifest)`)
  }
  if (!Array.isArray(config.modules) || config.modules.length === 0) {
    fail(`${CONFIG_FILE}: 'modules' must be a non-empty array of { moduleId, entry }`)
  }
  const seen = new Set()
  for (const [i, mod] of config.modules.entries()) {
    if (!mod?.moduleId || typeof mod.moduleId !== 'string') {
      fail(`${CONFIG_FILE}: modules[${i}] is missing 'moduleId'`)
    }
    if (seen.has(mod.moduleId)) {
      fail(`${CONFIG_FILE}: duplicate moduleId '${mod.moduleId}' — moduleIds must be unique`)
    }
    seen.add(mod.moduleId)
    if (!mod.entry || typeof mod.entry !== 'string') {
      fail(`${CONFIG_FILE}: modules[${i}] ('${mod.moduleId}') is missing 'entry'`)
    }
    if (!fs.existsSync(path.resolve(root, mod.entry))) {
      fail(`${CONFIG_FILE}: entry for '${mod.moduleId}' not found: ${mod.entry}`)
    }
  }

  const server = config.server ?? 'src/server.ts'
  if (!fs.existsSync(path.resolve(root, server))) {
    fail(`${CONFIG_FILE}: server entry not found: ${server}`)
  }

  return {
    root,
    name: config.name,
    modules: config.modules,
    server,
    outDir: config.outDir ?? 'dist',
  }
}
