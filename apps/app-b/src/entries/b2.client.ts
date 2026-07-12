// Browser entry for module "app-b/b2" — registers with the host SDK under
// the moduleId declared in microfe.config.js. Loaded as an ES module; shared
// code arrives via the common chunk this entry imports.
import B2 from '../pages/B2'

window.__MICROFE__.register('app-b/b2', B2)
