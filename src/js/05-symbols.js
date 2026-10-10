// Symbol artwork. Each function returns SVG markup centered on the symbol origin.

const sealImage = n => n.sealSvg || (n.sealVariant ? specs[n.sealVariant]?.svg : state.sealSvg);
const artworkImage = (n, href) => `<image href="${escapeHtml(href)}" x="${-n.w / 2}" y="${-n.h / 2}" width="${n.w}" height="${n.h}" preserveAspectRatio="xMidYMid meet"/>`;
const line = (d, width = 2.2, extra = '') => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`;

const BUILT_IN_ARTWORK = {
  // A junction in use shows only the arms that carry a pipe, so a tee is drawn as a tee.
  junction: n => {
    const arms = {L: 'M 0 0 H -22', R: 'M 0 0 H 22', T: 'M 0 0 V -22', B: 'M 0 0 V 22'}, used = connectedPorts(n).filter(id => arms[id]);
    return line((used.length ? used : Object.keys(arms)).map(id => arms[id]).join(' ')) + `<circle r="4" fill="${INK}"/>`;
  },
  'air-driven-pump': () =>
    line('M -85 12 H -39 M 39 12 H 85 M 0 -75 V -60', 2.4) +
    `<circle cx="0" cy="12" r="39" fill="#fff" stroke="${INK}" stroke-width="2.4"/>` +
    `<path d="M -17 -8 L 24 12 L -17 32 Z" fill="#dff4f4" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>` +
    `<rect x="-27" y="-60" width="54" height="17" rx="8" fill="#fff" stroke="${INK}" stroke-width="2.2"/>` +
    line('M -9 -43 V -27 M 9 -43 V -27', 2) +
    `<text x="0" y="-48" text-anchor="middle" font-size="10" font-weight="700" fill="${INK}">AIR</text>`,
  'isolation-valve': () =>
    line('M -48 0 H -23 M 23 0 H 48 M 0 -18 V -31 M -15 -31 H 15', 2.4) +
    `<path d="M -23 -17 L 0 0 L -23 17 Z M 23 -17 L 0 0 L 23 17 Z" fill="#fff" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>`,
  'check-valve': () =>
    line('M -48 0 H -22 M 23 0 H 48 M 22 -20 V 20', 2.4) +
    `<path d="M -22 -18 L 20 0 L -22 18 Z" fill="#fff" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>`,
  drain: () => line('M 0 -45 V 16 M -18 16 H 18 M 0 16 V 38 M -9 29 L 0 38 L 9 29', 2.4),
  vent: () => line('M 0 45 V -16 M -18 -16 H 18 M 0 -16 V -38 M -9 -29 L 0 -38 L 9 -29', 2.4),
  cooler: () =>
    `<rect x="-75" y="-58" width="150" height="116" fill="#fff" stroke="${INK}" stroke-width="2.2"/>` +
    line('M -95 0 H -75 M 75 0 H 95 M 0 -75 V -58 M 0 58 V 75') +
    `<path d="M -65 -30 h19 q16 0 16 13 t-16 13 h-14 q-10 0 -10 12 t10 12 h20 q12 0 12 13 t-12 13 M 65 -30 H46 Q30 -30 30 -17 T46 -4 h14 q10 0 10 12 T60 20 H40 Q28 20 28 33 T40 46" fill="none" stroke="#168da5" stroke-width="3"/>` +
    line('M -75 -38 H75 M -75 38 H75', 1, ' stroke-dasharray="5 5"'),
  bladder: () =>
    `<rect x="-51" y="-75" width="102" height="150" rx="12" fill="#fff" stroke="${INK}" stroke-width="2.2"/>` +
    `<path d="M -51 0 Q 0 -22 51 0" fill="none" stroke="#168da5" stroke-width="2"/>` +
    `<rect x="-42" y="8" width="84" height="59" rx="28" fill="#b4ebeb" stroke="#168da5" stroke-width="2"/>` +
    line('M -85 0 H -51 M 51 0 H85 M 0 -107 V -75 M 0 75 V107') +
    `<text y="-85" x="8" font-size="12" fill="${INK}">N₂</text>`,
  nitrogen: () =>
    `<rect x="-52" y="-76" width="104" height="152" rx="5" fill="#fff" stroke="${INK}" stroke-width="2.2"/>` +
    `<path d="M -52 -8 H52 M -43 17 H43 M -43 30 H43" stroke="#8db8d4" stroke-width="2"/>` +
    line('M -85 0 H -52 M 52 0 H85 M 0 76 V107 M 0 -107 V-76 M -18 -103 H18 M -18 -98 V-108 M 18 -98 V-108') +
    `<text y="-84" x="29" font-size="11" fill="${INK}">N₂</text>`
};

function instrumentArtwork(n) {
  const stubs = n.orientation === 'vertical' ? 'M 0 -45 V -32 M 0 32 V 45' : `M ${-n.w / 2} 0 H -32 M 32 0 H ${n.w / 2}`;
  return line(stubs, 2) + `<circle r="32" fill="#fff" stroke="${INK}" stroke-width="2.2"/>`;
}

function symbolMarkup(n) {
  if (n.kind === 'seal') {
    const image = sealImage(n);
    if (image) return artworkImage(n, image);
    return `<svg x="${-n.w / 2}" y="${-n.h / 2}" width="${n.w}" height="${n.h}" viewBox="9.5 38.5 195.8 214.6" xmlns="${NS}">${DEFAULT_SEAL_MARKUP}</svg>`;
  }
  if (n.artworkSource === 'media' && specs[n.kind]?.svg) return artworkImage(n, specs[n.kind].svg);
  if (isInstrument(n.kind)) return instrumentArtwork(n);
  return (BUILT_IN_ARTWORK[n.kind] || BUILT_IN_ARTWORK.nitrogen)(n);
}

// Small palette icons for symbols whose full artwork is too detailed at thumbnail size.
const PALETTE_GLYPHS = {
  cooler: '<rect x="8" y="7" width="24" height="26" rx="1"/><path d="M 2 20 H 8 M 32 20 H 38 M 15 2 V 7 M 25 33 V 38 M 12 12 H 26 L 14 18 L 26 24 L 14 29"/>',
  accumulator: '<rect x="11" y="3" width="18" height="29" rx="9"/><path d="M 11 18 Q 20 12 29 18 M 20 32 V 38"/>',
  heater: '<rect x="8" y="7" width="24" height="26" rx="1"/><path d="M 20 2 V 7 M 20 33 V 38 M 12 24 L 16 15 L 20 24 L 24 15 L 28 24"/>',
  reservoir: '<rect x="8" y="9" width="24" height="25" rx="2"/><path d="M 8 22 H 32 M 2 28 H 8 M 32 28 H 38 M 13 3 V 9 M 20 3 V 9 M 27 3 V 9"/>',
  'control-valve': '<path d="M 2 27 H 9 M 31 27 H 38 M 9 19 L 20 27 L 9 35 Z M 31 19 L 20 27 L 31 35 Z M 20 27 V 15 M 12 15 V 12 Q 12 5 20 5 Q 28 5 28 12 V 15 Z M 20 2 V 5"/>',
  'circulating-pump': '<circle cx="20" cy="20" r="13"/><path d="M 2 20 H 7 M 33 20 H 38 M 14 10 L 29 20 L 14 30 Z"/>',
  'air-driven-pump': '<circle cx="20" cy="24" r="12"/><path d="M 2 24 H 8 M 32 24 H 38 M 15 17 L 27 24 L 15 31 Z M 20 12 V 9 M 20 2 V 4"/><rect x="13" y="4" width="14" height="5" rx="2"/>',
  'isolation-valve': '<path d="M 2 24 H 9 M 31 24 H 38 M 9 16 L 20 24 L 9 32 Z M 31 16 L 20 24 L 31 32 Z M 20 16 V 8 M 13 8 H 27"/>',
  'check-valve': '<path d="M 2 20 H 9 M 31 20 H 38 M 31 11 V 29 M 9 12 L 30 20 L 9 28 Z"/>',
  drain: '<path d="M 20 2 V 23 M 10 23 H 30 M 20 23 V 37 M 15 32 L 20 37 L 25 32"/>',
  vent: '<path d="M 20 38 V 17 M 10 17 H 30 M 20 17 V 3 M 15 8 L 20 3 L 25 8"/>',
  junction: '<path d="M 4 20 H 36 M 20 4 V 36"/><circle cx="20" cy="20" r="3.5" fill="currentColor"/>',
  bladder: '<rect x="10" y="5" width="20" height="30" rx="5"/><rect x="13" y="20" width="14" height="12" rx="6"/><path d="M 10 18 Q 20 13 30 18"/>',
  nitrogen: '<rect x="10" y="8" width="20" height="27" rx="2"/><path d="M 10 18 H 30 M 20 2 V 8 M 15 3 H 25"/>',
  seal: '<rect x="5" y="15" width="30" height="10" rx="1"/><path d="M 10 15 V 8 H 30 V 15 M 10 25 V 32 H 30 V 25 M 16 8 V 3 M 24 8 V 3"/>'
};
function paletteGlyph(kind) {
  const spec = specs[kind];
  if (PALETTE_GLYPHS[kind]) return `<svg viewBox="0 0 40 40" xmlns="${NS}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PALETTE_GLYPHS[kind]}</svg>`;
  if (spec.svg) return `<img src="${spec.svg}" alt="">`;
  return `<span class="bubble${kind.length > 2 ? ' long' : ''}">${escapeHtml(kind)}</span>`;
}
