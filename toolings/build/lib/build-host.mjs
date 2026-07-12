import path from 'node:path'
import * as esbuild from 'esbuild'

/**
 * Build the host (loaded config from lib/config.mjs). The host owns two
 * bundles at fixed paths the runtime hard-depends on — the client SDK served
 * at /public/microfe-sdk.js and the server entry run by `pnpm start` — so
 * unlike micro app artifacts these filenames are NOT content-hashed.
 * With `watch`, rebuild both on every save.
 */
export async function runHostBuild({ root, name, client, server, outDir }, { watch = false } = {}) {
  const distDir = path.resolve(root, outDir)

  // Client SDK: the one browser bundle that actually contains React + Router —
  // micro apps reference them through window.__MICROFE__ instead of bundling
  // their own copies. Also contains the host's App shell for hydration.
  const clientConfig = {
    entryPoints: [path.resolve(root, client)],
    outfile: path.join(distDir, 'public', 'microfe-sdk.js'),
    bundle: true,
    format: 'iife',
    platform: 'browser',
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
    logLevel: 'info',
  }

  // Server: bundles the host's own JSX (App shell, routes); npm deps stay
  // external and micro app server bundles are dynamic-imported at runtime.
  const serverConfig = {
    entryPoints: [path.resolve(root, server)],
    outfile: path.join(distDir, 'server', 'server.js'),
    bundle: true,
    platform: 'node',
    format: 'esm',
    packages: 'external',
    jsx: 'automatic',
    logLevel: 'info',
  }

  if (watch) {
    // Dev mode. A rebuilt server bundle restarts the host (node --watch-path);
    // a rebuilt SDK triggers a live-reload broadcast (the host watches the file).
    const contexts = await Promise.all([
      esbuild.context(clientConfig),
      esbuild.context(serverConfig),
    ])
    await Promise.all(contexts.map((ctx) => ctx.watch()))
    console.log(`[${name}] watching for changes…`)
  } else {
    await esbuild.build(clientConfig)
    await esbuild.build(serverConfig)
    console.log(`[${name}] built host (client: public/microfe-sdk.js, server: server/server.js)`)
  }
}
