// Browser entry — registers the app with the host SDK, which then hydrates
// every server-rendered island belonging to this app.
import App from './App.jsx'

window.__MICROFE__.register('app-a', App)
