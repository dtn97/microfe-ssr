// Server-bundle shim for '@microfe/sdk': the host sets this global before
// importing any micro app server bundle, so nested micro apps resolve
// through the same provider the host renders with.
module.exports = globalThis.__MICROFE_SSR__
