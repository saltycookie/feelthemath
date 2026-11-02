#!/usr/bin/env python3
"""Make a demo's thumbnail for the front page: its workspace at the end of one step, cut to a square.

    python3 tools/thumbnail.py demos/qiangs-trip --step 7
        writes demos/qiangs-trip/thumbnail.png (120 x 120) and thumbnail@2x.png (240 x 240, for sharp screens)
    python3 tools/thumbnail.py demos/*
        every demo whose index.html says how to make its thumbnail:  <meta name="thumbnail" content="step=7">
    python3 tools/thumbnail.py demos/dannys-walk --raw dist/raw
        also keeps the whole, uncut screenshot, to see what the square was cut from

Settings kept in the demo
    A demo's index.html can hold its thumbnail settings, so that rerunning the tool gives the same picture:
        <meta name="thumbnail" content="step=7">
        <meta name="thumbnail" content="step=3 zoom=1.2 focus=.5,.4">
    step, viewport, fit, focus and zoom mean the same as the options below; options given on the command line win.

How it works
    1. Serves this repository on a free local port (no need to start a server yourself).
    2. Opens the demo in headless Chromium at #step-N, which plays step N from its beginning. The window is
       860 pixels wide and exactly as tall as it takes to make the workspace square (see --viewport).
    3. Waits until the step has finished animating. StepDeck marks the page <html data-step="N" data-step-busy>
       while step N plays and drops data-step-busy when it is done (framework/deck.js), then waits a moment longer.
    4. Screenshots only the workspace, the .stage element: no title band, home link or Back/Next.
    5. Cuts a square out of it (all of it when the workspace is square; see --focus and --zoom) and scales it down.

Requirements
    pip install playwright pillow
    playwright install chromium
The demos load their handwritten font, Kalam, from Google Fonts, so run it online (or with Kalam installed);
the tool warns if the font is missing, because the text would then be drawn in a fallback font.
"""
import argparse, functools, http.server, io, re, sys, threading
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent      # the repository: the folder that holds index.html
NAME = 'thumbnail'                                  # demos/<name>/thumbnail.png and thumbnail@2x.png
META_RE = re.compile(r'<meta\s+name="thumbnail"\s+content="([^"]*)"', re.I)
DEFAULTS = {'viewport': '860', 'fit': 'cover', 'focus': '.5,.5', 'zoom': '1'}

# the deck has started (it marks <html data-step>), and step n has finished (no data-step-busy)
STARTED_JS = '() => document.documentElement.dataset.step'
SETTLED_JS = 'n => document.documentElement.dataset.step === String(n) && !document.documentElement.hasAttribute("data-step-busy")'
# is Kalam really drawing the text? (the same words measured in Kalam and in a fallback font)
KALAM_JS = '''() => { const c = document.createElement('canvas').getContext('2d'), t = 'Feel the Math 0123';
  c.font = '20px monospace'; const a = c.measureText(t).width;
  c.font = '20px Kalam, monospace'; return c.measureText(t).width !== a; }'''


# ---- reading the settings ----------------------------------------------------------------------------------------

def parse_step(v):
    n = int(v)
    if n < 1:
        raise ValueError('steps count from 1')
    return n


def parse_viewport(v):
    """'860' -> (860, None): as tall as makes the workspace square;  '1000x800' -> (1000, 800)"""
    w, _, h = v.lower().partition('x')
    return int(w), (int(h) if h else None)


def parse_fit(v):
    if v not in ('cover', 'contain'):
        raise ValueError('cover or contain')
    return v


def parse_focus(v):
    x, y = (float(t) for t in v.split(','))
    if not (0 <= x <= 1 and 0 <= y <= 1):
        raise ValueError('both between 0 and 1')
    return x, y


def parse_zoom(v):
    z = float(v)
    if z < 1:
        raise ValueError('1 or more')
    return z


PARSE = {'step': parse_step, 'viewport': parse_viewport, 'fit': parse_fit, 'focus': parse_focus, 'zoom': parse_zoom}


def settings_for(demo, cli):
    """The defaults, then the demo's <meta name="thumbnail" content="step=7 zoom=1.2">, then the command line."""
    raw = dict(DEFAULTS)
    m = META_RE.search((demo / 'index.html').read_text(encoding='utf-8'))
    for item in (m.group(1).split() if m else []):
        key, _, value = item.partition('=')
        if key not in PARSE or not value:
            raise SystemExit('%s/index.html: cannot read "%s" in <meta name="thumbnail"> (it knows %s)'
                             % (demo, item, ', '.join(PARSE)))
        raw[key] = value
    raw.update({k: v for k, v in cli.items() if v is not None})
    out = {}
    for key, value in raw.items():
        try:
            out[key] = PARSE[key](value)
        except ValueError as e:
            raise SystemExit('%s: bad %s "%s" (%s)' % (demo, key, value, e))
    return out


# ---- the local server ----------------------------------------------------------------------------------------------

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def serve(root):
    """Serve `root` on a free port in the background; returns the server (its address is server.server_address)."""
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(QuietHandler, directory=str(root)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


# ---- taking the screenshot -------------------------------------------------------------------------------------------

def square_height(browser, url, width, args):
    """The window height that makes the workspace square at this width. Everything around the workspace (the title
    band, the navigation, the page's padding) has a fixed height, so one measurement is enough."""
    page = browser.new_page(viewport={'width': width, 'height': 900})
    try:
        page.goto(url, wait_until='load', timeout=args.timeout * 1000)
        page.wait_for_function(STARTED_JS, timeout=args.timeout * 1000)
        box = page.locator(args.selector).first.bounding_box()
        if not box:
            raise SystemExit('%s: no %s element to screenshot' % (url, args.selector))
        return round(900 - box['height'] + box['width'])
    finally:
        page.close()


def capture(browser, url, step, viewport, args):
    """Open url at #step-N, wait for the step to finish, and return a PNG of the workspace and the paper's colour."""
    width, height = viewport
    if height is None:
        height = square_height(browser, url, width, args)
    print('  window %d x %d' % (width, height))
    page = browser.new_page(viewport={'width': width, 'height': height}, device_scale_factor=args.scale)
    try:
        page.goto('%s#step-%d' % (url, step), wait_until='load', timeout=args.timeout * 1000)
        page.wait_for_function(STARTED_JS, timeout=args.timeout * 1000)
        count = page.evaluate('document.querySelectorAll(".nav .dot").length')
        if count and step > count:
            raise SystemExit('%s has %d steps: there is no step %d' % (url, count, step))
        page.wait_for_function(SETTLED_JS, arg=step, timeout=args.timeout * 1000)
        page.evaluate('document.fonts.ready.then(() => true)')
        if not page.evaluate(KALAM_JS):
            print('  warning: the Kalam font did not load, so the text is in a fallback font', file=sys.stderr)
        page.wait_for_timeout(args.wait)                   # fades that run on CSS transitions
        paper = page.evaluate('getComputedStyle(document.querySelector(".paper") || document.body).backgroundColor')
        return page.locator(args.selector).first.screenshot(), paper
    finally:
        page.close()


# ---- cutting and scaling ---------------------------------------------------------------------------------------------

def rgb(css):
    """'rgb(61, 104, 86)' -> (61, 104, 86)"""
    nums = re.findall(r'[\d.]+', css)
    return tuple(int(float(v)) for v in nums[:3]) if len(nums) >= 3 else (0, 0, 0)


def square(img, fit, focus, zoom, background):
    """Cut a square out of img (fit='cover'), or pad img out to a square with the paper's colour (fit='contain')."""
    from PIL import Image
    w, h = img.size
    if fit == 'contain':
        s = max(w, h)
        out = Image.new('RGB', (s, s), background)
        out.paste(img, ((s - w) // 2, (s - h) // 2))
        return out
    s = round(min(w, h) / zoom)
    left, top = round((w - s) * focus[0]), round((h - s) * focus[1])
    return img.crop((left, top, left + s, top + s))


def make(browser, base, demo, opts, args):
    from PIL import Image
    rel = demo.resolve().relative_to(ROOT).as_posix()
    step = opts['step']
    print('%s, step %d' % (rel, step))
    png, paper = capture(browser, '%s/%s/' % (base, rel), step, opts['viewport'], args)
    img = Image.open(io.BytesIO(png)).convert('RGB')
    if args.raw:
        raw = Path(args.raw) / ('%s-step%d.png' % (demo.name, step))
        raw.parent.mkdir(parents=True, exist_ok=True)
        img.save(raw)
        print('  wrote', raw, '(%d x %d)' % img.size)
    sq = square(img, opts['fit'], opts['focus'], opts['zoom'], rgb(paper))
    out = Path(args.out) if args.out else demo / (NAME + '.png')
    out.parent.mkdir(parents=True, exist_ok=True)
    sizes = [(out, args.size)]
    if not args.no_2x:
        sizes.append((out.with_name(out.stem + '@2x' + out.suffix), args.size * 2))
    for path, size in sizes:
        sq.resize((size, size), Image.LANCZOS).save(path, optimize=True)
        print('  wrote', path, '(%d x %d)' % (size, size))


# ---- command line ----------------------------------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('demos', nargs='+', type=Path, help='demo folders, e.g. demos/qiangs-trip (or demos/*)')
    ap.add_argument('--step', help='the step to show, counting from 1 (default: from the demo\'s <meta name="thumbnail">)')
    ap.add_argument('--viewport', metavar='WIDTH[xHEIGHT]',
                    help='browser window in CSS pixels. A width alone makes the window as tall as it takes for a '
                         'square workspace (default: 860)')
    ap.add_argument('--fit', help='cover: cut a square out of the workspace (default); contain: show all of it, '
                                  'padded out with the colour of the paper')
    ap.add_argument('--focus', metavar='X,Y',
                    help='where the square is cut from when the workspace is not square or with --zoom, each between '
                         '0 and 1: 0,0 top left, .5,.5 the middle (default), 1,1 bottom right')
    ap.add_argument('--zoom', help='cut a smaller square to show part of the drawing larger: 1.5 = a square 2/3 as '
                                   'wide (default: 1)')
    ap.add_argument('-o', '--out', help='output file, for a single demo (default: <demo>/thumbnail.png)')
    ap.add_argument('--size', type=int, default=120, help='thumbnail width and height in pixels (default: %(default)s)')
    ap.add_argument('--no-2x', action='store_true', help='leave out the double-size copy (thumbnail@2x.png)')
    ap.add_argument('--scale', type=float, default=2, help='device pixel ratio of the screenshot (default: %(default)s)')
    ap.add_argument('--selector', default='.stage', help='the element to screenshot (default: %(default)s)')
    ap.add_argument('--wait', type=int, default=600,
                    help='extra milliseconds to wait after the step has finished (default: %(default)s)')
    ap.add_argument('--timeout', type=int, default=90, help='seconds to wait for a step (default: %(default)s)')
    ap.add_argument('--raw', metavar='DIR', help='also save the uncut screenshot of the workspace in DIR')
    args = ap.parse_args()
    if args.out and len(args.demos) > 1:
        ap.error('--out works with one demo at a time')

    cli = {k: getattr(args, k) for k in PARSE}
    jobs = []
    for demo in args.demos:
        if not (demo / 'index.html').is_file():
            print('skipping %s: no index.html' % demo, file=sys.stderr)
            continue
        opts = settings_for(demo, cli)
        if 'step' not in opts:
            print('skipping %s: no --step, and no step in a <meta name="thumbnail"> in its index.html' % demo,
                  file=sys.stderr)
            continue
        jobs.append((demo, opts))
    if not jobs:
        return 1

    from playwright.sync_api import sync_playwright
    server = serve(ROOT)
    base = 'http://127.0.0.1:%d' % server.server_address[1]
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            for demo, opts in jobs:
                make(browser, base, demo, opts, args)
            browser.close()
    finally:
        server.shutdown()
    return 0


if __name__ == '__main__':
    sys.exit(main())
