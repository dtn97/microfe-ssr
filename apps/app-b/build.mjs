import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as esbuild from 'esbuild'

const root = path.dirname(fileURLToPath(import.meta.url))
const watch = process.argv.includes('--watch')
const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'))
const { name } = pkg

// Multi-entry (client side): every src/entries/<module>.client.ts is an
// exposed module. All client entries build together with `splitting`, so
// code shared between modules is emitted once into chunks/ — and dynamic
// import() inside a module gets its own on-demand chunk.
const entryFiles = await fs.readdir(path.join(root, 'src/entries'))
const entriesOf = (side) =>
  entryFiles
    .filter((f) => new RegExp(`\\.${side}\\.[jt]s$`).test(f))
    .map((f) => path.join(root, 'src/entries', f))

// Server side: ONE bundle per micro app (src/server.js exports each module
// as a named export), no splitting — SSR gains nothing from it, and a single
// file keeps hot-loading simple. Dynamic imports are inlined. React stays
// external so the whole server process shares one React copy.
const serverConfig = {
  entryPoints: [path.join(root, 'src/server.ts')],
  outfile: path.join(root, 'dist/server/index.js'),
  bundle: true,
  format: 'esm',
  platform: 'node',
  packages: 'external',
  jsx: 'automatic',
  metafile: true,
  // '@microfe/sdk' is host-provided (alias wins over packages:'external');
  // the server shim reads the global the host sets before importing us.
  alias: {
    '@microfe/sdk': path.join(root, 'shims/microfe-sdk-server-shim.cjs'),
  },
  logLevel: 'info',
}

// Client side: React/Router are aliased to the host SDK's shared runtime, so
// these ESM bundles contain only the app's own code. Chunk filenames carry a
// content hash; entry URLs are cache-busted by the manifest version instead.
const clientConfig = {
  entryPoints: entriesOf('client'),
  outdir: path.join(root, 'dist/client'),
  bundle: true,
  splitting: true,
  format: 'esm',
  platform: 'browser',
  jsx: 'automatic',
  chunkNames: 'chunks/[name]-[hash]',
  metafile: true,
  alias: {
    '@microfe/sdk': path.join(root, 'shims/microfe-sdk-client-shim.cjs'),
    'react/jsx-runtime': path.join(root, 'shims/jsx-runtime-shim.cjs'),
    'react-router-dom': path.join(root, 'shims/react-router-dom-shim.cjs'),
    react: path.join(root, 'shims/react-shim.cjs'),
  },
  logLevel: 'info',
}

// metafile → { moduleName: dist-relative entry path }, e.g. b1.client.js
// produced dist/client/b1.client.js → { b1: 'client/b1.client.js' }.
// Only files under src/entries/ count as exposed modules — esbuild also
// tags dynamically-imported chunks (React.lazy) with an entryPoint, and
// those are internal to their module, not part of the app's contract.
function entryOutputs(metafile) {
  const map = {}
  const entriesDir = path.join(root, 'src/entries')
  for (const [outPath, out] of Object.entries(metafile.outputs)) {
    if (!out.entryPoint || !path.resolve(out.entryPoint).startsWith(entriesDir)) continue
    const moduleName = path.basename(out.entryPoint).split('.')[0]
    map[moduleName] = path.relative(path.join(root, 'dist'), path.resolve(outPath))
  }
  return map
}

// Publish the deploy manifest: the app's single server bundle + per-module
// client entries, with a content-hash version over ALL artifacts (entries
// and chunks), so any change bumps the version.
async function publishManifest(serverMeta, clientMeta) {
  const files = [...Object.keys(serverMeta.outputs), ...Object.keys(clientMeta.outputs)].sort()
  const hash = crypto.createHash('sha256')
  for (const f of files) hash.update(await fs.readFile(path.resolve(f)))
  const version = hash.digest('hex').slice(0, 12)

  const client = entryOutputs(clientMeta)
  // A module that embeds other micro apps declares them in package.json
  // ("microfe.modules.<m>.uses") so the host can preload them before
  // hydrating a page whose SSR output contains the nested app.
  const usesOf = (m) => pkg.microfe?.modules?.[m]?.uses ?? []
  const manifest = {
    name,
    version,
    server: 'server/index.js', // the one server bundle (fixed outfile)
    modules: Object.fromEntries(
      Object.keys(client).map((m) => [
        m,
        { client: client[m], ...(usesOf(m).length ? { uses: usesOf(m) } : {}) },
      ]),
    ),
  }
  await fs.writeFile(path.join(root, 'dist/manifest.json'), JSON.stringify(manifest, null, 2))
  console.log(
    `[${name}] published manifest version ${version} (modules: ${Object.keys(client).join(', ')})`,
  )
}

if (watch) {
  // Dev mode: rebuild on save and republish the manifest, which the running
  // host picks up on the next request — no host restart, just refresh.
  const metas = { server: null, client: null }
  const manifestPlugin = (side) => ({
    name: 'publish-manifest',
    setup(build) {
      build.onEnd((result) => {
        if (result.errors.length) return
        metas[side] = result.metafile
        if (metas.server && metas.client) publishManifest(metas.server, metas.client)
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
