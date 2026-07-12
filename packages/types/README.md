# @microfe/types

The shared type contract for the microfe framework. It centralises the ambient
and structural types that the host and every micro app used to redeclare in
their own `microfe-env.d.ts`.

## Micro apps

A micro app only needs the ambient `@microfe/sdk` module and the
`window.__MICROFE__` registry global. Pull them in with a single side-effect
import — usually the app's `src/microfe-env.d.ts`:

```ts
import '@microfe/types/client'
```

## Host

The host imports the structural types by name and layers its own concrete
`PageProps` on top (see `host/src/microfe-env.d.ts`):

```ts
import type { MicrofeBootstrap, MicrofeSdk, MicrofeSsr } from '@microfe/types'
```

## What lives here

- `MicroAppProps` / `MicroAppComponent` — a micro app as a plain React component.
- `MicrofeSdk` — the client SDK exposed on `window.__MICROFE__`.
- `MicrofeSsr` — the server face of `@microfe/sdk` on `globalThis.__MICROFE_SSR__`.
- `MicrofeBootstrap<TPageProps>` — the hydration payload the server embeds.

This is a types-only package: it ships `.d.ts` files and emits no JavaScript.
