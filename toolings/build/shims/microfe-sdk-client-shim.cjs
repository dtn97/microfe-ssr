// Client-bundle shim: `import { getMicroAppComponent } from '@microfe/sdk'`
// resolves to the host SDK, so micro apps can embed other micro apps.
module.exports = window.__MICROFE__
