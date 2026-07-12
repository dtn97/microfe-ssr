// Browser entry for module "b1" — registers with the host SDK under the
// two-level id <app>/<module>. Loaded as an ES module; shared code arrives
// via the common chunk this entry imports.
import B1 from '../pages/B1'

window.__MICROFE__.register('app-b/b1', B1)
