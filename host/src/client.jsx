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

const registry = new Map() // app name -> component
const waiters = new Map() // app name -> { promise, resolve }
let bootstrap = null // injected by the host page

function whenRegistered(name) {
  if (registry.has(name)) return Promise.resolve(registry.get(name))
  if (!waiters.has(name)) {
    let resolve
    const promise = new Promise((r) => (resolve = r))
    waiters.set(name, { promise, resolve })
  }
  return waiters.get(name).promise
}

/** Load an app's client bundle on demand (no-op if already loaded/loading). */
function ensureApp(name) {
  if (registry.has(name)) return Promise.resolve(registry.get(name))
  const info = bootstrap?.apps[name]
  const alreadyInPage = document.querySelector(`script[data-microfe-entry="${name}"]`)
  if (info && !alreadyInPage) {
    console.log(`[microfe] lazy-loading bundle for "${name}"`)
    const s = document.createElement('script')
    s.src = info.clientScript
    s.dataset.microfeEntry = name
    document.body.appendChild(s)
  }
  return whenRegistered(name)
}

setMicroAppProvider({
  get: (id) => registry.get(id),
  load: ensureApp,
})

window.__MICROFE__ = {
  // Shared runtime, consumed by micro app bundles via alias shims.
  React,
  ReactDOMClient,
  jsxRuntime,
  ReactRouterDOM,

  /** Called by each micro app's client bundle. */
  register(name, Component) {
    registry.set(name, Component)
    console.log(`[microfe] registered "${name}"`)
    waiters.get(name)?.resolve(Component)
  },
}

function boot() {
  const rootEl = document.getElementById('root')
  if (!rootEl) return
  bootstrap = JSON.parse(document.getElementById('microfe-bootstrap').textContent)
  // The initial app's <script> is already in the page (right after this one);
  // wait for it to register so the first client render matches the SSR HTML.
  whenRegistered(bootstrap.initialApp).then(() => {
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
    console.log(`[microfe] hydrated "${bootstrap.initialApp}" at ${bootstrap.initialPath}`)
  })
}

boot()
