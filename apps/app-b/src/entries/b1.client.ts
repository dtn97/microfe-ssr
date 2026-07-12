// Browser entry for module "app-b/b1" — registers with the host SDK under
// the moduleId declared in microfe.config.js. Loaded as an ES module; shared
// code arrives via the common chunk this entry imports.
import B1 from '../pages/B1'

window.__MICROFE__.register('app-b/b1', B1)
