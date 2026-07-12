/**
 * One-command local dev: `pnpm dev`
 *
 *  - initial build of everything
 *  - watch-rebuild host (SDK + server bundle) and all micro apps on save
 *  - run the host under node --watch-path so a rebuilt server bundle
 *    restarts it (scoped to host/dist/server, so micro app deploys hot-load
 *    WITHOUT a restart, same as production)
 *  - MICROFE_DEV=1 enables the host's /dev/reload SSE endpoint; the page
 *    auto-reloads on micro app deploys, SDK rebuilds, and server restarts
 */
import { spawn, spawnSync } from 'node:child_process'

console.log('[dev] initial build…')
const build = spawnSync('node', ['common/scripts/install-run-rush.js', 'build'], {
  stdio: 'inherit',
})
if (build.status !== 0) process.exit(build.status ?? 1)

// Micro apps build through the shared @microfe/build CLI (their `dev`
// script); resolve its bin through each app's node_modules so this script
// needs no package-manager indirection.
const microAppDev = ['node_modules/@microfe/build/bin/microfe-build.js', 'dev']
const tasks = [
  { name: 'host ', cmd: 'node', args: ['build.mjs', '--watch'], cwd: 'host' },
  { name: 'app-a', cmd: 'node', args: microAppDev, cwd: 'apps/app-a' },
  { name: 'app-b', cmd: 'node', args: microAppDev, cwd: 'apps/app-b' },
  { name: 'app-c', cmd: 'node', args: microAppDev, cwd: 'apps/app-c' },
  {
    name: 'serve',
    cmd: 'node',
    args: ['--watch-path=host/dist/server', 'host/dist/server/server.js'],
    env: { MICROFE_DEV: '1' },
  },
]

const children = tasks.map(({ name, cmd, args, cwd, env }) => {
  const child = spawn(cmd, args, { cwd, env: { ...process.env, ...env } })
  const prefix = (data) =>
    String(data)
      .split('\n')
      .filter(Boolean)
      .forEach((line) => {
        console.log(`[${name}] ${line}`)
      })
  child.stdout.on('data', prefix)
  child.stderr.on('data', prefix)
  return child
})

const shutdown = () => {
  for (const child of children) child.kill('SIGTERM')
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
