// Browser entry for module "main" — registers with the host SDK under the
// two-level id <app>/<module>.
import Widget from '../pages/Widget.jsx'

window.__MICROFE__.register('app-c/main', Widget)
