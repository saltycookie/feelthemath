#!/usr/bin/env python3
"""Make the wood pictures of framework/theme.css: the light maple desk that the paper box stands on
(framework/wood.webp), and the stained pine of the front page's lid, like a treasure chest's (framework/lid-wood.webp).

    python3 tools/wood.py                  -> framework/wood.webp
    python3 tools/wood.py --lid            -> framework/lid-wood.webp
    python3 tools/wood.py --seed 5         (another piece of the same wood)
    python3 tools/wood.py -o desk.png      (any format Pillow can write)

Each picture tiles without seams: everything in it is made from noise that repeats exactly across the picture
(it is shaped in frequency space), and the grain lines go a whole number of times down it. Needs numpy and pillow:
    pip install numpy pillow
"""
import argparse, os
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H = 1200, 900                         # one tile; the grain runs from left to right

# the woods. base: the wood's colour; late: the darker lines of the grain; light: the lighter, silky streaks.
# rings: whole grain lines down the tile (so it repeats); wander: how far the lines wander up and down;
# line: how thin the dark lines are (higher is thinner); dark, soft, fibre, sheen: how strong each part is.
WOODS = {
    'desk': dict(out='wood.webp', seed=11,                   # light maple
                 base=(231, 211, 174), late=(200, 164, 115), light=(241, 227, 199),
                 rings=15, wander=(0.32, 0.10), line=9, dark=0.46, soft=0.10, fibre=0.07, sheen=0.22, grit=1.2),
    'lid': dict(out='lid-wood.webp', seed=4,                 # pine, stained a warm honey brown
                base=(150, 84, 38), late=(84, 40, 14), light=(186, 114, 56),
                rings=10, wander=(0.42, 0.12), line=5.5, dark=0.72, soft=0.16, fibre=0.12, sheen=0.34, grit=1.6),
}


def noise(rng, fx, fy):
    """Smooth noise that repeats across the tile, scaled to mean 0 and standard deviation 1.
    fx, fy: how many waves, roughly, fit across the tile's width and height."""
    white = rng.standard_normal((H, W))
    kx = np.fft.fftfreq(W) * W          # waves across the width
    ky = np.fft.fftfreq(H) * H
    shape = np.exp(-(kx[None, :] / fx) ** 2 - (ky[:, None] / fy) ** 2)
    n = np.real(np.fft.ifft2(np.fft.fft2(white) * shape))
    return (n - n.mean()) / n.std()


def wood(seed, base, late, light, rings, wander, line, dark, soft, fibre, sheen, grit, **_):
    rng = np.random.default_rng(seed)
    y = np.arange(H)[:, None] / H
    # the grain lines: rings of the tree, cut lengthways, so they wander slowly up and down
    t = y * rings + wander[0] * noise(rng, 1.6, 2.5) + wander[1] * noise(rng, 5, 9)
    p = t - np.floor(t)
    lines = (0.5 + 0.5 * np.cos(2 * np.pi * p)) ** line                # a dark line once per ring
    lines *= 0.55 + 0.45 * np.clip(0.5 + 0.35 * noise(rng, 3, 8), 0, 1)  # some lines darker than others
    shade = (0.5 + 0.5 * np.cos(2 * np.pi * (p - 0.18))) ** 2           # a soft shadow beside each line
    # fibres: fine, long streaks
    fib = noise(rng, 14, 260)
    # the silky sheen: broad, faint lighter bands
    shine = np.clip(noise(rng, 1.5, 4), 0, None)

    d = dark * lines + soft * shade + fibre * np.clip(fib, 0, None)
    l = sheen * shine + 0.05 * np.clip(-fib, 0, None)
    img = np.empty((H, W, 3))
    for c in range(3):
        img[:, :, c] = base[c] + (late[c] - base[c]) * d + (light[c] - base[c]) * l
    img += rng.normal(0, grit, (H, W, 1))                                 # a little grit, so there is no banding
    return np.clip(img, 0, 255).astype(np.uint8)


def main():
    from PIL import Image
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--lid', action='store_true', help="the lid's stained pine instead of the desk's maple")
    ap.add_argument('--seed', type=int, help='which piece of wood (default: 11 for the desk, 4 for the lid)')
    ap.add_argument('-o', '--out', help='where to write it (default: framework/wood.webp or framework/lid-wood.webp)')
    ap.add_argument('--quality', type=int, default=78, help='WebP/JPEG quality (default: %(default)s)')
    a = ap.parse_args()
    kind = WOODS['lid' if a.lid else 'desk']
    out = a.out or os.path.join(ROOT, 'framework', kind['out'])
    im = Image.fromarray(wood(**{**kind, 'seed': kind['seed'] if a.seed is None else a.seed}), 'RGB')
    im.save(out, quality=a.quality, method=6) if out.endswith('.webp') else im.save(out, quality=a.quality)
    print('wrote %s (%d x %d, %d KB)' % (out, W, H, os.path.getsize(out) // 1024))


if __name__ == '__main__':
    main()
