import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { cspPlugin } from './vite/csp';

export default defineConfig({
  main: {
    build: {
      rollupOptions: { input: 'app/main/index.ts' }
    },
    resolve: {
      alias: { '@': path.resolve(__dirname, '.') }
    }
  },
  preload: {
    build: {
      rollupOptions: {
        input: 'app/preload/index.ts',
        // Sandboxed preloads must be CommonJS, even in an ESM package.
        output: { format: 'cjs', entryFileNames: '[name].cjs' }
      }
    }
  },
  renderer: {
    root: '.',
    plugins: [react(), tailwindcss(), cspPlugin()],
    resolve: {
      alias: { '@': path.resolve(__dirname, '.') }
    },
    build: {
      rollupOptions: { input: 'index.html' }
    }
  }
});
