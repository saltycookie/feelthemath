#!/usr/bin/env python3
"""Make framework/wood.webp: the light maple desk that the magic box stands on (see framework/theme.css; the box's
walls are the same picture, darkened to walnut).

    python3 tools/wood.py                  -> framework/wood.webp
    python3 tools/wood.py --seed 5         (another piece of the same wood)
    python3 tools/wood.py -o desk.png      (any format Pillow can write)

The picture tiles without seams: everything in it is made from noise that repeats exactly across the picture
(it is shaped in frequency space), and the grain lines go a whole number of times down it. Needs numpy and pillow:
    pip install numpy pillow
"""
import argparse, os
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H = 1200, 900                         # one tile; the grain runs from left to right
BASE = (231, 211, 174)                   # pale maple
LATE = (200, 164, 115)                   # the darker lines of the grain
LIGHT = (241, 227, 199)                  # the lighter, silky streaks


def noise(rng, fx, fy):
    """Smooth noise that repeats across the tile, scaled to mean 0 and standard deviation 1.
    fx, fy: how many waves, roughly, fit across the tile's width and height."""
    white = rng.standard_normal((H, W))
    kx = np.fft.fftfreq(W) * W          # waves across the width
    ky = np.fft.fftfreq(H) * H
    shape = np.exp(-(kx[None, :] / fx) ** 2 - (ky[:, None] / fy) ** 2)
    n = np.real(np.fft.ifft2(np.fft.fft2(white) * shape))
    return (n - n.mean()) / n.std()


def wood(seed):
    rng = np.random.default_rng(seed)
    y = np.arange(H)[:, None] / H
    # the grain lines: rings of the tree, cut lengthways, so they wander slowly up and down
    rings = 15                                                       # whole lines down the tile, so it repeats
    t = y * rings + 0.32 * noise(rng, 1.6, 2.5) + 0.10 * noise(rng, 5, 9)
    p = t - np.floor(t)
    late = (0.5 + 0.5 * np.cos(2 * np.pi * p)) ** 9                  # a thin dark line once per ring
    late *= 0.55 + 0.45 * np.clip(0.5 + 0.35 * noise(rng, 3, 8), 0, 1)   # some lines darker than others
    soft = (0.5 + 0.5 * np.cos(2 * np.pi * (p - 0.18))) ** 2          # a soft shadow beside each line
    # fibres: fine, long streaks
    fibre = noise(rng, 14, 260)
    # the silky sheen: broad, faint lighter bands
    sheen = np.clip(noise(rng, 1.5, 4), 0, None)

    dark = 0.46 * late + 0.10 * soft + 0.07 * np.clip(fibre, 0, None)
    light = 0.22 * sheen + 0.05 * np.clip(-fibre, 0, None)
    img = np.empty((H, W, 3))
    for c in range(3):
        v = BASE[c] + (LATE[c] - BASE[c]) * dark + (LIGHT[c] - BASE[c]) * light
        img[:, :, c] = v
    img += rng.normal(0, 1.2, (H, W, 1))                                 # a little grit, so there is no banding
    return np.clip(img, 0, 255).astype(np.uint8)


def main():
    from PIL import Image
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--seed', type=int, default=11, help='which piece of wood (default: %(default)s)')
    ap.add_argument('-o', '--out', default=os.path.join(ROOT, 'framework', 'wood.webp'), help='where to write it')
    ap.add_argument('--quality', type=int, default=78, help='WebP/JPEG quality (default: %(default)s)')
    a = ap.parse_args()
    im = Image.fromarray(wood(a.seed), 'RGB')
    im.save(a.out, quality=a.quality, method=6) if a.out.endswith('.webp') else im.save(a.out, quality=a.quality)
    print('wrote %s (%d x %d, %d KB)' % (a.out, W, H, os.path.getsize(a.out) // 1024))


if __name__ == '__main__':
    main()
