// Canvas rendering. The pipe and overlay layers are redrawn on every change; symbol elements
// are kept between renders so embedded artwork is not decoded again while dragging.

const layers = {};
const nodeElements = new Map();

function buildCanvas() {
  svg.innerHTML =
    `<defs><pattern id="grid" width="${GRID_SIZE}" height="${GRID_SIZE}" patternUnits="userSpaceOnUse"><path d="M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}" fill="none" stroke="#e6edf2" stroke-width="1"/></pattern></defs>` +
    '<rect x="-20000" y="-20000" width="40000" height="40000" fill="#fff"/>' +
    '<rect class="editor-only" x="-20000" y="-20000" width="40000" height="40000" fill="url(#grid)"/>';
  layers.sheet = mk('g', {id: 'sheetFrame', 'pointer-events': 'none'}, svg);
  layers.pipes = mk('g', {id: 'pipes'}, svg);
  layers.nodes = mk('g', {id: 'nodes'}, svg);
  layers.overlay = mk('g', {id: 'overlay', class: 'editor-only'}, svg);
  nodeElements.clear();
}

function setStatus(text) { $('status').textContent = text; }
function statusText() {
  if (mode === 'addPort') return 'Click a symbol where the port belongs · Esc to cancel';
  if (pending) return 'Click another port, symbol, or pipe to connect · Esc to cancel';
  if (mode === 'pipe') return 'Pipe tool: click a symbol, port, or pipe to start · Esc to finish';
  if (selected?.type === 'nodes') return `${selected.ids.length} symbols selected`;
  return 'Ready';
}

// Redraws the sheet only. Used while dragging and typing, so the properties panel keeps its focus.
function renderCanvas() {
  svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
  svg.setAttribute('class', `mode-${mode}${pending ? ' connecting' : ''}`);
  renderPipes();
  renderNodes();
  renderSheet();
  renderOverlay();
  $('sheetTitle').textContent = $('templateBarName').textContent = state.title;
}
function render() {
  renderCanvas();
  $('count').textContent = `${state.nodes.length} symbols · ${state.pipes.length} pipes`;
  $('zoomReset').textContent = `${Math.round(HOME_VIEW.w / view.w * 100)}%`;
  $('emptyHint').hidden = state.nodes.length > 0;
  $('templateBar').hidden = !state.templateId;
  document.body.classList.toggle('editing-template', !!state.templateId);
  setStatus(statusText());
  for (const [id, toolMode] of [['toolSelect', 'select'], ['toolPipe', 'pipe'], ['addSealPort', 'addPort']]) {
    $(id).classList.toggle('active', mode === toolMode);
    $(id).setAttribute('aria-pressed', String(mode === toolMode));
  }
  renderProperties();
}
const renderCanvasOnly = renderCanvas;

function renderPipes() {
  const layer = layers.pipes;
  layer.replaceChildren();
  for (const p of state.pipes) {
    const r = pipeRoute(p);
    if (!r) continue;
    const g = r.g, isSelected = selected?.type === 'pipe' && selected.id === p.id, color = pipeColor(p);
    const shown = g.display || g.path;
    if (isSelected) mk('path', {d: shown, class: 'wire-halo editor-only'}, layer);
    mk('path', {
      d: shown, class: `wire${isSelected ? ' selected' : ''}`, fill: 'none', stroke: color, 'stroke-width': 2.6,
      'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'vector-effect': 'non-scaling-stroke',
      ...(p.service === 'instrument-air' ? {'stroke-dasharray': '9 6'} : {})
    }, layer);
    const arrow = pipeArrow(g, p.direction);
    if (arrow) mk('path', {d: arrow, class: 'flow-arrow', fill: color, 'pointer-events': 'none'}, layer);
    mk('path', {d: g.path, class: 'wire hit editor-only', 'data-pipe': p.id}, layer);
    const label = String(p.lineNumber || '').trim(), labelPoint = label && lineLabelPoint(g.points);
    if (labelPoint) {
      mk('text', {
        x: labelPoint.x, y: labelPoint.y, class: 'line-label', 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700,
        'font-family': 'Arial,sans-serif', fill: DEFAULT_PIPE_COLOR, stroke: '#fff', 'stroke-width': 4, 'paint-order': 'stroke', 'pointer-events': 'none'
      }, layer).textContent = label;
    }
    if (isSelected) renderPipeHandles(p, r, layer);
  }
}

function renderPipeHandles(p, {a, b, g}, layer) {
  const handle = (at, attrs) => mk('circle', {cx: at.x, cy: at.y, r: 7}, mk('g', {...attrs, class: `bend-handle editor-only ${attrs.class || ''}`}, layer));
  if (g.elbow) {
    if (a.x !== b.x && a.y !== b.y) handle(g.corner, {class: 'elbow-handle', 'data-elbow': p.id});
  } else if (g.waypoints) {
    p.route.waypoints.forEach((corner, index) => handle(corner, {class: 'waypoint-handle', 'data-waypoint': index, 'data-pipe-id': p.id}));
  } else if (g.axis) {
    mk('path', {d: `M ${g.c1.x} ${g.c1.y} L ${g.c2.x} ${g.c2.y}`, class: 'bend-hit editor-only', 'data-route': p.id}, layer);
    for (const corner of [g.c1, g.c2]) handle(corner, {'data-route': p.id});
  } else {
    // An automatic route with another shape: dragging a corner turns its bends into waypoints.
    g.points.slice(1, -1).forEach((corner, index) => handle(corner, {class: 'waypoint-handle', 'data-auto-corner': index, 'data-pipe-id': p.id}));
  }
}

function captionMarkup(n) {
  const bounds = nodeBounds(n), scale = nodeScale(n), instrument = isInstrument(n.kind);
  // Instruments inserted into a vertical line carry their caption beside the bubble.
  const beside = instrument && ((n.orientation === 'vertical') !== ((n.rotation || 0) % 180 !== 0));
  // A numbered instrument shows its type above its loop number, as in PI over 101.
  const number = instrument ? String(n.number ?? '').trim() : '';
  const letters = (y, size, text, cls) => `<text class="${cls}" y="${y * scale}" text-anchor="middle" font-size="${size * scale}" font-family="Arial,sans-serif" fill="${INK}" font-weight="600" pointer-events="none">${escapeHtml(text)}</text>`;
  const long = n.kind.length > 2;
  const bubble = !instrument ? ''
    : number ? letters(-3, long ? 15 : 19, n.kind, 'tag-type') + letters(17, number.length > 4 ? 12 : 15, number, 'tag-number')
    : letters(7, long ? 17 : 22, n.kind, 'tag-type');
  // A caption that only repeats the bubble letters adds nothing.
  const caption = instrument && String(n.tag).trim() === n.kind ? '' : n.tag;
  return bubble + `<text class="caption" x="${beside ? bounds.w / 2 + 14 : 0}" y="${beside ? 5 : bounds.h / 2 + 27}" text-anchor="${beside ? 'start' : 'middle'}" font-size="14" font-family="Arial,sans-serif" font-weight="600" fill="#345166" pointer-events="none">${escapeHtml(caption)}</text>`;
}

// The drawing frame and title block. They follow the export area, so the sheet on screen is
// the sheet that is exported.
const TITLE_BLOCK = {w: 470, h: 92, inset: 12};
function sheetBox() {
  const s = exportSize(), i = TITLE_BLOCK.inset;
  return {l: s.x + i, t: s.y + i, r: s.x + s.w - i, b: s.y + s.h - i};
}
function renderSheet() {
  const layer = layers.sheet, info = sheetInfo();
  layer.replaceChildren();
  if (!info.frame) return;
  const f = sheetBox(), x = f.r - TITLE_BLOCK.w, y = f.b - TITLE_BLOCK.h, split = 44;
  const stroke = {fill: 'none', stroke: INK, 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke'};
  mk('rect', {class: 'sheet-frame', x: f.l, y: f.t, width: f.r - f.l, height: f.b - f.t, ...stroke}, layer);
  const block = mk('g', {class: 'title-block', 'font-family': 'Arial,sans-serif'}, layer);
  mk('rect', {x, y, width: TITLE_BLOCK.w, height: TITLE_BLOCK.h, ...stroke, fill: '#fff'}, block);
  const cell = (label, value, cx, cy, width, size, name) => {
    mk('text', {x: cx + 8, y: cy + 13, 'font-size': 8, 'font-weight': 700, 'letter-spacing': .6, fill: '#6b7f90'}, block).textContent = label;
    // Text that would run over the cell border is cut short.
    const fit = Math.max(1, Math.floor((width - 16) / (size * .58))), text = String(value ?? '').trim();
    mk('text', {x: cx + 8, y: cy + 17 + size, 'font-size': size, 'font-weight': 600, fill: INK, 'data-sheet': name}, block).textContent =
      text.length > fit ? text.slice(0, fit - 1) + '…' : text;
  };
  cell('TITLE', state.title, x, y, TITLE_BLOCK.w, 17, 'title');
  mk('path', {d: `M ${x} ${y + split} H ${f.r}`, ...stroke, 'stroke-width': 1.2}, block);
  let cx = x;
  for (const [label, name, width] of [['DRAWING NO.', 'number', 160], ['REV', 'revision', 60], ['DATE', 'date', 110], ['DRAWN BY', 'author', 140]]) {
    if (cx > x) mk('path', {d: `M ${cx} ${y + split} V ${f.b}`, ...stroke, 'stroke-width': 1.2}, block);
    cell(label, info[name], cx, y + split, width, 13, name);
    cx += width;
  }
}

function renderNodes() {
  const layer = layers.nodes, live = new Set();
  state.nodes.forEach((n, index) => {
    live.add(n.id);
    let el = nodeElements.get(n.id);
    if (!el) {
      el = mk('g', {'data-node': n.id});
      el.innerHTML = '<rect class="select-outline editor-only" rx="5"/><rect class="node-hit editor-only"/><g class="symbol-artwork"></g><g class="labels"></g><g class="ports editor-only"></g>';
      nodeElements.set(n.id, el);
    }
    if (layer.children[index] !== el) layer.insertBefore(el, layer.children[index] || null);
    const [outline, hit, artwork, labels, ports] = el.children, bounds = nodeBounds(n);
    el.setAttribute('class', `node${isNodeSelected(n.id) ? ' selected' : ''}`);
    el.setAttribute('transform', `translate(${n.x} ${n.y})`);
    for (const [k, v] of [['x', -bounds.w / 2 - 8], ['y', -bounds.h / 2 - 8], ['width', bounds.w + 16], ['height', bounds.h + 16]]) outline.setAttribute(k, v);
    // Line-art symbols are mostly empty space; the hit area makes the whole symbol clickable.
    for (const [k, v] of [['x', -bounds.w / 2], ['y', -bounds.h / 2], ['width', bounds.w], ['height', bounds.h]]) hit.setAttribute(k, v);
    artwork.setAttribute('transform', nodeTransform(n));
    // Rebuild artwork only when what it shows changes.
    const image = n.kind === 'seal' ? sealImage(n) : null;
    const connected = new Set(connectedPorts(n));
    const key = [n.kind, n.sealVariant, n.w, n.h, n.orientation, n.artworkSource, n.kind === 'junction' ? [...connected] : ''].join('|');
    if (el.artworkKey !== key || el.artworkImage !== image) {
      artwork.innerHTML = symbolMarkup(n);
      el.artworkKey = key; el.artworkImage = image;
    }
    labels.innerHTML = captionMarkup(n);
    ports.replaceChildren();
    for (const p of n.ports) {
      const q = transformPoint(n, p), isPending = pending?.node === n.id && pending.port === p.id;
      const port = mk('g', {
        class: `port editor-only${connected.has(p.id) ? ' connected' : ''}${isPending ? ' pending' : ''}`,
        transform: `translate(${q.x} ${q.y})`, 'data-node': n.id, 'data-port': p.id
      }, ports);
      mk('circle', {class: 'port-hit', r: 11}, port);
      mk('circle', {class: 'port-dot', r: 5}, port);
    }
  });
  for (const [id, el] of nodeElements) if (!live.has(id)) { el.remove(); nodeElements.delete(id); }
}

function renderOverlay() {
  const layer = layers.overlay;
  layer.replaceChildren();
  if (pending && drag?.type === 'connect') {
    const a = portPos(pending), node = byId(pending.node);
    if (a) mk('path', {id: 'preview', d: pipeGeometry(a, drag.cursor, null, {da: portFacing(pending), boxA: nodeBox(node)}).path, class: 'wire preview', 'pointer-events': 'none'}, layer);
  }
  for (const guide of drag?.guides || []) {
    mk('line', {class: `align-guide ${guide.type}`, x1: guide.x1, y1: guide.y1, x2: guide.x2, y2: guide.y2, 'pointer-events': 'none'}, layer);
  }
  if (drag?.type === 'marquee') {
    const {start, cursor} = drag;
    mk('rect', {class: 'marquee', x: Math.min(start.x, cursor.x), y: Math.min(start.y, cursor.y), width: Math.abs(cursor.x - start.x), height: Math.abs(cursor.y - start.y)}, layer);
  }
  showInsertionPreview(insertionPreview);
}

function showInsertionPreview(target) {
  insertionPreview = target;
  svg.querySelector('#insertionPreview')?.remove();
  if (!target) return;
  const half = target.size / 2, group = mk('g', {id: 'insertionPreview', class: 'editor-only', 'pointer-events': 'none'}, layers.overlay);
  mk('path', {d: target.vertical ? `M ${target.x} ${target.y - half} V ${target.y + half}` : `M ${target.x - half} ${target.y} H ${target.x + half}`, stroke: '#099aa4', 'stroke-width': 8, opacity: .45}, group);
  mk('circle', {cx: target.x, cy: target.y, r: 32, fill: '#e1f9f8', 'fill-opacity': .6, stroke: '#099aa4', 'stroke-width': 2, 'stroke-dasharray': '5 4'}, group);
  mk('text', {x: target.x + 42, y: target.y - 42, fill: '#087982', 'font-size': 15, 'font-weight': 650}, group).textContent =
    target.kind === 'junction' ? 'Insert junction' : specs[target.kind]?.inline ? 'Insert valve' : 'Insert instrument';
}
