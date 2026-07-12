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
import { getMicroAppComponent, setMicroAppProvider } from './app/runtime.js'

// import.meta.url is the *bundled* location: host/dist/server/server.js
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '../../..')

// In production this would be a discovery service / CDN base URL per app.
export const artifactDirs = {
  'app-a': path.join(rootDir, 'apps/app-a/dist'),
  'app-b': path.join(rootDir, 'apps/app-b/dist'),
  'app-c': path.join(rootDir, 'apps/app-c/dist'),
}
export const appNames = Object.keys(artifactDirs)

const loaded = new Map() // app name -> { version, serverExports, clientUrls: {m: url} }

async function resolveApp(name) {
  const dir = artifactDirs[name]
  const manifest = JSON.parse(await fs.readFile(path.join(dir, 'manifest.json'), 'utf8'))

  const cached = loaded.get(name)
  if (cached?.version === manifest.version) return cached

  // One server bundle per app; each exposed module is a named export. The
  // ESM cache is keyed by URL, so a version-suffixed URL hot-loads the new
  // bundle without a restart. Old versions stay in memory (can't be
  // evicted) — production hosts recycle processes.
  const serverUrl = pathToFileURL(path.join(dir, manifest.server)).href
  const serverExports = await import(`${serverUrl}?v=${manifest.version}`)

  const clientUrls = Object.fromEntries(
    Object.entries(manifest.modules).map(([m, { client }]) => [
      m,
      `/static/${name}/${client}?v=${manifest.version}`,
    ]),
  )
  const uses = Object.fromEntries(
    Object.entries(manifest.modules).map(([m, meta]) => [m, meta.uses ?? []]),
  )

  const entry = { version: manifest.version, serverExports, clientUrls, uses }
  loaded.set(name, entry)
  console.log(
    `[host] ${cached ? 'hot-loaded' : 'loaded'} ${name}@${manifest.version} (${Object.keys(clientUrls).join(', ')})`,
  )
  return entry
}

/** Bring every micro app up to its currently-deployed version. */
export async function refreshMicroApps() {
  await Promise.all(appNames.map(resolveApp))
  return loaded
}

setMicroAppProvider({
  // id is "<app>/<module>", e.g. "app-b/b1" → named export of the app bundle
  get: (id) => {
    const [app, moduleName] = id.split('/')
    return loaded.get(app)?.serverExports[moduleName]
  },
  // SSR never lazy-loads: refreshMicroApps() runs before each render.
  load: () => Promise.resolve(),
})

// Server-side face of '@microfe/sdk': micro app server bundles alias the
// package to a shim reading this global, so a micro app can embed another
// micro app (B2 renders app-c/main) through the same provider.
globalThis.__MICROFE_SSR__ = { getMicroAppComponent }
