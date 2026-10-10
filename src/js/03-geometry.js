// Coordinate transforms, symbol bounds, and port positions.

// Pointer position in drawing coordinates.
function point(e) {
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse());
  return {x: p.x, y: p.y};
}
const screenScale = () => { const m = svg.getScreenCTM(); return Math.hypot(m.a, m.b); };

const nodeScale = n => Number.isFinite(n.scale) && n.scale > 0 ? n.scale : 1;
// Mirroring is stored in the symbol's own axes, so a quarter turn swaps which flag a screen axis maps to.
const mirrorKey = (n, axis) => (n.rotation || 0) % 180 === 90 ? (axis === 'x' ? 'mirrorY' : 'mirrorX') : (axis === 'x' ? 'mirrorX' : 'mirrorY');
const nodeTransform = n => `rotate(${n.rotation || 0}) scale(${nodeScale(n) * (n.mirrorX ? -1 : 1)} ${nodeScale(n) * (n.mirrorY ? -1 : 1)})`;

// Maps a point from symbol-local to canvas-relative coordinates, or back with inverse.
function transformPoint(n, p, inverse = false) {
  const angle = (n.rotation || 0) * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
  const scale = nodeScale(n), sx = n.mirrorX ? -1 : 1, sy = n.mirrorY ? -1 : 1;
  if (inverse) return {x: (c * p.x + s * p.y) / scale * sx, y: (-s * p.x + c * p.y) / scale * sy};
  const x = p.x * scale * sx, y = p.y * scale * sy;
  return {x: c * x - s * y, y: s * x + c * y};
}

// Visible size after rotation and scaling.
function nodeBounds(n) {
  const angle = (n.rotation || 0) * Math.PI / 180, c = Math.abs(Math.cos(angle)), s = Math.abs(Math.sin(angle)), scale = nodeScale(n);
  return {w: (n.w * c + n.h * s) * scale, h: (n.w * s + n.h * c) * scale};
}
function nodeBox(n, pad = 0) {
  const b = nodeBounds(n);
  return {l: n.x - b.w / 2 - pad, r: n.x + b.w / 2 + pad, t: n.y - b.h / 2 - pad, b: n.y + b.h / 2 + pad};
}

const findPort = ref => byId(ref.node)?.ports.find(p => p.id === ref.port);
function portPos(ref) {
  const n = byId(ref.node), p = findPort(ref);
  if (!n || !p) return null;
  const q = transformPoint(n, p);
  return {x: n.x + q.x, y: n.y + q.y};
}
// The side of its symbol a port sits on: 'L', 'R', 'T', or 'B'. Pipes leave in that direction.
function portFacing(ref) {
  const n = byId(ref.node), p = findPort(ref);
  if (!n || !p) return null;
  const q = transformPoint(n, p), b = nodeBounds(n);
  const dx = q.x / (b.w / 2 || 1), dy = q.y / (b.h / 2 || 1);
  if (Math.abs(dx) < .05 && Math.abs(dy) < .05) return null;
  return Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'R' : 'L') : (dy > 0 ? 'B' : 'T');
}

// Bounds of everything drawn, or null for an empty drawing.
function contentBox() {
  let box = null;
  const grow = (x, y) => {
    if (!box) box = {l: x, r: x, t: y, b: y};
    box.l = Math.min(box.l, x); box.r = Math.max(box.r, x); box.t = Math.min(box.t, y); box.b = Math.max(box.b, y);
  };
  for (const n of state.nodes) { const b = nodeBox(n); grow(b.l, b.t); grow(b.r, b.b); }
  for (const p of state.pipes) for (const q of pipeRoute(p)?.points || []) grow(q.x, q.y);
  return box;
}
