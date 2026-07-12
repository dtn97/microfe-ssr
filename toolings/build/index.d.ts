/** An exposed module of a micro app: one named client entry point. */
export interface MicroAppModule {
  /**
   * Globally unique module identifier — the id the host (and other micro
   * apps) load the module by, e.g. 'app-b/b1'. Client entries register with
   * the SDK under this exact id, and the server bundle must export the
   * module under the id's last '/'-segment (e.g. `export { default as b1 }`).
   */
  moduleId: string
  /** Client entry point, relative to the app root (e.g. 'src/entries/b1.client.ts'). */
  entry: string
  /**
   * moduleIds of other micro app modules this module embeds (e.g.
   * 'app-c/main'). Published in the manifest so the host preloads them
   * before hydrating a page that contains the nested app.
   */
  uses?: string[]
}

/**
 * A micro app's build configuration, exported from its microfe.config.js.
 * Built with `microfe-build-app`.
 */
export interface MicroAppConfig {
  /** Build type. Optional for apps; defaults to 'app'. */
  type?: 'app'
  /** Micro app name, published as the manifest `name`. */
  name: string
  /** Exposed modules: each entry becomes a client bundle listed in the manifest. */
  modules: MicroAppModule[]
  /** Server entry point, relative to the app root. Default: 'src/server.ts'. */
  server?: string
  /** Output directory, relative to the app root. Default: 'dist'. */
  outDir?: string
}

/**
 * The host's build configuration, exported from its microfe.config.js.
 * Built with `microfe-build-host`. Produces the client SDK bundle at
 * `<outDir>/public/microfe-sdk.js` and the server bundle at
 * `<outDir>/server/server.js` (fixed paths — not content-hashed).
 */
export interface HostConfig {
  /** Build type. Required to select the host build. */
  type: 'host'
  /** Host name (used only in build logs). */
  name: string
  /** Client SDK entry point, relative to the host root. Default: 'src/client.tsx'. */
  client?: string
  /** Server entry point, relative to the host root. Default: 'src/server.tsx'. */
  server?: string
  /** Output directory, relative to the host root. Default: 'dist'. */
  outDir?: string
}

/** Any microfe.config.js: a micro app or the host, discriminated by `type`. */
export type MicrofeConfig = MicroAppConfig | HostConfig

/** Identity helper so microfe.config.js gets type checking and completion. */
export declare function defineConfig<T extends MicrofeConfig>(config: T): T
