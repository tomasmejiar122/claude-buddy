"""Pixel-art buddies for claude-buddy, same size as Mr Irrelevant (14x13).

Each buddy is a 13-row x 14-col letter grid ('.' = transparent) plus a
palette. The wave and cheer poses are derived from the normal pose by moving
the arms, and the blink pose paints the eye pixels with the lid color.

Run `python buddies.py` to render preview sheets into design/preview/.
"""
from pathlib import Path
from PIL import Image, ImageDraw

W, H = 14, 13
OUT = Path(__file__).parent / "preview"

BUDDIES = {}


def buddy(name, label, rows, colors, eyes, lid, arm, armc, sparkle='S', mini=None):
    """Register a buddy.

    eyes:  (row, col) pixels that close when blinking
    lid:   letter used for closed eyes
    arm:   (row, col) pixels of the right arm in the normal pose; the left
           arm is the mirror image
    armc:  letter used to draw a raised arm
    """
    assert len(rows) == H, (name, len(rows))
    for i, r in enumerate(rows):
        assert len(r) == W, (name, i, len(r), r)
    colors = {'S': (255, 240, 150), **colors}
    if mini:
        assert len(mini) == 8 and all(len(r) == 8 for r in mini), (name, 'mini 8x8')
    BUDDIES[name] = dict(label=label, rows=rows, colors=colors, eyes=eyes, lid=lid,
                         arm=arm, armc=armc, sparkle=sparkle, mini=mini)


def put(g, r, c, ch):
    if 0 <= r < H and 0 <= c < W:
        g[r][c] = ch


def poses(b):
    rows = [list(r) for r in b['rows']]
    arm = b['arm']
    shoulder = min((r for r, _ in arm), default=9)
    armc = b['armc']

    def mirror(c):
        return W - 1 - c

    def lower(g, side):
        for (r, c) in arm:
            g[r][c if side > 0 else mirror(c)] = '.'

    def raise_(g, side, sparkle=False):
        # a short arm beside the face with the hand on top
        col = 13 if side > 0 else 0
        inner = col - side
        for r in range(shoulder - 3, shoulder):
            put(g, r, col, armc)
        hand = shoulder - 4
        put(g, hand, col, armc)
        if g[hand][inner] == '.':
            put(g, hand, inner, armc)
        if sparkle and hand - 1 >= 0 and g[hand - 1][inner] == '.':
            put(g, hand - 1, inner, b['sparkle'])

    normal = [r[:] for r in rows]

    blink = [r[:] for r in rows]
    for (r, c) in b['eyes']:
        blink[r][c] = b['lid']

    wave = [r[:] for r in rows]
    lower(wave, +1)
    raise_(wave, +1)

    cheer = [r[:] for r in rows]
    lower(cheer, +1)
    lower(cheer, -1)
    raise_(cheer, +1, sparkle=True)
    raise_(cheer, -1, sparkle=True)

    # second celebration frame: the sparkles blink off
    cheer2 = [['.' if ch == b['sparkle'] else ch for ch in r] for r in cheer]

    return {'normal': normal, 'blink': blink, 'wave': wave, 'cheer': cheer, 'cheer2': cheer2}

def draw_grid(img, g, colors, x0, y0, s):
    d = ImageDraw.Draw(img)
    for r, row in enumerate(g):
        for c, ch in enumerate(row):
            if ch != '.':
                d.rectangle([x0 + c * s, y0 + r * s, x0 + (c + 1) * s - 1, y0 + (r + 1) * s - 1],
                            fill=colors[ch])


def render_sheets():
    OUT.mkdir(exist_ok=True)
    s = 12
    bg = (14, 12, 22)
    names = list(BUDDIES)
    # one sheet per buddy: normal, blink, wave, cheer
    for name in names:
        b = BUDDIES[name]
        p = poses(b)
        img = Image.new("RGB", (30 + 5 * (W * s + 30), H * s + 70), bg)
        d = ImageDraw.Draw(img)
        d.text((30, 10), b['label'], fill=(230, 230, 230))
        for k, pose in enumerate(('normal', 'blink', 'wave', 'cheer')):
            x = 30 + k * (W * s + 30)
            draw_grid(img, p[pose], b['colors'], x, 35, s)
            d.text((x, 35 + H * s + 8), pose, fill=(150, 150, 160))
        if b.get('mini'):  # the 8x8 version, drawn next to the poses
            x = 30 + 4 * (W * s + 30)
            draw_grid(img, [list(r) for r in b['mini']], b['colors'], x, 35, s)
            d.text((x, 35 + H * s + 8), 'mini', fill=(150, 150, 160))
        img.save(OUT / f"{name}.png")
    # overview: everyone in the normal pose
    cols = 5
    rows_n = (len(names) + cols - 1) // cols
    img = Image.new("RGB", (30 + cols * (W * s + 40), 20 + rows_n * (H * s + 50)), bg)
    d = ImageDraw.Draw(img)
    for i, name in enumerate(names):
        b = BUDDIES[name]
        x = 30 + (i % cols) * (W * s + 40)
        y = 20 + (i // cols) * (H * s + 50)
        draw_grid(img, poses(b)['normal'], b['colors'], x, y, s)
        d.text((x, y + H * s + 8), f"{i + 1}. {b['label']}", fill=(200, 200, 210))
    img.save(OUT / "_todos.png")
    # review sheet: every buddy with its four poses, in two columns
    sheets = [Image.open(OUT / f"{n}.png") for n in names]
    half = (len(sheets) + 1) // 2
    cw = max(i.width for i in sheets)
    ch = max(sum(i.height for i in sheets[:half]), sum(i.height for i in sheets[half:]))
    rev = Image.new("RGB", (cw * 2 + 20, ch), (0, 0, 0))
    for k, group in enumerate((sheets[:half], sheets[half:])):
        y = 0
        for im in group:
            rev.paste(im, (k * (cw + 20), y))
            y += im.height
    rev.save(OUT / "_revision.png")


# ---------------------------------------------------------------------------
# The buddies
# ---------------------------------------------------------------------------

buddy('marciano', 'Marciano', [
    "..Y........Y..",
    "...G......G...",
    "....GGGGGG....",
    "..GGLLLLLLGG..",
    ".GLLLLLLLLLLG.",
    ".GLKWKLLKWKLG.",
    ".GLKKKLLKKKLG.",
    "..GLLLMMLLLG..",
    "...GGLLLLGG...",
    ".GGDLLLLLLDGG.",
    ".G.DLLLLLLD.G.",
    "...DDLLLLDD...",
    "...DD....DD...",
], {
    'G': (70, 170, 70), 'L': (140, 230, 110), 'D': (50, 130, 55),
    'K': (12, 16, 12), 'W': (255, 255, 255), 'M': (30, 70, 30), 'Y': (255, 220, 80),
}, eyes=[(5, 3), (5, 4), (5, 5), (5, 8), (5, 9), (5, 10), (6, 3), (6, 4), (6, 5), (6, 8), (6, 9), (6, 10)],
   lid='G', arm=[(9, 12), (10, 12)], armc='G')

buddy('gato', 'Gato', [
    "..O........O..",
    "..OO......OO..",
    "..OAOOOOOOAO..",
    "..OBBBBBBBBO..",
    ".OBBBBBBBBBBO.",
    ".OBKWBBBBKWBO.",
    "WOBKKBBBBKKBOW",
    ".OBBBBNNBBBBO.",
    "W.OBBMBBMBBO.W",
    ".BOBCCCCCCBOB.",
    ".O.OCCCCCCO.O.",
    "...OBBBBBBO..T",
    "...OO....OOTT.",
], {
    'O': (120, 60, 20), 'B': (245, 150, 60), 'A': (255, 190, 170), 'C': (255, 225, 190),
    'K': (20, 12, 8), 'W': (240, 240, 240), 'N': (240, 110, 130), 'M': (120, 60, 20),
    'T': (245, 150, 60),
}, eyes=[(5, 3), (5, 4), (5, 9), (5, 10), (6, 3), (6, 4), (6, 9), (6, 10)],
   lid='B', arm=[(9, 12), (10, 12)], armc='B')

buddy('perro', 'Perro', [
    "....OOOOOO....",
    "..OOBBBBBBOO..",
    ".EEOBBBBBBOEE.",
    "EEEBBBBBBBBEEE",
    "EEEBKWBBKWBEEE",
    "EEEBKKBBKKBEEE",
    ".EEBBCCCCBBEE.",
    "..OBCCNNCCBO..",
    "...OCMMMMCO...",
    ".BOBBCTTCBBOB.",
    ".O.OBBBBBBO.O.",
    "...OBBBBBBO...",
    "...OO....OO...",
], {
    'O': (80, 50, 25), 'B': (200, 140, 80), 'E': (120, 75, 40), 'C': (245, 225, 195),
    'K': (20, 12, 8), 'W': (255, 255, 255), 'N': (30, 20, 20), 'M': (90, 40, 40),
    'T': (240, 100, 120),
}, eyes=[(4, 4), (4, 5), (4, 8), (4, 9), (5, 4), (5, 5), (5, 8), (5, 9)],
   lid='B', arm=[(9, 12), (10, 12)], armc='B')

buddy('robot', 'Robot', [
    "......RR......",
    "......OO......",
    "...OOOOOOOO...",
    "..OGGGGGGGGO..",
    ".OGKKKKKKKKGO.",
    ".OGKCCKKCCKGO.",
    ".OGKKKKKKKKGO.",
    "..OGGMMMMGGO..",
    "...OOOOOOOO...",
    ".GOGGDRRDGGOG.",
    ".O.OGDDDDGO.O.",
    "...OGGGGGGO...",
    "...OO....OO...",
], {
    'O': (60, 65, 80), 'G': (175, 185, 200), 'D': (120, 130, 150), 'K': (20, 24, 34),
    'C': (80, 230, 255), 'R': (255, 80, 90), 'M': (90, 100, 120),
}, eyes=[(5, 4), (5, 5), (5, 8), (5, 9)],
   lid='K', arm=[(9, 12), (10, 12)], armc='G')

buddy('fantasma', 'Fantasma', [
    "....OOOOOO....",
    "...OWWWWWWO...",
    "..OWWWWWWWWO..",
    ".OWWWWWWWWWWO.",
    ".OWWKKWWKKWWO.",
    ".OWWKKWWKKWWO.",
    ".OWWWWWWWWWWO.",
    ".OWWWPMMPWWWO.",
    ".OWWWWMMWWWWO.",
    "WOWWWWWWWWWWOW",
    ".OWWWWWWWWWWO.",
    ".OWWOWWWWOWWO.",
    ".OO.OO..OO.OO.",
], {
    'O': (150, 150, 200), 'W': (240, 240, 255), 'K': (40, 40, 70), 'M': (60, 60, 100),
    'P': (255, 170, 200),
}, eyes=[(4, 4), (4, 5), (4, 8), (4, 9), (5, 4), (5, 5), (5, 8), (5, 9)],
   lid='W', arm=[(9, 13)], armc='W')

buddy('rana', 'Rana', [
    "..OOO....OOO..",
    ".OWWWO..OWWWO.",
    ".OWKKO..OKKWO.",
    ".OGWWGOOGWWGO.",
    ".OGGGGGGGGGGO.",
    "OGGGGGGGGGGGGO",
    "OGMGGGGGGGGMGO",
    ".OGMMMMMMMMGO.",
    "..OGGGGGGGGO..",
    ".GOGLLLLLLGOG.",
    ".O.OLLLLLLO.O.",
    "..OOGGGGGGOO..",
    ".OOO......OOO.",
], {
    'O': (30, 90, 40), 'G': (90, 190, 80), 'L': (200, 235, 150), 'K': (15, 20, 15),
    'W': (250, 250, 240), 'M': (40, 100, 45),
}, eyes=[(2, 3), (2, 4), (2, 9), (2, 10)],
   lid='G', arm=[(9, 12), (10, 12)], armc='G')

buddy('pinguino', 'Pingüino', [
    "....OOOOOO....",
    "...OKKKKKKO...",
    "..OKKKKKKKKO..",
    "..OKWWKKWWKO..",
    "..OKWEKKWEKO..",
    ".OKKKKYYKKKKO.",
    ".OKWWWYYWWWKO.",
    ".KOWWWWWWWWOK.",
    ".KOWWWWWWWWOK.",
    ".KOWWWWWWWWOK.",
    "..OKWWWWWWKO..",
    "...OOOOOOOO...",
    "...YYY..YYY...",
], {
    'O': (20, 24, 40), 'K': (50, 58, 90), 'W': (245, 245, 250), 'Y': (255, 170, 40),
    'E': (8, 10, 18),
}, eyes=[(3, 4), (3, 5), (4, 4), (4, 5), (3, 8), (3, 9), (4, 8), (4, 9)], lid='K',
   arm=[(7, 12), (8, 12), (9, 12)], armc='K')

buddy('panda', 'Panda', [
    "..KK......KK..",
    ".KKKOOOOOOKKK.",
    ".KKOWWWWWWOKK.",
    "..OWWWWWWWWO..",
    ".OWKKKWWKKKWO.",
    ".OWKWKWWKWKWO.",
    ".OWWKWWWWKWWO.",
    "..OWWWKKWWWO..",
    "...OWWMMWWO...",
    ".KKOWWWWWWOKK.",
    ".KK.OWWWWO.KK.",
    "...OWWWWWWO...",
    "...KKK..KKK...",
], {
    'O': (95, 95, 108), 'W': (245, 245, 245), 'K': (62, 62, 74), 'M': (200, 90, 110),
}, eyes=[(5, 4), (5, 9)], lid='K', arm=[(9, 11), (9, 12), (10, 11), (10, 12)], armc='K')

buddy('buho', 'Búho', [
    "..O........O..",
    "..OO......OO..",
    "..OBOOOOOOBO..",
    ".OBBBBBBBBBBO.",
    ".OWWWBBBBWWWO.",
    ".OWKWBBBBWKWO.",
    ".OWWWBYYBWWWO.",
    ".OBBBBYYBBBBO.",
    ".OBCBCBBCBCBO.",
    "BOBBCBCCBCBBOB",
    "BO.BCBCCBCB.OB",
    "..OBBBBBBBBO..",
    "...YY....YY...",
], {
    'O': (70, 45, 25), 'B': (160, 110, 60), 'C': (215, 180, 130), 'W': (250, 245, 225),
    'K': (20, 15, 10), 'Y': (255, 180, 50),
}, eyes=[(5, 3), (5, 10)], lid='B', arm=[(9, 13), (10, 13)], armc='B')

buddy('slime', 'Slime', [
    "..............",
    "..............",
    "......OO......",
    ".....OLLO.....",
    "....OLLWLO....",
    "...OBLLLLBO...",
    "..OBBBBBBBBO..",
    ".OBBKWBBKWBBO.",
    ".OBBKKBBKKBBO.",
    "OBBBBBMMBBBBBO",
    "OBBBBBBBBBBBBO",
    "OBBBBBBBBBBBBO",
    ".OOOOOOOOOOOO.",
], {
    'O': (20, 120, 140), 'B': (60, 210, 220), 'L': (150, 245, 250), 'W': (255, 255, 255),
    'K': (10, 40, 50), 'M': (20, 100, 120),
}, eyes=[(7, 4), (7, 5), (7, 8), (7, 9), (8, 4), (8, 5), (8, 8), (8, 9)],
   lid='B', arm=[], armc='B')


def export_js():
    """Print the buddies as a JS object literal for claude-buddy.mjs."""
    import json
    out = {}
    for name, b in BUDDIES.items():
        p = poses(b)
        out[name] = {
            'label': b['label'],
            'colors': {k: list(v) for k, v in b['colors'].items()},
            'poses': {k: [''.join(r) for r in g] for k, g in p.items()},
            'mini': b.get('mini'),
        }
    print(json.dumps(out, ensure_ascii=False, indent=0).replace('\n', ''))


# ---------------------------------------------------------------------------
# Mini versions: 8x8, for the "mini" size (4 terminal lines)
# ---------------------------------------------------------------------------

MINIS = {
    'marciano': ['.Y....Y.', '..GGGG..', '.GLLLLG.', '.GKLLKG.',
                 '.GLMMLG.', '.GLLLLG.', '..GLLG..', '..G..G..'],
    'gato': ['.O....O.', 'OBO..OBO', '.BBBBBB.', '.BKBBKB.',
             '.BBNNBB.', '.BCCCCB.', '.OCCCCO.', '..O..O..'],
    'perro': ['..BBBB..', 'EEBBBBEE', 'EEBKBKBE', 'EEBCCCBE',
              '.BCTTCB.', '.BBBBBB.', '.BBBBBB.', '..O..O..'],
    'robot': ['...RR...', '..OOOO..', '.OGGGGO.', '.GKCCKG.',
              '.OGGGGO.', 'GOGGGGOG', '.OGGGGO.', '..O..O..'],
    'fantasma': ['..WWWW..', '.WWWWWW.', '.WKWWKW.', '.WWWWWW.',
                 '.WWMMWW.', '.WWWWWW.', '.WWWWWW.', '.W.WW.W.'],
    'rana': ['.WW..WW.', '.WK..KW.', '.GGGGGG.', 'GGGGGGGG',
             'GMMMMMMG', '.GLLLLG.', '.GLLLLG.', 'GG....GG'],
    'pinguino': ['..KKKK..', '.KKKKKK.', '.KWKKWK.', '.KKYYKK.',
                 'KKWWWWKK', 'K.WWWW.K', '.KWWWWK.', '.YY..YY.'],
    'panda': ['KK....KK', 'KWWWWWWK', '.WWWWWW.', '.WKWWKW.',
              '.WWMMWW.', 'KWWWWWWK', '.WWWWWW.', '.KK..KK.'],
    'buho': ['.O....O.', 'OBO..OBO', '.BBBBBB.', '.WKWWKW.',
             '.BBYYBB.', '.BCBBCB.', '.BCCCCB.', '..Y..Y..'],
    'slime': ['...LL...', '..LLLL..', '.BBLLBB.', '.BBBBBB.',
              'BKWBBWKB', 'BBBBBBBB', 'BBBBBBBB', 'OOOOOOOO'],
}
for _name, _mini in MINIS.items():
    assert len(_mini) == 8 and all(len(r) == 8 for r in _mini), _name
    BUDDIES[_name]['mini'] = _mini


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "export":
        export_js()
    else:
        render_sheets()
        print(f"{len(BUDDIES)} buddies -> {OUT}")
