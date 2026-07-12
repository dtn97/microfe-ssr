# @microfe/typescript

Shared TypeScript toolkit for monorepo packages. It bundles `typescript` and
exposes shared `tsconfig` presets plus the `microfe-tsc` command, so consumer
packages don't each have to declare and version the compiler.

## Usage

Add it as a dev dependency, extend a preset, and type-check through the
bundled CLI (no direct `typescript` dependency needed):

```jsonc
// package.json
{
  "devDependencies": {
    "@microfe/typescript": "workspace:*"
  },
  "scripts": {
    "typecheck": "microfe-tsc --noEmit"
  }
}
```

```jsonc
// tsconfig.json
{
  "extends": "@microfe/typescript/tsconfig/react-app.json",
  "include": ["src"]
}
```

Then run `rush update`.

## Presets

- `base.json` — shared compiler defaults: `ES2022` target/lib, `ESNext`
  modules with `Bundler` resolution, `strict`, `esModuleInterop`,
  `skipLibCheck`, `forceConsistentCasingInFileNames`.
- `react-app.json` — for the React apps in this repo: adds the DOM libs and
  the `react-jsx` transform, and sets `noEmit` because esbuild owns the build;
  `tsc` only type-checks.

## `microfe-tsc`

Runs `tsc` resolved from this package and forwards every argument straight
through:

```bash
microfe-tsc --noEmit    # type-check only
microfe-tsc --watch
```

Whole-repo type-checking is available via `rush typecheck`.
