/**
 * Ambient environment a micro app builds against: the host-provided
 * '@microfe/sdk' module and the SDK global its client entries register with.
 * (In a real multi-repo setup this would ship as the sdk package's types.)
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
