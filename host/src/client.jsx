/**
 * MicroFE runtime SDK — the host's client entry, loaded once per page.
 *
 *  - Owns the shared runtime (React + Router), exposed on window.__MICROFE__
 *    for micro app bundles (they alias react/react-router-dom to it).
 *  - Plugs in the client-side provider behind getMicroAppComponent: read the
 *    registry, lazy-load a micro app's bundle when a route needs it.
 *  - Hydrates the same <App/> the server rendered.
 */
import * as React from 'react'
import * as ReactDOMClient from 'react-dom/client'
import * as jsxRuntime from 'react/jsx-runtime'
import * as ReactRouterDOM from 'react-router-dom'
import App from './app/App.jsx'
import { setMicroAppProvider } from './app/runtime.js'

const registry = new Map() // moduleId ("<app>/<module>") -> component
const waiters = new Map() // moduleId -> { promise, resolve }
let bootstrap = null // injected by the host page

function whenRegistered(moduleId) {
  if (registry.has(moduleId)) return Promise.resolve(registry.get(moduleId))
  if (!waiters.has(moduleId)) {
    let resolve
    const promise = new Promise((r) => (resolve = r))
    waiters.set(moduleId, { promise, resolve })
  }
  return waiters.get(moduleId).promise
}

/**
 * Load a module's client entry on demand (no-op if already loaded/loading).
 * Entries are ES modules, so the browser fetches any shared chunks they
 * import automatically — and chunks already loaded for a sibling module
 * (e.g. b1 → b2) are served from cache.
 */
function ensureModule(moduleId) {
  if (registry.has(moduleId)) return Promise.resolve(registry.get(moduleId))
  const url = bootstrap?.modules[moduleId]
  const alreadyInPage = document.querySelector(`script[data-microfe-entry="${moduleId}"]`)
  if (url && !alreadyInPage) {
    console.log(`[microfe] lazy-loading module "${moduleId}"`)
    const s = document.createElement('script')
    s.type = 'module'
    s.src = url
    s.dataset.microfeEntry = moduleId
    document.body.appendChild(s)
  }
  return whenRegistered(moduleId)
}

setMicroAppProvider({
  get: (id) => registry.get(id),
  load: ensureModule,
})

window.__MICROFE__ = {
  // Shared runtime, consumed by micro app bundles via alias shims.
  React,
  ReactDOMClient,
  jsxRuntime,
  ReactRouterDOM,

  /** Called by each micro app module's client entry with its moduleId. */
  register(moduleId, Component) {
    registry.set(moduleId, Component)
    console.log(`[microfe] registered "${moduleId}"`)
    waiters.get(moduleId)?.resolve(Component)
  },
}

function boot() {
  const rootEl = document.getElementById('root')
  if (!rootEl) return
  bootstrap = JSON.parse(document.getElementById('microfe-bootstrap').textContent)
  // The initial module's <script> is already in the page (right after this
  // one); wait for it to register so the first render matches the SSR HTML.
  whenRegistered(bootstrap.initialModule).then(() => {
    ReactDOMClient.hydrateRoot(
      rootEl,
      <ReactRouterDOM.BrowserRouter>
        <App
          initialPath={bootstrap.initialPath}
          pageProps={bootstrap.pageProps}
          versions={bootstrap.versions}
        />
      </ReactRouterDOM.BrowserRouter>,
    )
    console.log(`[microfe] hydrated "${bootstrap.initialModule}" at ${bootstrap.initialPath}`)
  })
}

boot()
