"""Build the online edition's pixel B/D icons with Python's standard library.

Run from any directory: python3 scripts/generate-favicon.py
Grid geometry is shared by SVG, PNG and ICO. No fonts or network calls.
"""
from pathlib import Path
import struct
import zlib

OUT = Path(__file__).resolve().parent.parent / 'public'
NAVY = '#071421'
CYAN = '#25E8FF'
B = ['11110', '11111', '11011', '11011', '11110',
     '11110', '11011', '11011', '11111', '11110']
D = ['11110', '11111', '11011', '11011', '11011',
     '11011', '11011', '11011', '11111', '11110']
pixels = {(left + x, 3 + y) for left, glyph in [(2, B), (9, D)]
          for y, row in enumerate(glyph) for x, value in enumerate(row) if value == '1'}
paths = ' '.join(f'M{x} {y}h1v1h-1z' for x, y in sorted(pixels))
svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges">\n'
       f'<title>Brian\u2019s Dash \u2014 online B/D monogram</title>\n'
       f'<path fill="{NAVY}" d="M0 0h16v16H0z"/>\n'
       f'<path fill="{CYAN}" d="{paths}"/>\n</svg>\n')
(OUT / 'favicon.svg').write_text(svg)

def chunk(kind, payload):
    return struct.pack('>I', len(payload)) + kind + payload + struct.pack('>I', zlib.crc32(kind + payload))

def png(size):
    navy, cyan = bytes.fromhex(NAVY[1:]), bytes.fromhex(CYAN[1:])
    rows = b''.join(b'\0' + b''.join(cyan if (x * 16 // size, y * 16 // size) in pixels else navy
                                   for x in range(size)) for y in range(size))
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(rows, 9)) + chunk(b'IEND', b''))

for size in (16, 32):
    (OUT / f'favicon-{size}x{size}.png').write_bytes(png(size))
(OUT / 'apple-touch-icon.png').write_bytes(png(180))
sizes = (16, 32, 48)
offset = 6 + 16 * len(sizes)
directory, images = [], []
for size in sizes:
    image = png(size)
    directory.append(struct.pack('<BBBBHHII', size, size, 0, 0, 1, 24, len(image), offset))
    images.append(image)
    offset += len(image)
(OUT / 'favicon.ico').write_bytes(struct.pack('<HHH', 0, 1, len(sizes)) + b''.join(directory + images))
print('Generated online B/D SVG, 16/32 PNG, 180 touch icon and 16/32/48 ICO.')
