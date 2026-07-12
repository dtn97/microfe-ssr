import { defineConfig } from '@microfe/build'

export default defineConfig({
  name: '@microfe/app-b',
  server: 'src/server.ts',
  modules: [
    { moduleId: 'app-b/b1', entry: 'src/entries/b1.client.ts' },
    // B2 embeds app-c's widget, so it declares the dependency here; the host
    // preloads app-c's client entry before hydrating /b2 (see manifest.uses).
    { moduleId: 'app-b/b2', entry: 'src/entries/b2.client.ts', uses: ['app-c/main'] },
  ],
})
