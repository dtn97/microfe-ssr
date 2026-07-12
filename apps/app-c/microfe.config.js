import { defineConfig } from '@microfe/build'

export default defineConfig({
  type: 'app',
  name: '@microfe/app-c',
  server: 'src/server.ts',
  modules: [{ moduleId: 'app-c/main', entry: 'src/entries/main.client.ts' }],
})
