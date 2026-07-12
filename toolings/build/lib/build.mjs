import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as esbuild from 'esbuild'

// Host-SDK shims ship with this package, so micro apps don't carry them.
const shimsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../shims')

// The server bundle exports each module under its moduleId's last segment
// ('app-b/b1' → `export { default as b1 }` in the server entry).
const exportNameOf = (moduleId) => moduleId.split('/').at(-1)

/**
 * Build a micro app (loaded config from lib/config.mjs) and publish its
 * deploy manifest. With `watch`, rebuild and republish on every save.
 */
export async function runBuild({ root, name, modules, server, outDir }, { watch = false } = {}) {
  const distDir = path.resolve(root, outDir)

  // Reverse map to read esbuild's metafile back into moduleIds.
  const moduleOfEntry = new Map(modules.map((m) => [path.resolve(root, m.entry), m.moduleId]))

  // Server side: ONE bundle per micro app (the server entry exports each
  // module as a named export), no splitting — SSR gains nothing from it, and
  // a single file keeps hot-loading simple. Dynamic imports are inlined.
  // React stays external so the whole server process shares one React copy.
  const serverConfig = {
    entryPoints: [path.resolve(root, server)],
    outdir: path.join(distDir, 'server'),
    entryNames: '[name].[hash]', // server.<hash>.js — a deploy is a new file
    bundle: true,
    format: 'esm',
    platform: 'node',
    packages: 'external',
    jsx: 'automatic',
    metafile: true,
    // '@microfe/sdk' is host-provided (alias wins over packages:'external');
    // the server shim reads the global the host sets before importing us.
    alias: {
      '@microfe/sdk': path.join(shimsDir, 'microfe-sdk-server-shim.cjs'),
    },
    logLevel: 'info',
  }

  // Client side (multi-entry): every exposed module builds together with
  // `splitting`, so code shared between modules is emitted once into chunks/
  // — and dynamic import() inside a module gets its own on-demand chunk.
  // React/Router are aliased to the host SDK's shared runtime, so these ESM
  // bundles contain only the app's own code. Entry and chunk filenames carry
  // a content hash, so every artifact URL changes when its content does.
  const clientConfig = {
    entryPoints: modules.map((m) => path.resolve(root, m.entry)),
    outdir: path.join(distDir, 'client'),
    bundle: true,
    splitting: true,
    format: 'esm',
    platform: 'browser',
    jsx: 'automatic',
    entryNames: '[name].[hash]', // e.g. b1.client.<hash>.js
    chunkNames: 'chunks/[name]-[hash]',
    metafile: true,
    alias: {
      '@microfe/sdk': path.join(shimsDir, 'microfe-sdk-client-shim.cjs'),
      'react/jsx-runtime': path.join(shimsDir, 'jsx-runtime-shim.cjs'),
      'react-router-dom': path.join(shimsDir, 'react-router-dom-shim.cjs'),
      react: path.join(shimsDir, 'react-shim.cjs'),
    },
    logLevel: 'info',
  }

  // metafile → { moduleId: dist-relative entry path }, e.g. app-b/b1's entry
  // produced dist/client/b1.client.js → { 'app-b/b1': 'client/b1.client.js' }.
  // Only configured module entries count as exposed — esbuild also tags
  // dynamically-imported chunks (React.lazy) with an entryPoint, and those
  // are internal to their module, not part of the app's contract.
  function entryOutputs(metafile) {
    const map = {}
    for (const [outPath, out] of Object.entries(metafile.outputs)) {
      if (!out.entryPoint) continue
      const moduleId = moduleOfEntry.get(path.resolve(out.entryPoint))
      if (moduleId === undefined) continue
      map[moduleId] = path.relative(distDir, path.resolve(outPath))
    }
    return map
  }

  // The server build has exactly one entry; find its output in the metafile
  // (the filename carries a content hash, so it isn't known up front).
  function serverOutput(metafile) {
    const serverEntry = path.resolve(root, server)
    return Object.entries(metafile.outputs).find(
      ([, out]) => out.entryPoint && path.resolve(out.entryPoint) === serverEntry,
    )
  }

  // Every module must be a named export of the server bundle (checked
  // against the metafile, which lists the output's exports).
  function checkServerExports(serverMeta) {
    const [, serverOut] = serverOutput(serverMeta)
    const missing = modules
      .map((m) => exportNameOf(m.moduleId))
      .filter((e) => !serverOut.exports.includes(e))
    if (missing.length) {
      console.error(
        `[${name}] server entry (${server}) is missing named export(s): ${missing.join(', ')} — each moduleId's last segment must be exported`,
      )
      return false
    }
    return true
  }

  // Version = hash of the sorted output paths. Every output filename embeds
  // a content hash (entryNames/chunkNames), so any content change renames a
  // file and bumps the version — no need to re-read artifact bytes, which
  // can race with esbuild's watch-mode cleanup of old hashed outputs.
  function versionOf(serverMeta, clientMeta) {
    const files = [...Object.keys(serverMeta.outputs), ...Object.keys(clientMeta.outputs)].sort()
    return crypto.createHash('sha256').update(files.join('\n')).digest('hex').slice(0, 12)
  }

  // Publish the deploy manifest: the app's single server bundle + one entry
  // per moduleId, versioned over ALL artifacts (entries and chunks), so any
  // change bumps the version.
  async function publishManifest(serverMeta, clientMeta) {
    if (!checkServerExports(serverMeta)) {
      if (!watch) process.exit(1)
      return
    }
    const version = versionOf(serverMeta, clientMeta)

    const client = entryOutputs(clientMeta)
    const [serverOutPath] = serverOutput(serverMeta)
    const manifest = {
      name,
      version,
      // The one server bundle, e.g. server/server.<hash>.js — a new version
      // is a new path, so the host's import() naturally misses the ESM cache.
      server: path.relative(distDir, path.resolve(serverOutPath)),
      // One entry per module. `moduleId` is the globally unique id the host
      // loads modules by; `serverExport` names the module's named export in
      // the server bundle; `uses` lists nested modules preloaded before
      // hydration.
      modules: modules.map((m) => ({
        moduleId: m.moduleId,
        client: client[m.moduleId],
        serverExport: exportNameOf(m.moduleId),
        ...(m.uses?.length ? { uses: m.uses } : {}),
      })),
    }
    await fs.writeFile(path.join(distDir, 'manifest.json'), JSON.stringify(manifest, null, 2))
    console.log(
      `[${name}] published manifest version ${version} (modules: ${modules.map((m) => m.moduleId).join(', ')})`,
    )
  }

  if (watch) {
    // Dev mode: rebuild on save and republish the manifest, which the running
    // host picks up on the next request — no host restart, just refresh.
    // A save usually rebuilds BOTH sides; debounce so the manifest publishes
    // once, after the slower side lands (a publish of one fresh + one stale
    // metafile would reference hashed files the rebuild just replaced).
    const metas = { server: null, client: null }
    let publishTimer
    const manifestPlugin = (side) => ({
      name: 'publish-manifest',
      setup(build) {
        build.onEnd((result) => {
          if (result.errors.length) return
          metas[side] = result.metafile
          if (!(metas.server && metas.client)) return
          clearTimeout(publishTimer)
          publishTimer = setTimeout(() => {
            publishManifest(metas.server, metas.client).catch((err) => {
              console.error(`[${name}] manifest publish failed:`, err)
            })
          }, 100)
        })
      },
    })
    const contexts = await Promise.all([
      esbuild.context({ ...serverConfig, plugins: [manifestPlugin('server')] }),
      esbuild.context({ ...clientConfig, plugins: [manifestPlugin('client')] }),
    ])
    await Promise.all(contexts.map((ctx) => ctx.watch()))
    console.log(`[${name}] watching for changes…`)
  } else {
    const serverResult = await esbuild.build(serverConfig)
    const clientResult = await esbuild.build(clientConfig)
    await publishManifest(serverResult.metafile, clientResult.metafile)
  }
}
