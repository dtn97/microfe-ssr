// Browser entry for module "app-a/main" — registers with the host SDK under
// the moduleId declared in microfe.config.js.
import Home from '../pages/Home'

window.__MICROFE__.register('app-a/main', Home)
