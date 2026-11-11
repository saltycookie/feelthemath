import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';

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
        'framework/theme.css',
        'demos/dannys-walk/thumbnail.png',
        'demos/dannys-walk/thumbnail@2x.png',
        'demos/qiangs-trip/thumbnail.png',
        'demos/qiangs-trip/thumbnail@2x.png',
        'demos/two-sticks/thumbnail.png',
        'demos/two-sticks/thumbnail@2x.png',
        'demos/summer-and-winter/thumbnail.png',
        'demos/summer-and-winter/thumbnail@2x.png',
      ];

      for (const relPath of filesToCopy) {
        const src = resolve(__dirname, relPath);
        const dest = resolve(outDir, relPath);
        if (existsSync(src)) {
          mkdirSync(dirname(dest), { recursive: true });
          copyFileSync(src, dest);
        }
      }

      // 1. Post-process dist/index.html:
      //    - Move <link rel="stylesheet" ...> before <script src="framework/lid.js"></script>
      //    - Inline demo thumbnails as base64 data URIs (using crisp @2x PNG) without srcset
      //      so thumbnails render immediately during view transitions and through preview proxies.
      const indexHtmlPath = resolve(outDir, 'index.html');
      if (existsSync(indexHtmlPath)) {
        let html = readFileSync(indexHtmlPath, 'utf-8');

        // Extract Vite-injected theme stylesheet link and place it before framework/lid.js
        const themeLinkMatch = html.match(
          /\s*<link rel="stylesheet"[^>]*href="([^"]*theme[^"]*\.css)"[^>]*>/
        );
        if (themeLinkMatch) {
          const themeHref = themeLinkMatch[1];
          html = html.replace(themeLinkMatch[0], '');
          html = html.replace(
            '<script src="framework/lid.js"></script>',
            `<link rel="stylesheet" href="${themeHref}">\n<script src="framework/lid.js"></script>`
          );
        }

        // Inline each demo card's thumbnail image from its @2x PNG
        html = html.replace(
          /(<a\s+class="demo"\s+href="demos\/([^/"]+)\/"[^>]*>\s*)<img\s+class="thumb"[^>]*>/g,
          (fullMatch, anchorPrefix: string, slug: string) => {
            const thumb2xPath = resolve(
              __dirname,
              `demos/${slug}/thumbnail@2x.png`
            );
            const thumb1xPath = resolve(
              __dirname,
              `demos/${slug}/thumbnail.png`
            );
            const chosenPath = existsSync(thumb2xPath)
              ? thumb2xPath
              : thumb1xPath;
            if (!existsSync(chosenPath)) return fullMatch;
            const b64 = readFileSync(chosenPath).toString('base64');
            return `${anchorPrefix}<img class="thumb" src="data:image/png;base64,${b64}" width="120" height="120" alt="">`;
          }
        );

        writeFileSync(indexHtmlPath, html, 'utf-8');
      }

      // 2. Post-process dist/demos/*/index.html:
      //    - Place <link rel="stylesheet"> tags (theme.css first, then demo css) BEFORE <script type="module">
      //    - Add blocking="render" to <script type="module"> so the React tree and box.ts are ready
      //      before the browser fires pagereveal and captures the cross-document view transition snapshot.
      const demoSlugs = ['dannys-walk', 'qiangs-trip', 'two-sticks', 'summer-and-winter', 'example'];
      for (const slug of demoSlugs) {
        const demoHtmlPath = resolve(outDir, `demos/${slug}/index.html`);
        if (!existsSync(demoHtmlPath)) continue;
        let html = readFileSync(demoHtmlPath, 'utf-8');

        const stylesheets: string[] = [];
        html = html.replace(
          /\s*<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g,
          (_, href: string) => {
            stylesheets.push(`<link rel="stylesheet" href="${href}">`);
            return '';
          }
        );
        // Ensure theme.css is loaded before demo-specific stylesheet
        stylesheets.sort((a, b) =>
          a.includes('theme') ? -1 : b.includes('theme') ? 1 : 0
        );

        // Add blocking="render" to the entry module script and place stylesheets before it
        html = html.replace(
          /<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/,
          (_, src: string) =>
            `${stylesheets.join('\n  ')}\n  <script type="module" src="${src}" blocking="render"></script>`
        );

        writeFileSync(demoHtmlPath, html, 'utf-8');
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
        'summer-and-winter': resolve(__dirname, 'demos/summer-and-winter/index.html'),
        example: resolve(__dirname, 'demos/example/index.html'),
      },
    },
  },
});
