import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        panel: resolve(import.meta.dirname, 'panel.html'),
        help: resolve(import.meta.dirname, 'help.html'),
        try: resolve(import.meta.dirname, 'try.html'),
        refindeval: resolve(import.meta.dirname, 'refindeval.html'),
      },
    },
  },
});
