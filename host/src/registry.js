/**
 * Server-side micro app registry.
 *
 * Knows where each micro app publishes its artifacts, re-reads deploy
 * manifests per request, and hot-loads new server bundles when a micro app
 * ships a new version (see README: "Dynamic updates"). Plugs itself in as
 * the server-side provider behind `getMicroAppComponent`.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { setMicroAppProvider } from './app/runtime.js'

// import.meta.url is the *bundled* location: host/dist/server/server.js
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '../../..')

// In production this would be a discovery service / CDN base URL per app.
export const artifactDirs = {
  'app-a': path.join(rootDir, 'apps/app-a/dist'),
  'app-b': path.join(rootDir, 'apps/app-b/dist'),
}
export const appNames = Object.keys(artifactDirs)

const loaded = new Map() // name -> { version, module, clientScript }

async function resolveApp(name) {
  const dir = artifactDirs[name]
  const manifest = JSON.parse(await fs.readFile(path.join(dir, 'manifest.json'), 'utf8'))

  const cached = loaded.get(name)
  if (cached?.version === manifest.version) return cached

  // The ESM cache is keyed by URL, so a version-suffixed URL hot-loads the
  // new bundle without a restart. Old versions stay in memory (can't be
  // evicted) — production hosts recycle workers/processes instead.
  const serverUrl = pathToFileURL(path.join(dir, manifest.serverEntry)).href
  const entry = {
    version: manifest.version,
    module: await import(`${serverUrl}?v=${manifest.version}`),
    clientScript: `/static/${name}/${manifest.clientEntry}?v=${manifest.version}`,
  }
  loaded.set(name, entry)
  console.log(`[host] ${cached ? 'hot-loaded' : 'loaded'} ${name}@${manifest.version}`)
  return entry
}

/** Bring every micro app up to its currently-deployed version. */
export async function refreshMicroApps() {
  await Promise.all(appNames.map(resolveApp))
  return loaded
}

setMicroAppProvider({
  get: (id) => loaded.get(id)?.module.default,
  // SSR never lazy-loads: refreshMicroApps() runs before each render.
  load: () => Promise.resolve(),
})
