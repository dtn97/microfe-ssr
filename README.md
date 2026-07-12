# Micro Frontend Hybrid Rendering POC

A minimal proof of concept for **SSR + hydration + SPA routing across independently bundled micro frontends**.

## What it demonstrates

1. **Independent bundling, multi-entry** — `host`, `app-a`, and `app-b` each build on their own (esbuild). A micro app can expose **several entry modules** (app-b exposes `b1` and `b2`):
   - `dist/server/index.js` — the app's **single server bundle** (no splitting; SSR gains nothing from it), exporting each module as a named export (`src/server.js`)
   - `dist/client/<module>.client.js` — tiny browser ES module per exposed module, built together with code splitting: shared code lands once in `chunks/`, and a module's own `React.lazy` imports become **on-demand chunks** (B1's `SalesChart` is fetched only when the user clicks "Load sales chart")
2. **Route-based composition** — the host owns the route table (`/` → app-a's `main`, `/b1` and `/b2` → app-b's `b1`/`b2` modules) and the page chrome (header with nav, footer). On each request it renders one React tree — `<App>` = header + the matched micro app's component + footer — with `renderToString` inside a `StaticRouter`; micro apps only ever render page content. Content is visible before any JS runs.
   - The whole page is one React tree owned by the host, so the header's `<Link>` nav and the micro apps share one router; header/footer never remount across navigations.
3. **Hydration** — the browser loads the host's **runtime SDK** (`window.__MICROFE__`) once; it hydrates the page inside a shared `BrowserRouter` as soon as the matched app's client bundle registers, using the exact props the server rendered with.
4. **SPA navigation between micro apps (CSR)** — the home page's buttons (and the header nav) use React Router. On a location change, `getMicroAppComponent`'s client provider **lazy-loads that module's ES-module entry** and swaps it in — no full page reload (the page shows `Server-rendered at: never`). Navigating B1 → B2 fetches only `b2.client.js`; the shared chunk is already cached. A direct request to `/b1` is instead SSR'd by the host, so every route works both ways.
5. **Shared runtime via SDK** — micro app client bundles alias `react`, `react/jsx-runtime`, and `react-router-dom` to the SDK's shared copies (see `apps/*/shims/`), so React + Router ship once (in the ~475 KB SDK) and all apps share one router context.
6. **Nested micro apps** — a micro app can embed another micro app the same way the host embeds pages: B2 renders app-c's widget via `getMicroAppComponent('app-c/main')`, imported from the host-provided `@microfe/sdk` (aliased to shims per environment, like React). The embedding module declares its dependency in `package.json` (`microfe.modules.b2.uses`), which lands in the manifest so the host preloads app-c's client entry before hydrating `/b2` — the nested SSR content hydrates without mismatch. On client-side navigation the dependency simply lazy-loads in sequence.
7. **Dynamic updates, no host redeploy** — each micro app build publishes a `dist/manifest.json` whose `version` is a content hash of its artifacts. The host re-reads manifests per request and, when the version changes, hot-loads the new server bundle via `import(url + '?v=' + version)` (the ESM cache is keyed by URL). Client script URLs carry the same `?v=` for cache busting. Deploying a micro app is just `npm run build -w app-b` — the next request serves the new version.

## Layout

```
host/
  src/app/runtime.js   # getMicroAppComponent(id) + pluggable provider (isomorphic)
  src/app/routes.jsx   # PageA/PageB = getMicroAppComponent(...); route config
  src/app/App.jsx      # <App> = <Header/> + <Routes> (micro app pages) + <Footer/>
  src/registry.js      # server provider: manifests, versions, hot-loading bundles
  src/server.jsx       # Express bootstrap + renderToString(<StaticRouter><App/>)
  src/client.jsx       # runtime SDK: shared React/Router on window.__MICROFE__,
                       #   client provider (lazy bundle loading), hydrate <App/>
  build.mjs            # builds the SDK bundle and the host server bundle
apps/app-a/            # exposes module "main" (home page /)
  src/pages/Home.jsx
  src/server.js                  # single SSR bundle: named export per module
  src/entries/main.client.js
apps/app-b/            # multi-entry: exposes modules "b1" (/b1) and "b2" (/b2)
  src/pages/B1.jsx, B2.jsx
  src/shared/Panel.jsx           # shared by both → emitted once into chunks/
  src/components/SalesChart.jsx  # React.lazy inside B1 → own on-demand chunk
  src/server.js                  # single SSR bundle: named export per module
  src/entries/b1.client.js, b2.client.js
apps/app-c/            # nested micro app: exposes "main", embedded by B2
  src/pages/Widget.jsx
scripts/dev.mjs        # npm run dev: all watchers + auto-restarting server
```

The host reads like a normal React app — micro app modules are just components:

```jsx
const HomePage = getMicroAppComponent('app-a/main')
const PageB1 = getMicroAppComponent('app-b/b1')
const PageB2 = getMicroAppComponent('app-b/b2')

export const routes = [
  { link: '/', label: 'Home (A)', moduleId: 'app-a/main', component: HomePage },
  { link: '/b1', label: 'Page B1', moduleId: 'app-b/b1', component: PageB1 },
  { link: '/b2', label: 'Page B2', moduleId: 'app-b/b2', component: PageB2 },
]
```

`getMicroAppComponent` resolves through an environment-specific provider: on the
server it returns the component from the app's hot-loaded SSR bundle; in the
browser it reads the SDK registry and lazy-loads the app's bundle on first use.

## Run it

```sh
npm install
npm run build     # builds SDK + both micro apps (each via its own build.mjs)
npm start         # http://localhost:3000
```

Try a live micro app deploy while the host is running: edit `apps/app-b/src/pages/B1.jsx`, run `npm run build -w app-b`, refresh the page. The host logs `hot-loaded app-b@<new-version>` and serves the new SSR output — no restart.

## Development workflow

One command runs everything with hot reload:

```sh
npm run dev     # build once, then watch host + both apps, serve on :3000
```

Save any file and the browser reloads itself with the change:

- **Micro app edit** → its watch build republishes the manifest → the host's
  dev watcher broadcasts over the `/dev/reload` SSE stream → browser reloads →
  the request hot-loads the new server bundle (host process never restarts,
  same mechanism as a production deploy).
- **Host edit** (SDK, App shell, routes) → both host bundles rebuild →
  `node --watch-path=host/dist/server` restarts the server → the SSE
  connection drops → the browser reloads once it reconnects.

All dev plumbing (SSE endpoint, reload script in the page) is gated behind
`MICROFE_DEV=1`; production pages contain none of it. It's a full page reload,
not component-level HMR — for a shell + SSR architecture that's usually what
you want anyway, since a changed server bundle must re-render the page.

To watch a single micro app against a plain host, run `npm run build &&
npm start` plus `npm run dev -w app-a` and refresh manually.

In a multi-repo setup the same flow holds: the app team runs only their app in
watch mode, while the host's registry resolves every *other* app from the
shared artifact store — plus optionally a standalone harness (a stub page that
loads the SDK and just mounts your app) for shell-free iteration.

## Docs

- [docs/chunk-loading-and-ssr.md](docs/chunk-loading-and-ssr.md) — deep dive:
  how micro app chunks are loaded (Node ESM cache trick, script-tag loading,
  the `getMicroAppComponent` indirection) and how SSR renders one tree.

## Request flow

```
Browser ── GET / ──► Host
                      ├─ refresh manifests, hot-load changed server bundles
                      ├─ renderToString(<StaticRouter><App/>) — App composes
                      │    header + app-a/main's component (route /) + footer
                      └─ page: HTML + bootstrap JSON (props, versions, modules)
Browser ◄── full HTML (content visible immediately)
  ├─ loads /sdk/microfe-sdk.js → window.__MICROFE__ (shared React + Router)
  ├─ loads main.client.js (ES module) → register('app-a/main')
  ├─ SDK hydrates the same <App/> in a BrowserRouter → page is live React
  ├─ user clicks "Go to Page B1 →"
  │    └─ provider: <script type=module b1.client.js> → pulls shared chunk
  │       → register('app-b/b1') → render B1 at /b1 — pure CSR, no reload
  └─ user clicks "Go to B2 →"
       └─ provider loads b2.client.js only — shared chunk already cached
```

## What a production version adds

- Manifests and bundles fetched **over HTTP from a CDN/artifact store** (here they're read from the local filesystem) plus a small manifest TTL cache, so app teams deploy to storage without touching host machines.
- Worker/process recycling for hot-loaded server bundles — dynamically imported ESM modules can't be evicted, so old versions accumulate in memory until the process recycles.
- Streaming SSR (`renderToPipeableStream`), per-route error boundaries and timeouts so one slow/broken micro app can't take down the page.
- Data fetching on client-side navigation (the POC just renders default props); nested/param routes in the route manifest instead of exact-path matching.
- A richer SDK contract: shared design-system packages, cross-app eventing, versioned SDK API.
