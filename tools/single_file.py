#!/usr/bin/env python3
"""Pack a demo into one self-contained HTML file (handy for emailing or opening offline).

    python3 tools/single_file.py demos/qiangs-trip               -> dist/qiangs-trip.html
    python3 tools/single_file.py demos/qiangs-trip -o out.html
    python3 tools/single_file.py demos/qiangs-trip --fragment     (no <html>/<head>/<body> wrapper)

It inlines local stylesheets and bundles the page's JavaScript modules into one script.
Web fonts still load from Google Fonts. Only the plain import/export forms used in this
repository are understood:  import { a, b as c } from './x.js';  export function / const / let / class.
GitHub Pages does not need this: it serves the separate files as they are.
"""
import argparse, os, re, sys

LINK_RE = re.compile(r'<link\s+[^>]*rel="stylesheet"[^>]*href="(?!https?:)([^"]+)"[^>]*>\s*')
SCRIPT_RE = re.compile(r'<script\s+type="module"\s+src="([^"]+)"\s*>\s*</script>\s*')
IMPORT_RE = re.compile(r'^\s*import\s*\{([^}]*)\}\s*from\s*[\'"]([^\'"]+)[\'"]\s*;?\s*$', re.M)
EXPORT_RE = re.compile(r'^export\s+(?:async\s+)?(function\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)', re.M)


def bundle(entry):
    order, seen = [], set()

    def visit(path):
        path = os.path.normpath(path)
        if path in seen:
            return
        seen.add(path)
        src = open(path, encoding='utf-8').read()
        for _, spec in IMPORT_RE.findall(src):
            visit(os.path.join(os.path.dirname(path), spec))
        order.append((path, src))

    visit(entry)
    names = {p: '__m%d' % i for i, (p, _) in enumerate(order)}
    out = []
    for path, src in order:
        def imp(m):
            dep = os.path.normpath(os.path.join(os.path.dirname(path), m.group(2)))
            parts = [s.strip() for s in m.group(1).split(',') if s.strip()]
            fields = [re.sub(r'^(\w+)\s+as\s+(\w+)$', r'\1: \2', s) for s in parts]
            return 'const { %s } = %s;' % (', '.join(fields), names[dep])
        body = IMPORT_RE.sub(imp, src)
        exported = [m.group(2) for m in EXPORT_RE.finditer(body)]
        body = re.sub(r'^export\s+', '', body, flags=re.M)
        rel = os.path.relpath(path)
        out.append('/* ---- %s ---- */\nconst %s = (() => {\n"use strict";\n%s\nreturn { %s };\n})();'
                   % (rel, names[path], body, ', '.join(exported)))
    return '\n'.join(out)


def pack(demo_dir, fragment=False):
    page = os.path.join(demo_dir, 'index.html')
    html = open(page, encoding='utf-8').read()
    scripts = []

    def css(m):
        text = open(os.path.join(demo_dir, m.group(1)), encoding='utf-8').read()
        return '<style>\n%s\n</style>\n' % text.strip()

    def js(m):
        scripts.append(bundle(os.path.join(demo_dir, m.group(1))))
        return ''

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
    a = ap.parse_args()
    out = a.out or os.path.join('dist', os.path.basename(os.path.normpath(a.demo)) + '.html')
    os.makedirs(os.path.dirname(out) or '.', exist_ok=True)
    open(out, 'w', encoding='utf-8').write(pack(a.demo, a.fragment))
    print('wrote', out)


if __name__ == '__main__':
    sys.exit(main())
