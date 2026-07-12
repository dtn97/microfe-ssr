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
import { fileURLToPath, pathToFileURL } from 'node:url'
import { getMicroAppComponent, type MicroAppComponent, setMicroAppProvider } from './app/runtime'

/** Deploy manifest published by each micro app build (dist/manifest.json). */
interface MicroAppManifest {
  name: string
  version: string
  server: string
  modules: Array<{
    /** Globally unique id the module is loaded by (e.g. "app-b/b1"). */
    moduleId: string
    /** Client entry path, relative to the app's artifact dir. */
    client: string
    /** Named export backing this module in the server bundle. */
    serverExport: string
    /** moduleIds this module embeds (preloaded before hydration). */
    uses?: string[]
  }>
}

/** A micro app resolved to its currently-deployed version. */
export interface LoadedMicroApp {
  version: string
  /** moduleId -> SSR component (the server bundle export for that module). */
  components: Record<string, MicroAppComponent>
  /** moduleId -> versioned client entry URL. */
  clientUrls: Record<string, string>
  /** moduleId -> moduleIds it embeds (preloaded before hydration). */
  uses: Record<string, string[]>
}

// import.meta.url is the *bundled* location: host/dist/server/server.js
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '../../..')

// In production this would be a discovery service / CDN base URL per app.
export const artifactDirs: Record<string, string> = {
  'app-a': path.join(rootDir, 'apps/app-a/dist'),
  'app-b': path.join(rootDir, 'apps/app-b/dist'),
  'app-c': path.join(rootDir, 'apps/app-c/dist'),
}
export const appNames = Object.keys(artifactDirs)

const loaded = new Map<string, LoadedMicroApp>()

async function resolveApp(name: string): Promise<LoadedMicroApp> {
  const dir = artifactDirs[name]
  const manifest: MicroAppManifest = JSON.parse(
    await fs.readFile(path.join(dir, 'manifest.json'), 'utf8'),
  )

  const cached = loaded.get(name)
  if (cached?.version === manifest.version) return cached

  // One server bundle per app; the manifest says which named export backs
  // each moduleId. The ESM cache is keyed by URL, so a version-suffixed URL
  // hot-loads the new bundle without a restart. Old versions stay in memory
  // (can't be evicted) — production hosts recycle processes.
  const serverUrl = pathToFileURL(path.join(dir, manifest.server)).href
  const serverExports: Record<string, MicroAppComponent> = await import(
    `${serverUrl}?v=${manifest.version}`
  )

  const components = Object.fromEntries(
    manifest.modules.map((m) => [m.moduleId, serverExports[m.serverExport]]),
  )
  const clientUrls = Object.fromEntries(
    manifest.modules.map((m) => [m.moduleId, `/static/${name}/${m.client}?v=${manifest.version}`]),
  )
  const uses = Object.fromEntries(manifest.modules.map((m) => [m.moduleId, m.uses ?? []]))

  const entry: LoadedMicroApp = { version: manifest.version, components, clientUrls, uses }
  loaded.set(name, entry)
  console.log(
    `[host] ${cached ? 'hot-loaded' : 'loaded'} ${name}@${manifest.version} (${Object.keys(components).join(', ')})`,
  )
  return entry
}

/** Bring every micro app up to its currently-deployed version. */
export async function refreshMicroApps() {
  await Promise.all(appNames.map(resolveApp))
  return loaded
}

setMicroAppProvider({
  // moduleIds are globally unique, so the first app exposing the id wins.
  get: (id) => {
    for (const app of loaded.values()) {
      if (id in app.components) return app.components[id]
    }
    return undefined
  },
  // SSR never lazy-loads: refreshMicroApps() runs before each render.
  load: () => Promise.resolve(),
})

// Server-side face of '@microfe/sdk': micro app server bundles alias the
// package to a shim reading this global, so a micro app can embed another
// micro app (B2 renders app-c/main) through the same provider.
globalThis.__MICROFE_SSR__ = { getMicroAppComponent }
