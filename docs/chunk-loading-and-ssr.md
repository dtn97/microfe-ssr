# Deep dive: how micro app chunks are loaded and SSR-rendered

There are two different "chunk loading" problems in this architecture — one in
Node (the SSR bundle) and one in the browser (the client bundle) — and one
trick that ties them together (`getMicroAppComponent`). This document follows
a request end to end through the actual code.

## The artifacts: what a "chunk" is here

A micro app is **multi-entry**: every `src/entries/<module>.server.js` +
`<module>.client.js` pair is an exposed module (app-b exposes `b1` and `b2`;
app-a exposes just `main`). Each side builds all entries together with esbuild
`splitting: true`, so code shared between modules — like app-b's `Panel`
component and the runtime shims — is emitted once into `chunks/`
([apps/app-b/build.mjs](../apps/app-b/build.mjs)):

| Artifact | Runs where | Contains |
|---|---|---|
| `dist/server/<module>.server.js` | Node, inside the host | The module's page component, ESM entry. React/Router left as bare `import`s (`packages: 'external'`) |
| `dist/server/chunks/chunk-*.js` | Node | Code shared between the app's server entries |
| `dist/client/<module>.client.js` | Browser | ES-module entry, a few KB: imports the page from the shared chunk, registers with the SDK |
| `dist/client/chunks/chunk-*.js` | Browser | Code shared between the app's client entries (content-hashed filename) |
| `dist/manifest.json` | Read by host | `{ name, version: <content-hash over ALL artifacts>, modules: { b1: { server, client }, … } }` |

The manifest is the contract: the host never hardcodes bundle paths, module
lists, or versions — it discovers them here, per request. Identifiers are
two-level: `getMicroAppComponent('app-b/b1')` = app `app-b`, module `b1`.

## Server side: loading the SSR chunk and rendering

When a request for `/` arrives ([host/src/server.jsx](../host/src/server.jsx)),
before rendering anything the handler calls `refreshMicroApps()`
([host/src/registry.js](../host/src/registry.js)), which for each app does:

```js
const manifest = JSON.parse(await fs.readFile(dir + '/manifest.json'))     // 1
if (cached?.version === manifest.version) return cached                    // 2
for (const [moduleName, m] of Object.entries(manifest.modules))            // 3
  modules[moduleName] = await import(`${serverUrl(m)}?v=${manifest.version}`)
```

Step 3 is the actual chunk load, and the `?v=` is the whole trick. Node's ESM
module cache is keyed by the **exact URL string**:

- same URL → instant cache hit, no disk I/O, no re-evaluation;
- new version → new URL → Node loads and evaluates the new file even though
  the path on disk is identical.

That's why a micro app deploy takes effect on the next request with no host
restart. The cost: old module versions can never be evicted from the ESM
cache — memory grows with each deploy until the process recycles (production
hosts recycle workers/processes for this reason).

Shared chunks compose cleanly with this: `b1.server.js?v=X` imports
`./chunks/chunk-KUJVUUPY.js` *relatively*, and relative resolution drops the
query — so when b2's entry imports the same chunk, Node reuses the already
loaded instance (shared module state within one version). A new deploy emits a
chunk with a new content-hash filename, so new entries never collide with old
cached chunks.

When the module evaluates, its `import 'react'` statements resolve through
Node's normal algorithm to the workspace-hoisted `node_modules` — so the
chunk's components are built from the *same React instance* the host renders
with. That's what makes single-tree composition possible.

### The `getMicroAppComponent` indirection

The loaded module's default export is just a React component. The registry
plugs it into the provider:

```js
setMicroAppProvider({
  get: (id) => {           // id = "<app>/<module>"
    const [app, moduleName] = id.split('/')
    return loaded.get(app)?.modules[moduleName]?.default
  },
  load: () => Promise.resolve(),   // SSR never lazy-loads; refresh ran already
})
```

Meanwhile, at module load time, [host/src/app/routes.jsx](../host/src/app/routes.jsx)
called `getMicroAppComponent('app-a/main')`, which returned a **stable wrapper
component** ([host/src/app/runtime.js](../host/src/app/runtime.js)). The
wrapper doesn't hold the micro app's component — it asks the provider *at
render time*:

```js
function MicroApp(props) {
  const Component = provider.get(id)   // resolved per render, not per import
  ...
  return React.createElement(Component, props)
}
```

This indirection is why hot-loading is invisible to the rest of the host: the
route config holds the same `MicroApp(app-a/main)` object forever, but each render
reads whatever version the registry currently has.

### One render pass

SSR is a single ordinary React render:

```jsx
renderToString(
  <StaticRouter location={req.path}>
    <App initialPath=... pageProps=... versions=... />
  </StaticRouter>
)
```

React walks: `App` → `Header` → `Routes` matches `/` → `MicroApp(app-a/main)` →
provider returns app-a's component → its JSX becomes HTML, inline with the
host's chrome. One tree, one render pass, router context flowing across the
host/micro-app boundary because there's one React and one react-router module
in the process. On the server the wrapper's `useEffect` never runs, so the
"load it" branch is dead code there — SSR either has the component (refresh
guaranteed it) or would render the loading placeholder.

### The response

The page embeds everything the client needs to take over:

```html
<div id="root">{...SSR HTML...}</div>
<script type="application/json" id="microfe-bootstrap">
  { "initialPath": "/", "initialModule": "app-a/main",
    "pageProps": { "renderedAt": "..." },
    "modules": { "app-a/main": ".../main.client.js?v=a01...",
                 "app-b/b1":   ".../b1.client.js?v=236...",
                 "app-b/b2":   ".../b2.client.js?v=236..." } }
</script>
<script src="/sdk/microfe-sdk.js"></script>
<script type="module" src="/static/app-a/client/main.client.js?v=a01..." data-microfe-entry="app-a/main"></script>
```

- `pageProps` are the **exact SSR inputs**, serialized so the client hydrates
  with identical data (no markup mismatch).
- `modules` is the **lazy-load map** for every exposed module of every app.
- Note what's *not* there: b1/b2's script tags. Only the matched route's
  module ships with the page.

## Client side: hydration, then lazy chunks

The browser paints the SSR HTML before executing any JS — that's the hybrid
rendering payoff. Then scripts execute in document order:

**1. The SDK** ([host/src/client.jsx](../host/src/client.jsx)) sets up the
registry (`Map` of name → component), plugs in the client provider, exposes
the shared runtime on `window.__MICROFE__`, and calls `boot()`. Boot parses
the bootstrap JSON and then *waits*: `whenRegistered('app-a/main')` returns a
promise that only resolves when someone registers that module.

**2. The initial module's entry** (the `type="module"` script tag) executes
after the SDK (module scripts run post-parse; the SDK is a classic script that
ran during parse). Compiled against the shims, its `import ... from 'react'`
already resolved to `window.__MICROFE__.React` inside the shared chunk it
pulls in. Its own body is effectively one line:

```js
window.__MICROFE__.register('app-a/main', Home)   // resolves boot's waiter
```

**3. Hydration.** The waiter resolves, and boot runs:

```jsx
hydrateRoot(rootEl,
  <BrowserRouter>
    <App initialPath={bootstrap.initialPath} pageProps={bootstrap.pageProps} ... />
  </BrowserRouter>)
```

This renders the *identical* tree the server did — same `App`, same route
match, same props — so React attaches event handlers to the existing DOM
instead of rebuilding it. The waiter dance in steps 1–2 exists precisely so
the first client render already has app-a's real component rather than a
"Loading…" placeholder that wouldn't match the SSR HTML.

**4. Navigation = lazy chunk load.** Click "Go to Page B1": the router
re-renders `Routes`, which mounts `MicroApp(app-b/b1)`. Now the client
provider's path in the wrapper actually executes:

```js
const Component = provider.get('app-b/b1')        // undefined — not registered
if (!Component) return <p>Loading app-b/b1…</p>   // rendered for a few ms
// meanwhile, in useEffect:
provider.load('app-b/b1').then(force)             // → ensureModule('app-b/b1')
```

`ensureModule` injects the module's ES-module entry:

```js
const s = document.createElement('script')
s.type = 'module'
s.src = bootstrap.modules['app-b/b1']     // versioned URL → cache-busts on deploy
document.body.appendChild(s)
return whenRegistered('app-b/b1')         // resolves when the entry calls register()
```

Because the entry is an ES module, the browser follows its `import` statements
and fetches the app's **shared chunk** automatically. The entry executes,
calls `register('app-b/b1', B1)`, the promise resolves, `force()` re-renders
the wrapper, and B1 replaces the loading paragraph — all inside the existing
React tree, no page reload.

Navigating on to **B2** repeats the dance but cheaper: `b2.client.js` imports
the *same* chunk URL, which is already in the browser's module cache — the
network shows only the tiny b2 entry being fetched. That's the multi-entry
payoff: modules of one app share code at build time *and* at load time. The
wrapper is essentially a hand-rolled `React.lazy`, with a registry instead of
a module promise.

## Sequence overview

```
SERVER (per request)                        BROWSER
────────────────────                        ───────
read manifest.json per app
  version changed? import every module
  entry (url?v=hash) — shared server
  chunks load once per version
provider.get('app-a/main') → component
renderToString(<StaticRouter><App/>)
  App = Header + MicroApp(route) + Footer
send HTML + bootstrap JSON + scripts  ───►  paint SSR HTML (no JS yet)
                                            SDK: registry, provider, boot() waits
                                            main.client.js: register('app-a/main') ─┐
                                            hydrateRoot(<App/>) ◄───────────────────┘
                                            … navigate to /b1 …
                                            MicroApp(app-b/b1): not registered
                                              → <script type=module b1.client.js>
                                              → browser pulls shared chunk too
                                              → register('app-b/b1') → re-render
                                            … navigate to /b2 …
                                              → fetch b2.client.js ONLY
                                                (shared chunk already cached)
```

## Why script-tag + global registration instead of `import()`?

The entries are real ES modules now (that's what makes shared chunks work),
but they still deliberately **don't contain React** — they need the host's
copy. A plain `import()` from the SDK would work for fetching, but the entry's
own `import 'react'` still has to resolve to the shared runtime somehow. The
options:

- an **import map** (`<script type="importmap">` pointing `react` at one
  shared URL, entries built with react as external ESM), or
- **Module Federation** — its `remoteEntry.js` + shared-scope negotiation is
  this exact pattern with version checking bolted on.

This POC's approach — alias shims baked in at build time
([apps/app-b/shims/](../apps/app-b/shims/)) plus registration through
`window.__MICROFE__` — is the zero-infrastructure version of the same idea:
the "module system" for *cross-app* linking is a global registry, while
*intra-app* linking (entries ↔ shared chunks) uses native ESM imports.

## Current limits and upgrade paths

- **Cross-app sharing still goes through the SDK.** Splitting dedupes code
  *within* one micro app; if app-a and app-b both used some heavy library, it
  would ship twice. Promoting it into the host SDK (like React) or moving to
  import maps solves that.
- **SSR chunk must be on local disk.** Node can't `import()` over HTTPS; for
  micro apps outside the monorepo, the host downloads the server artifacts to
  a local cache directory first (placed under the host so `import 'react'`
  resolves to the host's copy), then imports the entries.
- **No streaming.** `renderToString` buffers the whole page. Upgrading to
  `renderToPipeableStream` + `<Suspense>` around `MicroApp` would let the
  chrome flush before slow micro apps, and give per-route error boundaries.
