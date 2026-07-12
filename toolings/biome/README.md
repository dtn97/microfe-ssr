# @microfe/biome

Shared Biome toolkit for the monorepo. Bundles [Biome](https://biomejs.dev)
and exposes a `toolings-lint` CLI so consumer packages can lint and format
without listing `@biomejs/biome` directly.

## Usage

Depend on this package via `workspace:*` and call `toolings-lint` from your
package's `scripts` (it is placed on the `PATH` by Rush/`rushx`):

```jsonc
{
  "scripts": {
    "lint": "toolings-lint check src"
  },
  "devDependencies": {
    "@microfe/biome": "workspace:*"
  }
}
```

`toolings-lint` forwards all arguments straight to Biome:

```bash
toolings-lint check src              # lint + format check
toolings-lint check --fix src        # apply safe fixes (maps to Biome's --write)
toolings-lint check --fix --unsafe src
toolings-lint format --fix .         # format only
```

`--fix` is a convenience alias for Biome's `--write` (Biome has no `--fix`);
pair it with `--unsafe` to also apply unsafe fixes. Any other flags pass
through unchanged.

Biome resolves its configuration from the repo-wide
[`biome.json`](../../biome.json) at the monorepo root.

Whole-repo linting is available via the Rush global commands `rush lint`,
`rush lint:fix`, and `rush format`, which run Biome through the
`common/autoinstallers/rush-biome` autoinstaller.
