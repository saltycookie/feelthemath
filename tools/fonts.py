#!/usr/bin/env python3
"""Make the site's handwriting font, framework/fonts/kalam-regular.woff2 and kalam-bold.woff2, from Kalam's original files.

    python3 tools/fonts.py path/to/kalam
        path/to/kalam: a folder with Kalam-Regular.ttf, Kalam-Bold.ttf and OFL.txt, such as ofl/kalam in Google's
        collection of fonts, https://github.com/google/fonts

Kalam is by Indian Type Foundry, under the SIL Open Font License (framework/fonts/OFL.txt, copied there from the same
folder). The site serves it itself rather than loading it from Google Fonts, so a visit sends nothing to Google.

Only Kalam's Latin letters, punctuation, currency and maths signs are kept: the demos are in English, and its
Devanagari is most of each file. A character Kalam doesn't have (or that was left out) is written in the next font
of --font-hand in framework/theme.css.

Requirements
    pip install fonttools brotli
"""
import argparse, os, shutil, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # the repository
OUT = os.path.join(ROOT, 'framework', 'fonts')
FILES = {'Kalam-Regular.ttf': 'kalam-regular.woff2', 'Kalam-Bold.ttf': 'kalam-bold.woff2'}


def keep(cp):
    """Every character of Kalam but its Devanagari (and the Devanagari blocks' helpers) and its private-use glyphs."""
    return not (0x0900 <= cp <= 0x097F or 0x1CD0 <= cp <= 0x1CFF or 0xA830 <= cp <= 0xA83F or 0xA8E0 <= cp <= 0xA8FF
                or 0xE000 <= cp <= 0xF8FF or cp >= 0xF0000)


def make(src, dst):
    from fontTools import subset
    from fontTools.ttLib import TTFont
    font = TTFont(src)
    chars = [cp for cp in font.getBestCmap() if keep(cp)]
    opts = subset.Options()
    opts.layout_features = ['*']                   # every OpenType feature the kept letters use (kerning, ligatures, ...)
    opts.name_IDs = ['*']                          # the whole naming table, with the font's copyright and licence lines
    opts.name_languages = ['*']
    opts.notdef_outline = True
    opts.flavor = 'woff2'
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=chars)
    sub.subset(font)
    subset.save_font(font, dst, opts)
    return len(chars), len(font.getGlyphOrder())


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('src', help='folder with Kalam-Regular.ttf, Kalam-Bold.ttf and OFL.txt')
    a = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    for name, out in FILES.items():
        src, dst = os.path.join(a.src, name), os.path.join(OUT, out)
        chars, glyphs = make(src, dst)
        print('wrote %s: %d characters, %d glyphs, %.1f KB (from %.1f KB)'
              % (os.path.relpath(dst, ROOT), chars, glyphs, os.path.getsize(dst) / 1024, os.path.getsize(src) / 1024))
    shutil.copyfile(os.path.join(a.src, 'OFL.txt'), os.path.join(OUT, 'OFL.txt'))
    print('wrote', os.path.relpath(os.path.join(OUT, 'OFL.txt'), ROOT))


if __name__ == '__main__':
    sys.exit(main())
