// The app's single SSR bundle: every exposed module is a named export.
// Server side is built WITHOUT splitting — one micro app = one server chunk.
export { default as b1 } from './pages/B1.jsx'
export { default as b2 } from './pages/B2.jsx'
