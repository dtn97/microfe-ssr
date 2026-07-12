// Client-bundle shim: `import ... from 'react'` resolves to the host SDK's
// shared React instead of bundling a second copy.
module.exports = window.__MICROFE__.React
