import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

function copyStaticPagesAssets(): Plugin {
  return {
    name: 'copy-static-pages-assets',
    closeBundle() {
      const outDir = resolve(__dirname, 'dist');
      const filesToCopy = [
        'CNAME',
        '.nojekyll',
        'favicon.ico',
        'favicon.svg',
        'apple-touch-icon.png',
        'framework/wood.webp',
        'framework/lid-wood.webp',
        'framework/lid.js',
        'demos/dannys-walk/thumbnail.png',
        'demos/dannys-walk/thumbnail@2x.png',
        'demos/qiangs-trip/thumbnail.png',
        'demos/qiangs-trip/thumbnail@2x.png',
        'demos/two-sticks/thumbnail.png',
        'demos/two-sticks/thumbnail@2x.png',
      ];

      for (const relPath of filesToCopy) {
        const src = resolve(__dirname, relPath);
        const dest = resolve(outDir, relPath);
        if (existsSync(src)) {
          mkdirSync(dirname(dest), { recursive: true });
          copyFileSync(src, dest);
        }
      }
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), copyStaticPagesAssets()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        'dannys-walk': resolve(__dirname, 'demos/dannys-walk/index.html'),
        'qiangs-trip': resolve(__dirname, 'demos/qiangs-trip/index.html'),
        'two-sticks': resolve(__dirname, 'demos/two-sticks/index.html'),
        template: resolve(__dirname, 'demos/template/index.html'),
      },
    },
  },
});
