# Micro Frontend Hybrid Rendering POC

A minimal proof of concept for **SSR + hydration + SPA routing across independently bundled micro frontends**.

## What it demonstrates

1. **Independent bundling** — `host`, `app-a`, and `app-b` each build on their own (esbuild). Each micro app produces two artifacts:
   - `dist/server/entry-server.js` — Node ESM bundle exporting the page component (the host renders the tree)
   - `dist/client/entry-client.js` — tiny browser bundle (~3 KB) that registers the app with the host SDK
2. **Route-based composition** — the host owns the route table (`/` → app-a the home page, `/b` → app-b) and the page chrome (header with nav, footer). On each request it renders one React tree — `<App>` = header + the matched micro app's component + footer — with `renderToString` inside a `StaticRouter`; micro apps only ever render page content. Content is visible before any JS runs.
   - The whole page is one React tree owned by the host, so the header's `<Link>` nav and the micro apps share one router; header/footer never remount across navigations.
3. **Hydration** — the browser loads the host's **runtime SDK** (`window.__MICROFE__`) once; it hydrates the page inside a shared `BrowserRouter` as soon as the matched app's client bundle registers, using the exact props the server rendered with.
4. **SPA navigation between micro apps (CSR)** — the home page's "Go to Page B →" button (and the header nav) use React Router. On a location change, `getMicroAppComponent`'s client provider **lazy-loads app-b's bundle** and swaps it in — no full page reload (page B shows `Server-rendered at: never`). A direct request to `/b` is instead SSR'd by the host, so every route works both ways.
5. **Shared runtime via SDK** — micro app client bundles alias `react`, `react/jsx-runtime`, and `react-router-dom` to the SDK's shared copies (see `apps/*/shims/`), so React + Router ship once (in the ~475 KB SDK) and all apps share one router context.
6. **Dynamic updates, no host redeploy** — each micro app build publishes a `dist/manifest.json` whose `version` is a content hash of its artifacts. The host re-reads manifests per request and, when the version changes, hot-loads the new server bundle via `import(url + '?v=' + version)` (the ESM cache is keyed by URL). Client script URLs carry the same `?v=` for cache busting. Deploying a micro app is just `npm run build -w app-b` — the next request serves the new version.

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
apps/app-a/            # home page (/): entry-server exports the component,
                       #   entry-client registers it with the SDK
apps/app-b/            # page /b — same shape, independent build
scripts/dev.mjs        # npm run dev: all watchers + auto-restarting server
```

The host reads like a normal React app — micro apps are just components:

```jsx
const PageAComponent = getMicroAppComponent('app-a')
const PageBComponent = getMicroAppComponent('app-b')

export const routes = [
  { link: '/', label: 'Home (A)', app: 'app-a', component: PageAComponent },
  { link: '/b', label: 'Page B', app: 'app-b', component: PageBComponent },
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

Try a live micro app deploy while the host is running: edit `apps/app-b/src/App.jsx`, run `npm run build -w app-b`, refresh the page. The host logs `hot-loaded app-b@<new-version>` and serves the new SSR output — no restart.

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

## Request flow

```
Browser ── GET / ──► Host
                      ├─ refresh manifests, hot-load changed server bundles
                      ├─ renderToString(<StaticRouter><App/>) — App composes
                      │    header + app-a's component (route /) + footer
                      └─ page: HTML + bootstrap JSON (props, versions, apps)
Browser ◄── full HTML (content visible immediately)
  ├─ loads /sdk/microfe-sdk.js → window.__MICROFE__ (shared React + Router)
  ├─ loads app-a's entry-client → register('app-a')
  ├─ SDK hydrates the same <App/> in a BrowserRouter → page is live React
  └─ user clicks "Go to Page B →" (or header nav)
       └─ client provider: lazy-load app-b's entry-client → register('app-b')
          → render B at /b — pure CSR, no page reload
```

## What a production version adds

- Manifests and bundles fetched **over HTTP from a CDN/artifact store** (here they're read from the local filesystem) plus a small manifest TTL cache, so app teams deploy to storage without touching host machines.
- Worker/process recycling for hot-loaded server bundles — dynamically imported ESM modules can't be evicted, so old versions accumulate in memory until the process recycles.
- Streaming SSR (`renderToPipeableStream`), per-route error boundaries and timeouts so one slow/broken micro app can't take down the page.
- Data fetching on client-side navigation (the POC just renders default props); nested/param routes in the route manifest instead of exact-path matching.
- A richer SDK contract: shared design-system packages, cross-app eventing, versioned SDK API.
