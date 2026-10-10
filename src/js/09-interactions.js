// Pointer, keyboard, and view controls.

const DRAG_THRESHOLD = 5; // pixels a pointer must travel before a press on a port counts as a drag

function beginGroupDrag(n, p) {
  const ids = new Set(selectedNodeIds());
  return {
    type: 'nodes', anchor: n.id, dx: p.x - n.x, dy: p.y - n.y,
    start: selectedNodes().map(item => ({id: item.id, x: item.x, y: item.y})),
    routes: state.pipes.filter(pipe => ids.has(pipe.a.node) && ids.has(pipe.b.node)).map(pipe => ({id: pipe.id, route: structuredClone(pipe.route)}))
  };
}

function pressPipeHandle(e) {
  const elbow = e.target.closest('[data-elbow]');
  if (elbow) {
    const p = pipeById(elbow.dataset.elbow);
    if (p) { p.route = {elbow: p.route.elbow === 'horizontal' ? 'vertical' : 'horizontal'}; render(); persist(); }
    return true;
  }
  const autoCorner = e.target.closest('[data-auto-corner]');
  if (autoCorner) {
    const p = pipeById(autoCorner.dataset.pipeId);
    if (p) {
      routeToWaypoints(p);
      selected = {type: 'pipe', id: p.id};
      drag = {type: 'waypoint', id: p.id, index: Number(autoCorner.dataset.autoCorner)};
      render();
    }
    return true;
  }
  const waypoint = e.target.closest('[data-waypoint]');
  if (waypoint) {
    const p = pipeById(waypoint.dataset.pipeId), index = Number(waypoint.dataset.waypoint);
    if (p && Array.isArray(p.route?.waypoints)) {
      selected = {type: 'pipe', id: p.id};
      if (e.altKey) { p.route.waypoints.splice(index, 1); render(); persist(); }
      else { drag = {type: 'waypoint', id: p.id, index}; render(); }
    }
    return true;
  }
  const handle = e.target.closest('[data-route]');
  if (handle) {
    const p = pipeById(handle.dataset.route), r = p && pipeRoute(p);
    if (r) { selected = {type: 'pipe', id: p.id}; drag = {type: 'route', id: p.id, axis: r.g.axis}; render(); }
    return true;
  }
  return false;
}

svg.addEventListener('pointerdown', e => {
  if (e.button === 1) { drag = {type: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y}; e.preventDefault(); return; }
  const nodeEl = e.target.closest('.node');
  if (e.shiftKey && nodeEl && mode === 'select' && !pending) { toggleNodeSelection(nodeEl.dataset.node); return; }

  const port = e.target.closest('.port');
  if (port) {
    if (mode !== 'addPort' || e.altKey) beginPipe(port.dataset.node, port.dataset.port, e);
    return;
  }
  if (pressPipeHandle(e)) return;
  const wire = e.target.closest('[data-pipe]');
  if (wire) {
    if (mode === 'pipe' || pending) pipeFromPipe(wire.dataset.pipe, e);
    else { selected = {type: 'pipe', id: wire.dataset.pipe}; render(); }
    return;
  }

  if (nodeEl) {
    const n = byId(nodeEl.dataset.node), p = point(e);
    if (mode === 'addPort') {
      if (portEditable(n)) { addPortAt(n, p); selected = {type: 'node', id: n.id}; mode = 'select'; render(); persist(); }
      return;
    }
    if (mode === 'pipe' || (pending && pending.node !== n.id)) { pipeFromSymbol(n, e); return; }
    if (selected?.type === 'nodes' && isNodeSelected(n.id)) drag = beginGroupDrag(n, p);
    else { selected = {type: 'node', id: n.id}; drag = {type: 'node', id: n.id, dx: p.x - n.x, dy: p.y - n.y, detach: e.altKey}; }
    render();
    return;
  }
  if (mode === 'addPort') return;

  // Blank sheet: Shift-drag selects an area, a plain drag pans.
  pending = null;
  if (e.shiftKey && mode === 'select') { const p = point(e); drag = {type: 'marquee', start: p, cursor: p, keep: selectedNodeIds()}; }
  else { selected = null; drag = {type: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y}; }
  render();
});

window.addEventListener('pointermove', e => {
  if (!drag) return;
  if (drag.type === 'node') {
    const n = byId(drag.id);
    if (!n) return;
    const p = point(e), raw = {x: p.x - drag.dx, y: p.y - drag.dy};
    // Alt-drag pulls an inline symbol out of its line.
    if (drag.detach) { drag.detach = false; drag.detached = detachFromLine(n); }
    insertionPreview = insertionTarget(n.kind, raw, n.id);
    n.x = insertionPreview ? insertionPreview.x : snapCoordinate(raw.x, e.altKey);
    n.y = insertionPreview ? insertionPreview.y : snapCoordinate(raw.y, e.altKey);
  } else if (drag.type === 'nodes') {
    const anchor = drag.start.find(item => item.id === drag.anchor), p = point(e);
    if (!anchor) return;
    const dx = snapCoordinate(p.x - drag.dx, e.altKey) - anchor.x, dy = snapCoordinate(p.y - drag.dy, e.altKey) - anchor.y;
    for (const start of drag.start) { const n = byId(start.id); if (n) { n.x = start.x + dx; n.y = start.y + dy; } }
    for (const start of drag.routes) { const pipe = pipeById(start.id); if (pipe) pipe.route = shiftedRoute(start.route, dx, dy); }
  } else if (drag.type === 'route') {
    const pipe = pipeById(drag.id);
    if (!pipe) return;
    const q = point(e);
    pipe.route = {axis: drag.axis, value: Math.round(drag.axis === 'x' ? q.x : q.y)};
  } else if (drag.type === 'waypoint') {
    const pipe = pipeById(drag.id);
    if (!pipe?.route?.waypoints?.[drag.index]) return;
    const q = point(e);
    pipe.route.waypoints[drag.index] = {x: Math.round(q.x), y: Math.round(q.y)};
  } else if (drag.type === 'pan') {
    const rect = svg.getBoundingClientRect();
    view.x = drag.vx - (e.clientX - drag.sx) * view.w / rect.width;
    view.y = drag.vy - (e.clientY - drag.sy) * view.h / rect.height;
  } else if (drag.type === 'connect') {
    drag.cursor = point(e);
    aimPendingBranch(drag.cursor);
    if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > DRAG_THRESHOLD) drag.moved = true;
  } else if (drag.type === 'marquee') {
    drag.cursor = point(e);
    const l = Math.min(drag.start.x, drag.cursor.x), r = Math.max(drag.start.x, drag.cursor.x), t = Math.min(drag.start.y, drag.cursor.y), b = Math.max(drag.start.y, drag.cursor.y);
    const inside = state.nodes.filter(n => { const box = nodeBox(n); return box.l < r && box.r > l && box.t < b && box.b > t; }).map(n => n.id);
    const ids = [...new Set([...drag.keep, ...inside])];
    selected = ids.length > 1 ? {type: 'nodes', ids} : ids.length ? {type: 'node', id: ids[0]} : null;
  }
  renderCanvas();
});

window.addEventListener('pointerup', e => {
  if (!drag) return;
  if (drag.type === 'connect') {
    // Pressing a port and releasing over another port, symbol, or pipe connects them in one gesture.
    // A plain click leaves the connection pending for a second click.
    if (!drag.moved || !pending) return;
    const under = document.elementFromPoint(e.clientX, e.clientY), port = under?.closest?.('.port'), nodeEl = under?.closest?.('.node'), wire = under?.closest?.('[data-pipe]');
    if (port && port.dataset.node !== pending.node) connectPending({node: port.dataset.node, port: port.dataset.port});
    else if (nodeEl && nodeEl.dataset.node !== pending.node && !port) pipeFromSymbol(byId(nodeEl.dataset.node), e);
    else if (wire) pipeFromPipe(wire.dataset.pipe, e);
    else drag.moved = false;
    return;
  }
  const finished = drag;
  drag = null;
  if (finished.type === 'node') {
    const n = byId(finished.id);
    if (n && insertionPreview) insertInlineSymbol(n, insertionPreview);
    showInsertionPreview(null);
  }
  render();
  if (['node', 'nodes', 'route', 'waypoint'].includes(finished.type)) persist();
});

// ---- View ----

function zoom(factor, at = {x: view.x + view.w / 2, y: view.y + view.h / 2}) {
  const w = Math.max(320, Math.min(6000, view.w * factor)), h = w * HOME_VIEW.h / HOME_VIEW.w;
  view.x = at.x - (at.x - view.x) * w / view.w;
  view.y = at.y - (at.y - view.y) * h / view.h;
  view.w = w; view.h = h;
  render();
}
function zoomToFit() {
  // With a frame, the whole sheet is what is fitted.
  const framed = !!sheetInfo().frame, box = framed && state.nodes.length ? sheetBox() : contentBox();
  if (!box) { view = {...HOME_VIEW}; render(); return; }
  const aspect = HOME_VIEW.h / HOME_VIEW.w, margin = framed ? 20 : 80;
  const w = Math.max(320, Math.min(6000, Math.max(box.r - box.l + 2 * margin, (box.b - box.t + 2 * margin) / aspect)));
  view = {x: (box.l + box.r) / 2 - w / 2, y: (box.t + box.b) / 2 - w * aspect / 2, w, h: w * aspect};
  render();
}
svg.addEventListener('wheel', e => { e.preventDefault(); zoom(e.deltaY < 0 ? .88 : 1.12, point(e)); }, {passive: false});
$('zoomIn').onclick = () => zoom(.8);
$('zoomOut').onclick = () => zoom(1.25);
$('zoomReset').onclick = () => { view = {...HOME_VIEW}; render(); };
$('zoomFit').onclick = zoomToFit;

// ---- Tools ----

$('toolSelect').onclick = () => { if (mode !== 'select') setMode('select'); };
$('toolPipe').onclick = () => setMode('pipe');
$('addSealPort').onclick = () => setMode('addPort');
function updateSnapButton() {
  $('snapGrid').classList.toggle('active', snapEnabled);
  $('snapGrid').setAttribute('aria-pressed', String(snapEnabled));
}
$('snapGrid').onclick = () => {
  snapEnabled = !snapEnabled;
  try { localStorage.setItem(SNAP_STORAGE, String(snapEnabled)); } catch {}
  updateSnapButton();
};
updateSnapButton();

// ---- Keyboard ----

const ARROWS = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]};
window.addEventListener('keydown', e => {
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) || document.activeElement?.isContentEditable) return;
  const key = e.key.toLowerCase(), command = (e.ctrlKey || e.metaKey) && !e.altKey;
  if (command && (key === 'z' || key === 'y')) {
    e.preventDefault();
    restoreHistory(key === 'y' || e.shiftKey);
    return;
  }
  if (command && key === 'a') { e.preventDefault(); selectNodeIds(state.nodes.map(n => n.id)); return; }
  if (command && key === 'd') { e.preventDefault(); duplicateSelection(); return; }
  if (command) return;
  if (e.key === 'Escape') {
    pending = null; drag = null; mode = 'select';
    showInsertionPreview(null);
    if (selected?.type === 'nodes') selected = null;
    render();
    return;
  }
  if ((e.key === 'Delete' || e.key === 'Backspace') && selected) { e.preventDefault(); deleteSelected(); return; }
  if (ARROWS[e.key] && selectedNodeIds().length) {
    e.preventDefault();
    const step = e.shiftKey ? GRID_SIZE : 1, [dx, dy] = ARROWS[e.key];
    moveSelection(dx * step, dy * step, 'nudge:' + selectedNodeIds().join(','));
    return;
  }
  if (e.altKey) return;
  if (key === 'p') setMode('pipe');
  else if (key === 'v') { if (mode !== 'select') setMode('select'); }
  else if (key === 'f') zoomToFit();
  else if (key === 'r' && selected?.type === 'node') rotateNode(byId(selected.id), e.shiftKey ? 270 : 90);
});

// Consecutive keystrokes in one field form one edit, until focus or another action changes.
document.addEventListener('pointerdown', () => { historyGroup = null; }, true);
document.addEventListener('focusin', e => { if (historyGroup && historyGroup.split(':')[0] !== e.target.id) historyGroup = null; });
