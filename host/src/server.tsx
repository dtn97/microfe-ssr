/**
 * Host orchestrator — Express bootstrap + SSR.
 *
 * The page is one React tree owned by the host (App.tsx: header + routed
 * micro app content + footer). Micro apps appear in it as regular components
 * via getMicroAppComponent(); registry.ts hot-loads their server bundles.
 */
import { watch } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server.js'
import App from './app/App'
import { routes } from './app/routes'
import { appNames, artifactDirs, type LoadedMicroApp, refreshMicroApps } from './registry'

// import.meta.url is the *bundled* location: host/dist/server/server.js
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '../../..')

const escapeJson = (obj: unknown) => JSON.stringify(obj).replace(/</g, '\\u003c')

// --- Dev-only live reload ---------------------------------------------------
// The browser holds an SSE connection to /dev/reload.
//  - micro app rebuilt → its manifest.json changes → broadcast "reload"
//  - host SDK rebuilt → microfe-sdk.js changes → broadcast "reload"
//  - host server rebuilt → node --watch-path restarts the process → the SSE
//    connection drops and the client reloads once it reconnects
const isDev = process.env.MICROFE_DEV === '1'

function setupLiveReload(app: express.Express) {
  const clients = new Set<express.Response>()
  app.get('/dev/reload', (req, res) => {
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })
    res.flushHeaders()
    clients.add(res)
    req.on('close', () => clients.delete(res))
  })

  let timer: NodeJS.Timeout | undefined
  const broadcast = () => {
    clearTimeout(timer) // debounce: one rebuild touches several files
    timer = setTimeout(() => {
      console.log(`[host] dev change detected → reloading ${clients.size} client(s)`)
      for (const c of clients) c.write('data: reload\n\n')
    }, 200)
  }

  for (const dir of Object.values(artifactDirs)) {
    watch(dir, (_event, filename) => filename === 'manifest.json' && broadcast())
  }
  watch(path.join(rootDir, 'host/dist/public'), (_event, filename) => {
    if (filename === 'microfe-sdk.js') broadcast()
  })
}

const devReloadScript = isDev
  ? `
  <script>
    (() => {
      let dropped = false
      const connect = () => {
        const es = new EventSource('/dev/reload')
        es.onmessage = (e) => e.data === 'reload' && location.reload()
        es.onopen = () => dropped && location.reload() // host server restarted
        es.onerror = () => { dropped = true; es.close(); setTimeout(connect, 400) }
      }
      connect()
    })()
  </script>`
  : ''

function page({ html, bootstrap }: { html: string; bootstrap: MicrofeBootstrap }) {
  // The route's module plus everything it (transitively) embeds: their
  // entries must load before hydration so the first render matches the SSR.
  const preloadScripts = bootstrap.preload
    .map(
      (id) =>
        `  <script type="module" src="${bootstrap.modules[id]}" data-microfe-entry="${id}"></script>`,
    )
    .join('\n')
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>MicroFE hybrid rendering POC</title>
  <style>
    body { font-family: -apple-system, sans-serif; max-width: 720px; margin: 0 auto; padding: 0 1rem; }
    #root { display: flex; flex-direction: column; min-height: 100vh; }
    header { display: flex; align-items: baseline; gap: 1.5rem; padding: 1rem 0; border-bottom: 2px solid #e5e7eb; }
    header .brand { font-size: 1.25rem; font-weight: 700; }
    header nav { display: flex; gap: 1rem; }
    header .badge, footer { color: #6b7280; font-size: 0.85rem; }
    header .badge { margin-left: auto; }
    main { flex: 1; padding: 1rem 0; }
    footer { border-top: 2px solid #e5e7eb; padding: 1rem 0; }
    button { cursor: pointer; }
  </style>
</head>
<body>
  <div id="root">${html}</div>
  <script type="application/json" id="microfe-bootstrap">${escapeJson(bootstrap)}</script>
  <script src="/sdk/microfe-sdk.js"></script>
${preloadScripts}${devReloadScript}
</body>
</html>`
}

const server = express()

if (isDev) setupLiveReload(server)

server.use('/sdk', express.static(path.join(rootDir, 'host/dist/public')))
for (const name of appNames) {
  server.use(`/static/${name}`, express.static(artifactDirs[name]))
}

for (const route of routes) {
  server.get(route.link, async (req, res, next) => {
    try {
      const entries = await refreshMicroApps()
      const appOf = (name: string): LoadedMicroApp => {
        const entry = entries.get(name)
        if (!entry) throw new Error(`unknown micro app "${name}"`)
        return entry
      }
      // moduleIds are globally unique, so all apps' maps merge conflict-free.
      const allUses = Object.assign({}, ...appNames.map((n) => appOf(n).uses))
      const allClientUrls: Record<string, string> = Object.assign(
        {},
        ...appNames.map((n) => appOf(n).clientUrls),
      )

      // The route's module + transitive `uses` dependencies (nested apps).
      const preload: string[] = []
      const queue = [route.moduleId]
      while (queue.length) {
        const id = queue.shift()
        if (!id || preload.includes(id)) continue
        preload.push(id)
        queue.push(...(allUses[id] ?? []))
      }

      const bootstrap: MicrofeBootstrap = {
        initialPath: req.path,
        initialModule: route.moduleId,
        preload,
        pageProps: { renderedAt: new Date().toLocaleTimeString() },
        versions: appNames.map((n) => `${n}@${appOf(n).version}`),
        // moduleId -> client entry URL; lets the SDK lazy-load any exposed
        // module on navigation (shared chunks load via the entry's imports).
        modules: allClientUrls,
      }

      const html = renderToString(
        <StaticRouter location={req.path}>
          <App
            initialPath={bootstrap.initialPath}
            pageProps={bootstrap.pageProps}
            versions={bootstrap.versions}
          />
        </StaticRouter>,
      )

      res.send(page({ html, bootstrap }))
    } catch (err) {
      next(err)
    }
  })
}

const port = process.env.PORT || 3000
server.listen(port, () => {
  console.log(`[host] listening on http://localhost:${port}`)
})
