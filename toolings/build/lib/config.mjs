import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const CONFIG_FILE = 'microfe.config.js'

const fail = (message) => {
  console.error(`microfe-build: ${message}`)
  process.exit(1)
}

/** Read microfe.config.js from `root` and return its default export (an object). */
async function readConfig(root) {
  const configPath = path.join(root, CONFIG_FILE)
  if (!fs.existsSync(configPath)) {
    fail(`no ${CONFIG_FILE} found in ${root} — run from a micro app or host root`)
  }

  const config = (await import(pathToFileURL(configPath).href)).default
  if (!config || typeof config !== 'object') {
    fail(`${CONFIG_FILE} must default-export a config object`)
  }
  return config
}

// `type` discriminates the two builds. It defaults to 'app' so existing micro
// app configs (written before the field existed) keep working unchanged.
function typeOf(config) {
  const type = config.type ?? 'app'
  if (type !== 'app' && type !== 'host') {
    fail(`${CONFIG_FILE}: 'type' must be 'app' or 'host' (got ${JSON.stringify(config.type)})`)
  }
  return type
}

const requireExists = (root, relPath, label) => {
  if (!fs.existsSync(path.resolve(root, relPath))) {
    fail(`${CONFIG_FILE}: ${label} not found: ${relPath}`)
  }
}

/**
 * Load and validate a micro app's microfe.config.js (see index.d.ts for the
 * shape). Returns the config with defaults applied plus the app root.
 * Invoked by `microfe-build-app`.
 */
export async function loadAppConfig(root) {
  const config = await readConfig(root)
  const type = typeOf(config)
  if (type !== 'app') {
    fail(`${CONFIG_FILE}: type is '${type}' — use 'microfe-build-host' to build the host`)
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
    requireExists(root, mod.entry, `entry for '${mod.moduleId}'`)
  }

  const server = config.server ?? 'src/server.ts'
  requireExists(root, server, 'server entry')

  return {
    root,
    type: 'app',
    name: config.name,
    modules: config.modules,
    server,
    outDir: config.outDir ?? 'dist',
  }
}

/**
 * Load and validate the host's microfe.config.js (see index.d.ts for the
 * shape). Returns the config with defaults applied plus the host root.
 * Invoked by `microfe-build-host`.
 */
export async function loadHostConfig(root) {
  const config = await readConfig(root)
  const type = typeOf(config)
  if (type !== 'host') {
    fail(`${CONFIG_FILE}: type is '${type}' — use 'microfe-build-app' to build a micro app`)
  }

  if (!config.name || typeof config.name !== 'string') {
    fail(`${CONFIG_FILE}: 'name' is required (the host name)`)
  }

  const client = config.client ?? 'src/client.tsx'
  requireExists(root, client, 'client entry')

  const server = config.server ?? 'src/server.tsx'
  requireExists(root, server, 'server entry')

  return {
    root,
    type: 'host',
    name: config.name,
    client,
    server,
    outDir: config.outDir ?? 'dist',
  }
}
