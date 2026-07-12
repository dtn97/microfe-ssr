/**
 * Isomorphic micro app runtime.
 *
 * `getMicroAppComponent(id)` turns a micro app identifier into a regular
 * React component the host can put in its route config / JSX. Where the
 * component actually comes from is pluggable per environment:
 *   - server: the app's SSR bundle, hot-loaded by registry.ts
 *   - client: the SDK registry, lazy-loading the app's bundle on demand
 */
import * as React from 'react'

export type MicroAppProps = Record<string, unknown>
export type MicroAppComponent = React.ComponentType<MicroAppProps>

export interface MicroAppProvider {
  get(id: string): MicroAppComponent | undefined
  load(id: string): Promise<unknown>
}

let provider: MicroAppProvider | null = null

export function setMicroAppProvider(p: MicroAppProvider) {
  provider = p
}

export function getMicroAppComponent(id: string): MicroAppComponent {
  function MicroApp(props: MicroAppProps) {
    const [, force] = React.useReducer((x: number) => x + 1, 0)
    const Component = provider?.get(id)

    // Client-only (effects don't run during SSR): fetch the bundle if the
    // app isn't registered yet, then re-render.
    React.useEffect(() => {
      if (!Component) provider?.load(id).then(force)
    }, [Component])

    if (!Component) return React.createElement('p', null, `Loading ${id}…`)
    return React.createElement(Component, props)
  }
  MicroApp.displayName = `MicroApp(${id})`
  return MicroApp
}
