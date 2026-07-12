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
import * as jsxRuntime from 'react/jsx-runtime'
import * as ReactDOMClient from 'react-dom/client'
import * as ReactRouterDOM from 'react-router-dom'
import App from './app/App'
import { getMicroAppComponent, type MicroAppComponent, setMicroAppProvider } from './app/runtime'

interface Waiter {
  promise: Promise<MicroAppComponent>
  resolve: (component: MicroAppComponent) => void
}

const registry = new Map<string, MicroAppComponent>() // moduleId ("<app>/<module>") -> component
const waiters = new Map<string, Waiter>()
let bootstrap: MicrofeBootstrap | null = null // injected by the host page

function whenRegistered(moduleId: string): Promise<MicroAppComponent> {
  const registered = registry.get(moduleId)
  if (registered) return Promise.resolve(registered)
  let waiter = waiters.get(moduleId)
  if (!waiter) {
    let resolve!: (component: MicroAppComponent) => void
    const promise = new Promise<MicroAppComponent>((r) => {
      resolve = r
    })
    waiter = { promise, resolve }
    waiters.set(moduleId, waiter)
  }
  return waiter.promise
}

/**
 * Load a module's client entry on demand (no-op if already loaded/loading).
 * Entries are ES modules, so the browser fetches any shared chunks they
 * import automatically — and chunks already loaded for a sibling module
 * (e.g. b1 → b2) are served from cache.
 */
function ensureModule(moduleId: string): Promise<MicroAppComponent> {
  const registered = registry.get(moduleId)
  if (registered) return Promise.resolve(registered)
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

  // Also the client face of '@microfe/sdk' — lets one micro app embed
  // another (B2 renders app-c/main) through the same provider.
  getMicroAppComponent,

  /** Called by each micro app module's client entry with its moduleId. */
  register(moduleId, Component) {
    registry.set(moduleId, Component)
    console.log(`[microfe] registered "${moduleId}"`)
    waiters.get(moduleId)?.resolve(Component)
  },
}

function boot() {
  const rootEl = document.getElementById('root')
  const bootstrapEl = document.getElementById('microfe-bootstrap')
  if (!rootEl || !bootstrapEl?.textContent) return
  const data: MicrofeBootstrap = JSON.parse(bootstrapEl.textContent)
  bootstrap = data
  // The preload set (route module + nested apps it embeds) is already in the
  // page as <script type=module> tags; wait for ALL of them to register so
  // the first render — including nested micro apps — matches the SSR HTML.
  Promise.all(data.preload.map(whenRegistered)).then(() => {
    ReactDOMClient.hydrateRoot(
      rootEl,
      <ReactRouterDOM.BrowserRouter>
        <App initialPath={data.initialPath} pageProps={data.pageProps} versions={data.versions} />
      </ReactRouterDOM.BrowserRouter>,
    )
    console.log(`[microfe] hydrated "${data.initialModule}" at ${data.initialPath}`)
  })
}

boot()
