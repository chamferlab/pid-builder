// Symbol artwork. Each function returns SVG markup centered on the symbol origin.

const sealImage = n => n.sealSvg || (n.sealVariant ? specs[n.sealVariant]?.svg : state.sealSvg) || specs[DEFAULT_SEAL].svg;
const artworkImage = (n, href) => `<image href="${escapeHtml(href)}" x="${-n.w / 2}" y="${-n.h / 2}" width="${n.w}" height="${n.h}" preserveAspectRatio="xMidYMid meet"/>`;
const line = (d, width = 2.2, extra = '') => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`;

const BUILT_IN_ARTWORK = {
  // A junction in use shows only the arms that carry a pipe, so a tee is drawn as a tee.
  junction: n => {
    const arms = {L: 'M 0 0 H -22', R: 'M 0 0 H 22', T: 'M 0 0 V -22', B: 'M 0 0 V 22'}, used = connectedPorts(n).filter(id => arms[id]);
    return line((used.length ? used : Object.keys(arms)).map(id => arms[id]).join(' ')) + `<circle r="4" fill="${INK}"/>`;
  },
  'isolation-valve': () =>
    line('M -48 0 H -23 M 23 0 H 48 M 0 -18 V -31 M -15 -31 H 15') +
    `<path d="M -23 -17 L 0 0 L -23 17 Z M 23 -17 L 0 0 L 23 17 Z" fill="#fff" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>`,
  'check-valve': () =>
    line('M -48 0 H -22 M 23 0 H 48 M 22 -20 V 20') +
    `<path d="M -22 -18 L 20 0 L -22 18 Z" fill="#fff" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>`,
  drain: () => line('M 0 -45 V 16 M -18 16 H 18 M 0 16 V 38 M -9 29 L 0 38 L 9 29'),
  vent: () => line('M 0 45 V -16 M -18 -16 H 18 M 0 -16 V -38 M -9 -29 L 0 -38 L 9 -29'),
  // The cooler from before equipment moved to media/; drawings saved then still use it.
  cooler: () =>
    `<rect x="-75" y="-58" width="150" height="116" fill="#fff" stroke="${INK}" stroke-width="2.2"/>` +
    line('M -95 0 H -75 M 75 0 H 95 M 0 -75 V -58 M 0 58 V 75') +
    `<path d="M -65 -30 h19 q16 0 16 13 t-16 13 h-14 q-10 0 -10 12 t10 12 h20 q12 0 12 13 t-12 13 M 65 -30 H46 Q30 -30 30 -17 T46 -4 h14 q10 0 10 12 T60 20 H40 Q28 20 28 33 T40 46" fill="none" stroke="#168da5" stroke-width="3"/>` +
    line('M -75 -38 H75 M -75 38 H75', 1, ' stroke-dasharray="5 5"')
};

function instrumentArtwork(n) {
  const stubs = n.orientation === 'vertical' ? 'M 0 -45 V -32 M 0 32 V 45' : `M ${-n.w / 2} 0 H -32 M 32 0 H ${n.w / 2}`;
  return line(stubs, 2) + `<circle r="32" fill="#fff" stroke="${INK}" stroke-width="2.2"/>`;
}

function symbolMarkup(n) {
  if (n.kind === 'seal') return artworkImage(n, sealImage(n));
  const legacy = n.artworkSource !== 'media' && BUILT_IN_ARTWORK[n.kind];
  if (specs[n.kind]?.svg && !legacy) return artworkImage(n, specs[n.kind].svg);
  if (isInstrument(n.kind)) return instrumentArtwork(n);
  if (BUILT_IN_ARTWORK[n.kind]) return BUILT_IN_ARTWORK[n.kind](n);
  return `<rect x="${-n.w / 2}" y="${-n.h / 2}" width="${n.w}" height="${n.h}" fill="#fff" stroke="${INK}" stroke-width="2.2"/>`;
}

// Small palette icons for symbols whose full artwork is too detailed at thumbnail size.
const PALETTE_GLYPHS = {
  cooler: '<rect x="9" y="7" width="22" height="26" rx="3"/><path d="M 2 27 H 9 M 31 13 H 38 M 20 2 V 10 L 26 13 L 14 17 L 26 21 L 14 25 L 20 29 V 38"/>',
  'cooler-dual': '<rect x="5" y="7" width="30" height="26" rx="3"/><path d="M 1 27 H 5 M 35 13 H 39 M 13 2 V 10 L 17 13 L 9 17 L 17 21 L 9 25 L 13 29 V 38 M 27 2 V 10 L 31 13 L 23 17 L 31 21 L 23 25 L 27 29 V 38"/>',
  accumulator: '<rect x="11" y="3" width="18" height="29" rx="9"/><path d="M 11 18 Q 20 12 29 18 M 20 32 V 38"/>',
  heater: '<rect x="8" y="7" width="24" height="26" rx="1"/><path d="M 20 2 V 7 M 20 33 V 38 M 12 24 L 16 15 L 20 24 L 24 15 L 28 24"/>',
  reservoir: '<rect x="11" y="7" width="18" height="26" rx="5"/><path d="M 11 19 H 29 M 3 20 H 11 M 29 20 H 37 M 20 2 V 7 M 20 33 V 38"/>',
  'control-valve': '<path d="M 2 27 H 9 M 31 27 H 38 M 9 19 L 20 27 L 9 35 Z M 31 19 L 20 27 L 31 35 Z M 20 27 V 15 M 12 15 V 12 Q 12 5 20 5 Q 28 5 28 12 V 15 Z M 20 2 V 5"/>',
  'circulating-pump': '<circle cx="20" cy="20" r="13"/><path d="M 2 20 H 7 M 33 20 H 38 M 14 10 L 29 20 L 14 30 Z"/>',
  'air-driven-pump': '<circle cx="20" cy="24" r="12"/><path d="M 2 24 H 8 M 32 24 H 38 M 15 17 L 27 24 L 15 31 Z M 20 12 V 9 M 20 2 V 4"/><rect x="13" y="4" width="14" height="5" rx="2"/>',
  'isolation-valve': '<path d="M 2 24 H 9 M 31 24 H 38 M 9 16 L 20 24 L 9 32 Z M 31 16 L 20 24 L 31 32 Z M 20 16 V 8 M 13 8 H 27"/>',
  'check-valve': '<path d="M 2 20 H 9 M 31 20 H 38 M 31 11 V 29 M 9 12 L 30 20 L 9 28 Z"/>',
  drain: '<path d="M 20 2 V 23 M 10 23 H 30 M 20 23 V 37 M 15 32 L 20 37 L 25 32"/>',
  vent: '<path d="M 20 38 V 17 M 10 17 H 30 M 20 17 V 3 M 15 8 L 20 3 L 25 8"/>',
  junction: '<path d="M 4 20 H 36 M 20 4 V 36"/><circle cx="20" cy="20" r="3.5" fill="currentColor"/>',
  nitrogen: '<rect x="10" y="8" width="20" height="27" rx="2"/><path d="M 10 18 H 30 M 20 2 V 8 M 15 3 H 25"/>'
};
function paletteGlyph(kind) {
  const spec = specs[kind];
  if (PALETTE_GLYPHS[kind]) return `<svg viewBox="0 0 40 40" xmlns="${NS}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PALETTE_GLYPHS[kind]}</svg>`;
  if (spec.svg) return `<img src="${spec.svg}" alt="">`;
  return `<span class="bubble${kind.length > 2 ? ' long' : ''}">${escapeHtml(kind)}</span>`;
}
