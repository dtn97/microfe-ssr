/**
 * Isomorphic micro app runtime.
 *
 * `getMicroAppComponent(id)` turns a micro app identifier into a regular
 * React component the host can put in its route config / JSX. Where the
 * component actually comes from is pluggable per environment:
 *   - server: the app's SSR bundle, hot-loaded by registry.js
 *   - client: the SDK registry, lazy-loading the app's bundle on demand
 */
import * as React from 'react'

let provider = null // { get(id) -> Component | undefined, load(id) -> Promise }

export function setMicroAppProvider(p) {
  provider = p
}

export function getMicroAppComponent(id) {
  function MicroApp(props) {
    const [, force] = React.useReducer((x) => x + 1, 0)
    const Component = provider.get(id)

    // Client-only (effects don't run during SSR): fetch the bundle if the
    // app isn't registered yet, then re-render.
    React.useEffect(() => {
      if (!Component) provider.load(id).then(force)
    }, [Component])

    if (!Component) return React.createElement('p', null, `Loading ${id}…`)
    return React.createElement(Component, props)
  }
  MicroApp.displayName = `MicroApp(${id})`
  return MicroApp
}
