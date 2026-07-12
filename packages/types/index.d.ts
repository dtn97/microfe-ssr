/**
 * Structural types for the microfe framework — the contract shared between the
 * host and the micro apps it embeds. Import these by name:
 *
 *   import type { MicroAppComponent, MicrofeBootstrap } from '@microfe/types'
 *
 * Micro apps that only need the ambient '@microfe/sdk' module and the
 * window.__MICROFE__ global should `import '@microfe/types/client'` instead.
 */
import type { ComponentType } from 'react'

/** Props passed to a micro app's root component. */
export type MicroAppProps = Record<string, unknown>

/**
 * A micro app exposed as a plain React component the host can mount.
 * Component props are contravariant, so any concrete component type is accepted.
 */
export type MicroAppComponent = ComponentType<MicroAppProps>

/**
 * The client SDK the host exposes on `window.__MICROFE__`: the shared runtime
 * (React + Router) plus the micro app registry.
 */
export interface MicrofeSdk {
  React: typeof import('react')
  ReactDOMClient: typeof import('react-dom/client')
  jsxRuntime: typeof import('react/jsx-runtime')
  ReactRouterDOM: typeof import('react-router-dom')
  getMicroAppComponent: (id: string) => MicroAppComponent
  register: (moduleId: string, Component: MicroAppComponent) => void
}

/** Server-side face of '@microfe/sdk', exposed on `globalThis.__MICROFE_SSR__`. */
export interface MicrofeSsr {
  getMicroAppComponent: (id: string) => MicroAppComponent
}

/**
 * The bootstrap payload the server embeds in the page for hydration. `TPageProps`
 * is the host's concrete page-props shape (defaults to `unknown` for consumers
 * that don't care).
 */
export interface MicrofeBootstrap<TPageProps = unknown> {
  initialPath: string
  initialModule: string
  preload: string[]
  pageProps: TPageProps
  versions: string[]
  /** moduleId -> client entry URL */
  modules: Record<string, string>
}
