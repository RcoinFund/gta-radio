import { defineConfig } from 'vite';

export default defineConfig({
  base: '/gta-radio/',
  publicDir: 'public',
  server: {
    open: false,
    port: 3000,
  },
  build: {
    outDir: 'dist',
  },
});
