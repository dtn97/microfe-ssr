// The app's single SSR bundle: every exposed module is a named export.
// Server side is built WITHOUT splitting — one micro app = one server chunk.
export { default as main } from './pages/Home.jsx'
