// Browser entry for module "main" — registers with the host SDK under the
// two-level id <app>/<module>.
import Home from '../pages/Home.jsx'

window.__MICROFE__.register('app-a/main', Home)
