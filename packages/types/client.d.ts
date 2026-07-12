/**
 * Ambient environment a micro app builds against: the host-provided
 * '@microfe/sdk' module and the SDK global its client entries register with.
 * (In a real multi-repo setup this would ship as the sdk package's types.)
 *
 * This is a global ambient declaration file — it deliberately has no top-level
 * imports so that `declare module '@microfe/sdk'` is an ambient module rather
 * than an augmentation of a (non-existent) real module. Pull it into a micro
 * app with a triple-slash reference from the app's `src/microfe-env.d.ts`:
 *
 *   /// <reference types="@microfe/types/client" />
 */

declare module '@microfe/sdk' {
  export function getMicroAppComponent(
    id: string,
  ): import('react').ComponentType<Record<string, unknown>>
}

interface Window {
  __MICROFE__: {
    /** Component props are contravariant, so any component type is accepted. */
    register: (moduleId: string, component: import('react').ComponentType<never>) => void
  }
}
