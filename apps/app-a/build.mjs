import * as esbuild from 'esbuild'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const watch = process.argv.includes('--watch')
const { name } = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'))

// Multi-entry: every src/entries/<module>.server.js + <module>.client.js pair
// is an exposed module. All entries of a side build together with `splitting`,
// so code shared between modules is emitted once into chunks/.
const entryFiles = await fs.readdir(path.join(root, 'src/entries'))
const entriesOf = (side) =>
  entryFiles.filter((f) => f.endsWith(`.${side}.js`)).map((f) => path.join(root, 'src/entries', f))

// Server side: runs in Node inside the host. React stays external so the
// whole server process shares one React copy.
const serverConfig = {
  entryPoints: entriesOf('server'),
  outdir: path.join(root, 'dist/server'),
  bundle: true,
  splitting: true,
  format: 'esm',
  platform: 'node',
  packages: 'external',
  jsx: 'automatic',
  chunkNames: 'chunks/[name]-[hash]',
  metafile: true,
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
    'react/jsx-runtime': path.join(root, 'shims/jsx-runtime-shim.cjs'),
    'react-router-dom': path.join(root, 'shims/react-router-dom-shim.cjs'),
    react: path.join(root, 'shims/react-shim.cjs'),
  },
  logLevel: 'info',
}

// metafile → { moduleName: dist-relative entry path }, e.g. b1.server.js
// produced dist/server/b1.server.js → { b1: 'server/b1.server.js' }
function entryOutputs(metafile) {
  const map = {}
  for (const [outPath, out] of Object.entries(metafile.outputs)) {
    if (!out.entryPoint) continue
    const moduleName = path.basename(out.entryPoint).split('.')[0]
    map[moduleName] = path.relative(path.join(root, 'dist'), path.resolve(outPath))
  }
  return map
}

// Publish the deploy manifest: exposed modules + a content-hash version over
// ALL artifacts (entries and chunks), so any change bumps the version.
async function publishManifest(serverMeta, clientMeta) {
  const files = [...Object.keys(serverMeta.outputs), ...Object.keys(clientMeta.outputs)].sort()
  const hash = crypto.createHash('sha256')
  for (const f of files) hash.update(await fs.readFile(path.resolve(f)))
  const version = hash.digest('hex').slice(0, 12)

  const server = entryOutputs(serverMeta)
  const client = entryOutputs(clientMeta)
  const manifest = {
    name,
    version,
    modules: Object.fromEntries(
      Object.keys(server).map((m) => [m, { server: server[m], client: client[m] }]),
    ),
  }
  await fs.writeFile(path.join(root, 'dist/manifest.json'), JSON.stringify(manifest, null, 2))
  console.log(`[${name}] published manifest version ${version} (modules: ${Object.keys(server).join(', ')})`)
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
