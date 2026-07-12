import * as esbuild from 'esbuild'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const watch = process.argv.includes('--watch')
const { name } = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'))

// Server bundle: runs in Node inside the host. React stays external so the
// whole server process shares one React copy.
const serverConfig = {
  entryPoints: [path.join(root, 'src/entry-server.jsx')],
  outfile: path.join(root, 'dist/server/entry-server.js'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  packages: 'external',
  jsx: 'automatic',
  logLevel: 'info',
}

// Client bundle: React/Router are aliased to the host SDK's shared runtime,
// so this bundle contains only the app's own code (a few KB).
const clientConfig = {
  entryPoints: [path.join(root, 'src/entry-client.jsx')],
  outfile: path.join(root, 'dist/client/entry-client.js'),
  bundle: true,
  platform: 'browser',
  format: 'iife',
  jsx: 'automatic',
  alias: {
    'react/jsx-runtime': path.join(root, 'shims/jsx-runtime-shim.cjs'),
    'react-router-dom': path.join(root, 'shims/react-router-dom-shim.cjs'),
    react: path.join(root, 'shims/react-shim.cjs'),
  },
  logLevel: 'info',
}

// Publish a deploy manifest. The version is a content hash of the artifacts,
// so the host (and browser caches) detect a new release without restarts.
async function publishManifest() {
  const version = crypto
    .createHash('sha256')
    .update(await fs.readFile(serverConfig.outfile))
    .update(await fs.readFile(clientConfig.outfile))
    .digest('hex')
    .slice(0, 12)

  const manifest = {
    name,
    version,
    serverEntry: 'server/entry-server.js',
    clientEntry: 'client/entry-client.js',
  }
  await fs.writeFile(path.join(root, 'dist/manifest.json'), JSON.stringify(manifest, null, 2))
  console.log(`[${name}] published manifest version ${version}`)
}

if (watch) {
  // Dev mode: rebuild on save and republish the manifest, which the running
  // host picks up on the next request — no host restart, just refresh.
  const manifestPlugin = {
    name: 'publish-manifest',
    setup(build) {
      build.onEnd((result) => {
        if (result.errors.length === 0) publishManifest()
      })
    },
  }
  const contexts = await Promise.all([
    esbuild.context({ ...serverConfig, plugins: [manifestPlugin] }),
    esbuild.context({ ...clientConfig, plugins: [manifestPlugin] }),
  ])
  await Promise.all(contexts.map((ctx) => ctx.watch()))
  console.log(`[${name}] watching for changes…`)
} else {
  await esbuild.build(serverConfig)
  await esbuild.build(clientConfig)
  await publishManifest()
}
