import { defineConfig } from '@microfe/build'

export default defineConfig({
  type: 'app',
  name: '@microfe/app-a',
  server: 'src/server.ts',
  modules: [{ moduleId: 'app-a/main', entry: 'src/entries/main.client.ts' }],
})
