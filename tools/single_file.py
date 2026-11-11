#!/usr/bin/env python3
"""Pack a demo into one self-contained HTML file (handy for emailing or opening offline).

    python3 tools/single_file.py demos/qiangs-trip               -> dist/qiangs-trip.html
    python3 tools/single_file.py demos/qiangs-trip -o out.html
    python3 tools/single_file.py demos/qiangs-trip --fragment     (no <html>/<head>/<body> wrapper)
    python3 tools/single_file.py demos/qiangs-trip --home URL     (where the home link goes; default: the live site)

It inlines local stylesheets (and the pictures they use, such as the wooden desk), and bundles the page's TypeScript,
React included, into one script with esbuild. esbuild comes with Vite, so run `npm install` first.
Web fonts still load from Google Fonts, and the site icon from the live site.
GitHub Pages does not need this: it serves the build that Vite makes.
"""
import argparse, base64, mimetypes, os, re, subprocess, sys

SITE = 'https://feelthemath.app/'   # the home link of a packed file goes here
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # the repository, which the site serves

PRELOAD_RE = re.compile(r'<link\s+[^>]*rel="preload"[^>]*href="(?!https?:)[^"]+"[^>]*>\s*')   # inlined below
LINK_RE = re.compile(r'<link\s+[^>]*rel="stylesheet"[^>]*href="(?!https?:)([^"]+)"[^>]*>\s*')
SCRIPT_RE = re.compile(r'<script\s+type="module"\s+src="([^"]+)"[^>]*>\s*</script>[ \t]*(?:<!--.*?-->)?\s*')   # with its comment
CSS_URL_RE = re.compile(r'url\(\s*([\'"]?)(?!data:|https?:|#|%23)([^\'")]+)\1\s*\)')
ICON_RE = re.compile(r'(<link\s+[^>]*rel="(?:icon|apple-touch-icon)"[^>]*href=")(?!https?:)([^"]+)(")')


# Run by node from the repository, so that require('esbuild') finds the copy Vite installed.
ESBUILD = """
require('esbuild').build({
  entryPoints: [process.argv[1]], bundle: true, write: false, format: 'iife', minify: true,
  jsx: 'automatic', charset: 'utf8', logLevel: 'error',
  define: { 'process.env.NODE_ENV': '"production"' },   // React's production build
}).then((r) => process.stdout.write(r.outputFiles[0].text), () => process.exit(1));
"""


def bundle(entry):
    """The page's entry module and everything it imports, React included, as one classic script."""
    try:
        done = subprocess.run(['node', '-e', ESBUILD, os.path.abspath(entry)], cwd=ROOT,
                              capture_output=True, text=True, encoding='utf-8')
    except FileNotFoundError:
        sys.exit('single_file.py: node is needed to bundle the JavaScript')
    if done.returncode:
        if "Cannot find module 'esbuild'" in done.stderr:
            sys.exit('single_file.py: esbuild is missing; run `npm install` (it comes with Vite)')
        sys.exit('single_file.py: bundling %s failed:\n%s' % (entry, done.stderr.strip()))
    # A "</script" inside the code (in a string) would end the <script> element early.
    return done.stdout.replace('</script', '<\\/script')


def pack(demo_dir, fragment=False, home=SITE):
    page = os.path.join(demo_dir, 'index.html')
    html = open(page, encoding='utf-8').read()
    # a packed file has no front page beside it: point the home link at the live site
    html = html.replace('</title>', '</title>\n<meta name="stepdeck-home" content="%s">' % home, 1)
    # nor the site's icons: take them from the live site too
    def icon(m):
        path = os.path.relpath(os.path.abspath(os.path.join(demo_dir, m.group(2))), ROOT)
        return m.group(1) + SITE + path.replace(os.sep, '/') + m.group(3)
    html = ICON_RE.sub(icon, html)
    scripts = []

    def css(m):
        path = os.path.join(demo_dir, m.group(1))
        text = open(path, encoding='utf-8').read()
        def embed(u):          # a picture next to the stylesheet becomes a data: URL, so the file needs nothing else
            pic = os.path.join(os.path.dirname(path), u.group(2))
            kind = mimetypes.guess_type(pic)[0] or ('image/webp' if pic.endswith('.webp') else 'application/octet-stream')
            data = base64.b64encode(open(pic, 'rb').read()).decode('ascii')
            return 'url("data:%s;base64,%s")' % (kind, data)
        text = CSS_URL_RE.sub(embed, text)
        return '<style>\n%s\n</style>\n' % text.strip()

    def js(m):
        scripts.append(bundle(os.path.join(demo_dir, m.group(1))))
        return ''

    html = PRELOAD_RE.sub('', html)
    html = LINK_RE.sub(css, html)
    html = SCRIPT_RE.sub(js, html)
    tail = '<script>\n%s\n</script>\n' % '\n'.join(scripts) if scripts else ''
    html = html.replace('</body>', tail + '</body>')
    if fragment:
        head = re.search(r'<head>(.*?)</head>', html, re.S).group(1)
        body = re.search(r'<body>(.*?)</body>', html, re.S).group(1)
        head = re.sub(r'<meta charset[^>]*>\s*|<meta name="viewport"[^>]*>\s*', '', head)
        html = head.strip() + '\n' + body.strip() + '\n'
    return html


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('demo', help='demo folder, e.g. demos/qiangs-trip')
    ap.add_argument('-o', '--out', help='output file (default: dist/<demo>.html)')
    ap.add_argument('--fragment', action='store_true', help='leave out the <html>, <head> and <body> wrapper')
    ap.add_argument('--home', default=SITE, help='where the home link goes (default: %(default)s)')
    a = ap.parse_args()
    out = a.out or os.path.join('dist', os.path.basename(os.path.normpath(a.demo)) + '.html')
    os.makedirs(os.path.dirname(out) or '.', exist_ok=True)
    html = pack(a.demo, a.fragment, a.home)   # before opening `out`, so that a failure leaves no empty file
    open(out, 'w', encoding='utf-8').write(html)
    print('wrote', out)


if __name__ == '__main__':
    sys.exit(main())
