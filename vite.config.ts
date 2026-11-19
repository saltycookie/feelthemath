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
        'framework/theme.css',
        'demos/dannys-walk/thumbnail.png',
        'demos/dannys-walk/thumbnail@2x.png',
        'demos/qiangs-trip/thumbnail.png',
        'demos/qiangs-trip/thumbnail@2x.png',
        'demos/two-sticks/thumbnail.png',
        'demos/two-sticks/thumbnail@2x.png',
        'demos/seasons-why/thumbnail.png',
        'demos/seasons-why/thumbnail@2x.png',
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
      //    - Move the Vite-emitted theme <link rel="stylesheet"> BEFORE the inline <style> and
      //      bundled lid <script type="module">, and preserve blocking="render" on the module script.
      //    - Inline demo thumbnails as base64 data URIs (using crisp @2x PNG) without srcset
      //      so thumbnails render immediately during view transitions and through preview proxies.
      const indexHtmlPath = resolve(outDir, 'index.html');
      if (existsSync(indexHtmlPath)) {
        let html = readFileSync(indexHtmlPath, 'utf-8');

        // Extract Vite-injected local theme stylesheet link and bundled lid module script
        const themeLinkMatch = html.match(
          /\s*<link rel="stylesheet"[^>]*href="(\.\/assets\/[^"]+\.css)"[^>]*>/
        );
        const themeLinkTag = themeLinkMatch
          ? `<link rel="stylesheet" href="${themeLinkMatch[1]}">`
          : '';
        if (themeLinkMatch) {
          html = html.replace(themeLinkMatch[0], '');
        }

        const lidScriptMatch = html.match(
          /\s*<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/
        );
        const lidScriptTag = lidScriptMatch
          ? `<script type="module" src="${lidScriptMatch[1]}" blocking="render"></script>`
          : '';
        if (lidScriptMatch) {
          html = html.replace(lidScriptMatch[0], '');
        }

        // Place theme stylesheet and render-blocking lid script right before <link rel="expect" ...> (above inline <style>)
        if (themeLinkTag || lidScriptTag) {
          const injected = [themeLinkTag, lidScriptTag].filter(Boolean).join('\n');
          html = html.replace(
            '<link rel="expect"',
            `${injected}\n<link rel="expect"`
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
      //    - Place <link rel="stylesheet"> tags (theme CSS first, then demo CSS) BEFORE <script type="module">
      //    - Add blocking="render" to <script type="module"> so the React tree and box.ts are ready
      //      before the browser fires pagereveal and captures the cross-document view transition snapshot.
      const demoSlugs = ['dannys-walk', 'qiangs-trip', 'two-sticks', 'example', 'seasons-why'];
      for (const slug of demoSlugs) {
        const demoHtmlPath = resolve(outDir, `demos/${slug}/index.html`);
        if (!existsSync(demoHtmlPath)) continue;
        let html = readFileSync(demoHtmlPath, 'utf-8');

        const stylesheets: { href: string; tag: string }[] = [];
        html = html.replace(
          /\s*<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g,
          (_, href: string) => {
            stylesheets.push({ href, tag: `<link rel="stylesheet" href="${href}">` });
            return '';
          }
        );
        // Ensure Google Fonts and shared framework theme CSS always precede the demo-specific stylesheet
        const rank = (href: string) => {
          if (href.startsWith('https://')) return 0;
          if (href.includes(`/${slug}-`)) return 2;
          return 1;
        };
        stylesheets.sort((a, b) => rank(a.href) - rank(b.href));

        // Add blocking="render" to the entry module script and place stylesheets before it
        html = html.replace(
          /<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/,
          (_, src: string) =>
            `${stylesheets.map((s) => s.tag).join('\n  ')}\n  <script type="module" src="${src}" blocking="render"></script>`
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
        example: resolve(__dirname, 'demos/example/index.html'),
        'seasons-why': resolve(__dirname, 'demos/seasons-why/index.html'),
      },
    },
  },
});
