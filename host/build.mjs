import * as esbuild from 'esbuild'

const watch = process.argv.includes('--watch')

// Client SDK: the one browser bundle that actually contains React + Router —
// micro apps reference them through window.__MICROFE__ instead of bundling
// their own copies. Also contains the host's App shell for hydration.
const clientConfig = {
  entryPoints: ['src/client.tsx'],
  outfile: 'dist/public/microfe-sdk.js',
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
  entryPoints: ['src/server.tsx'],
  outfile: 'dist/server/server.js',
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
  const contexts = await Promise.all([esbuild.context(clientConfig), esbuild.context(serverConfig)])
  await Promise.all(contexts.map((ctx) => ctx.watch()))
  console.log('[host] watching for changes…')
} else {
  await esbuild.build(clientConfig)
  await esbuild.build(serverConfig)
}
