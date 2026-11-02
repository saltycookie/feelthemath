#!/usr/bin/env python3
"""Make the site's icon files from favicon.svg.

    python3 tools/icons.py
        writes favicon.ico (16, 32 and 48 px) and apple-touch-icon.png (180 x 180) next to favicon.svg

favicon.svg is the icon itself, and modern browsers use it as it is. The two files made here are for everything
else: favicon.ico for older browsers and for anything that asks a site for /favicon.ico, and apple-touch-icon.png
for iPhones and iPads, which show it when the site is added to the home screen. iOS rounds the corners itself, so
that picture is a full square, with the tile's rounded corners filled in with the board colour.

Run it again after changing favicon.svg.

Requirements
    pip install playwright pillow
    playwright install chromium
"""
import argparse, io
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent      # the repository: the folder that holds index.html
SVG = ROOT / 'favicon.svg'
ICO, ICO_SIZES = ROOT / 'favicon.ico', (16, 32, 48)
TOUCH, TOUCH_SIZE = ROOT / 'apple-touch-icon.png', 180
BOARD = (61, 104, 86, 255)                          # --board in framework/theme.css


def render(browser, size):
    """favicon.svg drawn by Chromium at size x size pixels, on a transparent background"""
    page = browser.new_page(viewport={'width': size, 'height': size})
    page.goto(SVG.as_uri())
    png = page.screenshot(omit_background=True)
    page.close()
    return Image.open(io.BytesIO(png)).convert('RGBA')


def main():
    argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter).parse_args()
    with sync_playwright() as p:
        browser = p.chromium.launch()
        # each size drawn on its own, so the small ones are sharp rather than shrunk from a big one
        icons = [render(browser, s) for s in ICO_SIZES]
        touch = render(browser, TOUCH_SIZE)
        browser.close()
    icons[-1].save(ICO, format='ICO', sizes=[i.size for i in icons], append_images=icons[:-1])
    print('wrote', ICO.relative_to(ROOT))
    Image.alpha_composite(Image.new('RGBA', touch.size, BOARD), touch).convert('RGB').save(TOUCH, optimize=True)
    print('wrote', TOUCH.relative_to(ROOT))


if __name__ == '__main__':
    main()
