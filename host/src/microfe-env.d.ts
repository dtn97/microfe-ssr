/**
 * Ambient declarations for the host's two runtime globals, built on the shared
 * '@microfe/types' contract:
 *  - window.__MICROFE__ — the client SDK (shared React/Router + registry)
 *  - globalThis.__MICROFE_SSR__ — the server face of '@microfe/sdk'
 */
import type {
  MicrofeBootstrap as MicrofeBootstrapBase,
  MicrofeSdk,
  MicrofeSsr,
} from '@microfe/types'
import type { PageProps } from './app/App'

declare global {
  /** The bootstrap payload the server embeds, with the host's concrete page props. */
  type MicrofeBootstrap = MicrofeBootstrapBase<PageProps>

  interface Window {
    __MICROFE__: MicrofeSdk
  }

  var __MICROFE_SSR__: MicrofeSsr
}
