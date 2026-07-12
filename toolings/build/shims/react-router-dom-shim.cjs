// Client-bundle shim: `import ... from 'react-router-dom'` resolves to the
// host SDK's shared router, so all micro apps share one router context.
module.exports = window.__MICROFE__.ReactRouterDOM
