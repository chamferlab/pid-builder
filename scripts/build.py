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

# Artwork bounds measured with SVG getBBox(), in the source viewBox units.
# Update an entry when the size or position of that drawing changes.
BOUNDS = {
    'dual-seal-bb-w-plug': [6.0404, 72.4234, 195.2683, 151.9112],
    'dual-seal-bb-wo-plug': [9.3777, 68.3088, 193.1235, 144.0006],
    'dual-seal-ff-w-plug': [2.7294, 60.3508, 204.99, 150.8209],
    'dual-seal-ff-wo-plug': [5.0718, 53.8741, 197.5298, 153.5835],
    'dual-seal-fb-w-plug': [4.8715, 76.4658, 201.0721, 152.605],
    'dual-seal-fb-wo-plug': [5.4387, 57.0521, 201.7727, 160.4755],
    'accumulator': [75.6388, 47.5058, 49.046, 201.9605],
    'circulating-pump': [67.6707, 102.3983, 39.2028, 39.2028],
    'reservoir': [64.1265, 104.6028, 82.5414, 72.7937],
    'control-valve': [62.2243, 106.0295, 71.9266, 54.832],
    'cooler': [52.6471, 15.7316, 102.4898, 268.3659],
    'heater': [59.3427, 15.9501, 87.5195, 266.5757],
}
SOURCE_FILES = {'control-valve': 'Control_valve.svg'}
SEAL_ARRANGEMENTS = {'bb': 'Back-to-back', 'ff': 'Face-to-face', 'fb': 'Face-to-back'}
# name, palette detail, default caption
EQUIPMENT = {
    'accumulator': ('Accumulator', 'Process equipment', 'ACCUMULATOR'),
    'circulating-pump': ('Circulating pump', 'Process equipment', 'CIRCULATING PUMP'),
    'cooler': ('Cooler', 'Process equipment', 'COOLER'),
    'heater': ('Heater', 'Process equipment', 'HEATER'),
    'reservoir': ('Reservoir', 'Process equipment', 'RESERVOIR'),
    'control-valve': ('Pressure control valve', 'Dome-loaded', 'PRESSURE CONTROL VALVE'),
}


def symbol_catalog():
    """Crop each media SVG to its artwork and return it as an embeddable catalog entry."""
    ET.register_namespace('', SVG)
    catalog = {}
    for key, bounds in BOUNDS.items():
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
        x, y, width, height = bounds
        x -= 2; y -= 2; width += 4; height += 4
        root.set('viewBox', f'{x} {y} {width} {height}')
        root.set('width', str(width))
        root.set('height', str(height))
        if key.startswith('dual-seal-'):
            arrangement = SEAL_ARRANGEMENTS[key.split('-')[2]]
            plugless = '-wo-' in key
            name, detail, group = arrangement, 'Without plug seal' if plugless else 'With plug seal', 'seal'
            tag = arrangement.upper() + (' · WO PLUG' if plugless else ' · W PLUG')
            scale = 455 / width
        else:
            (name, detail, tag), group = EQUIPMENT[key], 'equipment'
            scale = min(190 / width, 250 / height)
        catalog[key] = {
            'name': name, 'detail': detail, 'tag': tag, 'group': group, 'w': width * scale, 'h': height * scale,
            'version': hashlib.sha256(source.read_bytes()).hexdigest()[:12],
            'svg': 'data:image/svg+xml;base64,' + base64.b64encode(ET.tostring(root, encoding='utf-8')).decode(),
        }
    return catalog


def js_literal(value):
    """JSON that is safe inside an inline <script>."""
    return json.dumps(value, separators=(',', ':'), ensure_ascii=False).replace('</', '<\\/')


def build():
    catalog = symbol_catalog()
    injected = (
        '// Embedded artwork, generated from media/ and src/assets/.\n'
        f'const MEDIA_SYMBOLS={js_literal(catalog)};\n'
        f"const DEFAULT_SEAL_MARKUP={js_literal((SRC / 'assets' / 'single-seal.svgfrag').read_text())};\n"
    )
    scripts = [injected] + [path.read_text() for path in sorted((SRC / 'js').glob('*.js'))]
    html = (SRC / 'index.html').read_text()
    html = html.replace('/* @build:css */', (SRC / 'styles.css').read_text().strip())
    html = html.replace('/* @build:js */', '\n'.join(script.strip() + '\n' for script in scripts))
    (ROOT / 'PID-Builder.html').write_text(html)
    print(f'Built PID-Builder.html: {len(catalog)} media symbols, {len(scripts) - 1} scripts, {len(html) // 1024} KB.')


if __name__ == '__main__':
    build()
