from PIL import Image, ImageDraw

ACCENT = (47, 111, 94, 255)  # var(--accent) #2f6f5e
WHITE = (255, 255, 255, 255)

def make_icon(size, corner_ratio=0.22, path=None):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    radius = int(size * corner_ratio)
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=ACCENT)

    # Three bars, same proportions as the tab-bar "Orçamento" icon (rect x=3,y=10,w=4,h=10 in a 24x24 grid)
    grid = size / 24
    bars = [
        (3, 10, 7, 20),
        (10, 5, 14, 20),
        (17, 13, 21, 20),
    ]
    bar_radius = max(1, int(grid * 0.6))
    for x0, y0, x1, y1 in bars:
        draw.rounded_rectangle(
            [x0 * grid, y0 * grid, x1 * grid, y1 * grid],
            radius=bar_radius,
            fill=WHITE,
        )
    img.save(path)

make_icon(192, path='/home/claude/ynab-app/public/icons/icon-192.png')
make_icon(512, path='/home/claude/ynab-app/public/icons/icon-512.png')
make_icon(180, corner_ratio=0.22, path='/home/claude/ynab-app/public/icons/apple-touch-icon.png')
make_icon(32, path='/home/claude/ynab-app/public/icons/favicon-32.png')
print('done')
