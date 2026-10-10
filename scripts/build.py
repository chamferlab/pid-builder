#!/usr/bin/env python3
"""Build the single-file PID-Builder.html from src/ and the SVG artwork in media/.

Uses only the Python standard library. Run it after editing anything in src/ or media/.
"""
import base64
import hashlib
import json
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'src'
SVG = 'http://www.w3.org/2000/svg'

# The seal drawings sit somewhere on an Inkscape page, so each is cropped to its artwork.
# Bounds are measured with SVG getBBox(), in the source viewBox units; update an entry
# when the size or position of that drawing changes.
BOUNDS = {
    'single-seal': [11.586, 47.9399, 191.4742, 195.4072],
    'dual-seal-bb-w-plug': [6.0404, 72.4234, 195.2683, 151.9112],
    'dual-seal-bb-wo-plug': [9.3777, 68.3088, 193.1235, 144.0006],
    'dual-seal-ff-w-plug': [2.7294, 60.3508, 204.99, 150.8209],
    'dual-seal-ff-wo-plug': [5.0718, 53.8741, 197.5298, 153.5835],
    'dual-seal-fb-w-plug': [4.8715, 76.4658, 201.0721, 152.605],
    'dual-seal-fb-wo-plug': [5.4387, 57.0521, 201.7727, 160.4755],
}
SOURCE_FILES = {'single-seal': 'single_seal.svg', 'control-valve': 'Control_valve.svg'}
# Seals are scaled to a common width. The single seal is drawn 1.345 times larger than the dual
# seals, so it gets the width that gives its parts and outlines the same size as theirs.
SEAL_WIDTH = 455
SEAL_WIDTHS = {'single-seal': 336}
SEAL_ARRANGEMENTS = {'bb': 'Back-to-back', 'ff': 'Face-to-face', 'fb': 'Face-to-back'}
# Equipment is drawn at canvas scale with the viewBox as the symbol's box, so it needs no bounds.
# Listed in palette order: name, palette detail, default caption.
EQUIPMENT = {
    'reservoir': ('Reservoir', 'Process equipment', 'RESERVOIR'),
    'nitrogen': ('Reservoir + N₂ top connection', 'Process equipment', 'N₂ RESERVOIR'),
    'accumulator': ('Accumulator', 'Process equipment', 'ACCUMULATOR'),
    'cooler': ('Cooler', 'Process equipment', 'COOLER'),
    'cooler-dual': ('Cooler, two coils', 'Process equipment', 'COOLER'),
    'heater': ('Heater', 'Process equipment', 'HEATER'),
    'circulating-pump': ('Circulating pump', 'Process equipment', 'CIRCULATING PUMP'),
    'air-driven-pump': ('Air driven pump', 'Air operated pump', 'AIR PUMP'),
    'control-valve': ('Pressure control valve', 'Dome-loaded', 'PRESSURE CONTROL VALVE'),
}

# Ports a new piece of equipment starts with: the open end of each nozzle drawn in its SVG,
# in that SVG's viewBox coordinates. Update an entry when a nozzle moves.
PORTS = {
    'reservoir': [(85, 0), (0, 107.5), (170, 107.5), (85, 215)],
    'nitrogen': [(85, 0), (0, 107.5), (170, 107.5), (85, 215)],
    'accumulator': [(40, 200)],
    'cooler': [(65, 0), (65, 200), (0, 140), (130, 60)],
    'cooler-dual': [(65, 0), (135, 0), (65, 200), (135, 200), (0, 140), (200, 60)],
    'heater': [(65, 0), (65, 200)],
    'circulating-pump': [(0, 55), (110, 55)],
    'air-driven-pump': [(0, 87), (170, 87), (85, 0)],
    'control-valve': [(0, 80), (120, 80), (60, 0)],
}


def symbol_catalog():
    """Crop each media SVG to its artwork and return it as an embeddable catalog entry."""
    ET.register_namespace('', SVG)
    catalog = {}
    for key in [*BOUNDS, *EQUIPMENT]:
        source = ROOT / 'media' / SOURCE_FILES.get(key, key + '.svg')
        root = ET.parse(source).getroot()
        # Retain artwork and remove editor metadata, leaving a portable SVG image.
        for parent in list(root.iter()):
            for child in list(parent):
                if not child.tag.startswith('{' + SVG + '}'):
                    parent.remove(child)
            for attr in list(parent.attrib):
                if attr.startswith('{') and not attr.startswith('{http://www.w3.org/XML/1998/namespace}'):
                    del parent.attrib[attr]
        if key in BOUNDS:
            x, y, width, height = BOUNDS[key]
            x -= 2; y -= 2; width += 4; height += 4
            root.set('viewBox', f'{x} {y} {width} {height}')
            root.set('width', str(width))
            root.set('height', str(height))
        else:
            width, height = (float(value) for value in root.get('viewBox').split()[2:])
        if key == 'single-seal':
            name, detail, tag, group = 'Single seal', '', 'SINGLE SEAL', 'seal'
            scale = SEAL_WIDTHS[key] / width
        elif key in BOUNDS:
            arrangement = SEAL_ARRANGEMENTS[key.split('-')[2]]
            plugless = '-wo-' in key
            name, detail, group = arrangement, 'Without plug seal' if plugless else 'With plug seal', 'seal'
            tag = arrangement.upper() + (' · WO PLUG' if plugless else ' · W PLUG')
            scale = SEAL_WIDTHS.get(key, SEAL_WIDTH) / width
        else:
            (name, detail, tag), group = EQUIPMENT[key], 'equipment'
            scale = 1
        catalog[key] = {
            'name': name, 'detail': detail, 'tag': tag, 'group': group, 'w': width * scale, 'h': height * scale,
            'version': hashlib.sha256(source.read_bytes()).hexdigest()[:12],
            'svg': 'data:image/svg+xml;base64,' + base64.b64encode(ET.tostring(root, encoding='utf-8')).decode(),
        }
        if key in PORTS:
            catalog[key]['ports'] = [{'id': f'P{i}', 'x': x - width / 2, 'y': y - height / 2} for i, (x, y) in enumerate(PORTS[key], 1)]
    return catalog


def js_literal(value):
    """JSON that is safe inside an inline <script>."""
    return json.dumps(value, separators=(',', ':'), ensure_ascii=False).replace('</', '<\\/')


def build():
    catalog = symbol_catalog()
    injected = (
        '// Embedded artwork, generated from media/.\n'
        f'const MEDIA_SYMBOLS={js_literal(catalog)};\n'
    )
    scripts = [injected] + [path.read_text() for path in sorted((SRC / 'js').glob('*.js'))]
    html = (SRC / 'index.html').read_text()
    html = html.replace('/* @build:css */', (SRC / 'styles.css').read_text().strip())
    html = html.replace('/* @build:js */', '\n'.join(script.strip() + '\n' for script in scripts))
    (ROOT / 'PID-Builder.html').write_text(html)
    print(f'Built PID-Builder.html: {len(catalog)} media symbols, {len(scripts) - 1} scripts, {len(html) // 1024} KB.')


if __name__ == '__main__':
    build()
