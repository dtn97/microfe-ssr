// Browser entry for module "b2" — registers with the host SDK under the
// two-level id <app>/<module>. Loaded as an ES module; shared code arrives
// via the common chunk this entry imports.
import B2 from '../pages/B2'

window.__MICROFE__.register('app-b/b2', B2)
