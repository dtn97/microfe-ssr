/**
 * Ambient declarations for the host's two runtime globals:
 *  - window.__MICROFE__ — the client SDK (shared React/Router + registry)
 *  - globalThis.__MICROFE_SSR__ — the server face of '@microfe/sdk'
 */

/** The bootstrap payload the server embeds in the page for hydration. */
interface MicrofeBootstrap {
  initialPath: string
  initialModule: string
  preload: string[]
  pageProps: import('./app/App').PageProps
  versions: string[]
  /** moduleId -> client entry URL */
  modules: Record<string, string>
}

interface MicrofeSdk {
  React: typeof import('react')
  ReactDOMClient: typeof import('react-dom/client')
  jsxRuntime: typeof import('react/jsx-runtime')
  ReactRouterDOM: typeof import('react-router-dom')
  getMicroAppComponent: (id: string) => import('./app/runtime').MicroAppComponent
  register: (moduleId: string, Component: import('./app/runtime').MicroAppComponent) => void
}

interface Window {
  __MICROFE__: MicrofeSdk
}

declare var __MICROFE_SSR__: {
  getMicroAppComponent: (id: string) => import('./app/runtime').MicroAppComponent
}
