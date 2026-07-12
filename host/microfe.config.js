import { defineConfig } from '@microfe/build'

export default defineConfig({
  type: 'host',
  name: '@microfe/host',
  client: 'src/client.tsx',
  server: 'src/server.tsx',
})
