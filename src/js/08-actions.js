// Edits to the drawing: symbols, ports, pipes, and inline insertion.

function setMode(next) {
  mode = mode === next ? 'select' : next;
  pending = null; drag = null;
  render();
}

function createNode(kind, x, y, commit = true, bypassSnap = false) {
  const spec = specs[kind];
  if (!spec) return;
  const variant = spec.group === 'seal' && kind !== 'seal';
  const n = {id: nextId(), kind: variant ? 'seal' : kind, x: snapCoordinate(x, bypassSnap), y: snapCoordinate(y, bypassSnap), w: spec.w, h: spec.h, tag: spec.tag ?? kind, notes: '', ports: []};
  if (variant) n.sealVariant = kind;
  if (isInstrument(kind)) n.number = nextTagNumber(kind);
  if (spec.svg) { n.artworkSource = 'media'; n.artworkVersion = spec.version; }
  state.nodes.push(n);
  selected = {type: 'node', id: n.id};
  pending = null; drag = null; mode = 'select';
  showInsertionPreview(null);
  render();
  if (commit) persist();
  return n;
}
// Places a symbol in the middle of the view, stepping aside if one is already there.
function createNodeAtCenter(kind, bypassSnap = false) {
  let x = view.x + view.w / 2, y = view.y + view.h / 2;
  const occupied = () => state.nodes.some(n => Math.abs(n.x - snapCoordinate(x, bypassSnap)) < 1 && Math.abs(n.y - snapCoordinate(y, bypassSnap)) < 1);
  while (occupied()) { x += 2 * GRID_SIZE; y += 2 * GRID_SIZE; }
  return createNode(kind, x, y, true, bypassSnap);
}

function duplicateNode(n, bypassSnap = false) {
  const copy = structuredClone(n);
  copy.id = nextId();
  copy.x = snapCoordinate(copy.x + 45, bypassSnap); copy.y = snapCoordinate(copy.y + 45, bypassSnap);
  if (copy.number) copy.number = nextTagNumber(copy.kind);
  state.nodes.push(copy);
  selected = {type: 'node', id: copy.id};
  render(); persist();
}
// Copies the selected symbols together with the pipes that run between them.
function duplicateSelectedNodes(bypassSnap = false) {
  const nodes = selectedNodes();
  if (nodes.length < 2) return;
  const dx = snapCoordinate(nodes[0].x + 45, bypassSnap) - nodes[0].x, dy = snapCoordinate(nodes[0].y + 45, bypassSnap) - nodes[0].y;
  const ids = new Map(), lineIds = new Map(), copies = [];
  for (const n of nodes) {
    const copy = structuredClone(n);
    copy.id = nextId(); copy.x += dx; copy.y += dy;
    ids.set(n.id, copy.id); copies.push(copy);
  }
  const pipes = state.pipes.filter(p => ids.has(p.a.node) && ids.has(p.b.node)).map(p => {
    const copy = structuredClone(p);
    copy.id = nextId(); copy.a.node = ids.get(p.a.node); copy.b.node = ids.get(p.b.node); copy.route = shiftedRoute(p.route, dx, dy);
    if (!lineIds.has(lineKey(p))) lineIds.set(lineKey(p), copy.id);
    copy.lineId = lineIds.get(lineKey(p));
    return copy;
  });
  // Pushed one at a time so each numbered copy takes the next free tag number.
  for (const copy of copies) { if (copy.number) copy.number = nextTagNumber(copy.kind); state.nodes.push(copy); }
  state.pipes.push(...pipes);
  selected = {type: 'nodes', ids: copies.map(n => n.id)};
  render(); persist();
}
function duplicateSelection(bypassSnap = false) {
  const nodes = selectedNodes();
  if (nodes.length > 1) duplicateSelectedNodes(bypassSnap);
  else if (nodes.length === 1) duplicateNode(nodes[0], bypassSnap);
}

function deleteSelected() {
  if (!selected) return;
  if (selected.type === 'pipe') state.pipes = state.pipes.filter(p => p.id !== selected.id);
  else {
    const ids = new Set(selectedNodeIds());
    // A symbol sitting in a line is taken out of it; the line itself stays.
    for (const n of selectedNodes()) if (pipesOnNode(n.id).every(p => !ids.has(p.a.node === n.id ? p.b.node : p.a.node))) detachFromLine(n);
    state.nodes = state.nodes.filter(n => !ids.has(n.id));
    state.pipes = state.pipes.filter(p => !ids.has(p.a.node) && !ids.has(p.b.node));
  }
  selected = null;
  render(); persist();
}

// Aligns the selection to its first symbol, which stays where it is.
function alignSelected(axis, edge) {
  const nodes = selectedNodes();
  if (nodes.length < 2) return;
  const offset = n => { const b = nodeBounds(n), size = axis === 'x' ? b.w : b.h; return edge === 'start' ? -size / 2 : edge === 'end' ? size / 2 : 0; };
  const target = nodes[0][axis] + offset(nodes[0]);
  for (const n of nodes.slice(1)) n[axis] = Math.round(target - offset(n));
  render(); persist();
}

// Moves the selected symbols, carrying the routes of pipes that run between them.
function moveSelection(dx, dy, group) {
  const nodes = selectedNodes(), ids = new Set(nodes.map(n => n.id));
  if (!nodes.length) return;
  for (const n of nodes) { n.x += dx; n.y += dy; }
  for (const p of state.pipes) if (ids.has(p.a.node) && ids.has(p.b.node)) p.route = shiftedRoute(p.route, dx, dy);
  render(); persist(group);
}

function applyTransform() { showInsertionPreview(null); render(); persist(); }
function rotateNode(n, degrees) { n.rotation = ((n.rotation || 0) + degrees) % 360; applyTransform(); }

// ---- Ports and pipes ----

// Adds a port to a symbol at a canvas position and returns its id.
function addPortAt(n, world) {
  const p = transformPoint(n, {x: world.x - n.x, y: world.y - n.y}, true);
  let number = 1;
  while (n.ports.some(port => port.id === `P${number}`)) number++;
  n.ports.push({id: `P${number}`, x: Math.round(p.x), y: Math.round(p.y), custom: true});
  return `P${number}`;
}
function removePort(nodeId, portId) {
  const n = byId(nodeId);
  if (!portEditable(n) || !n.ports.some(p => p.id === portId)) return;
  n.ports = n.ports.filter(p => p.id !== portId);
  state.pipes = state.pipes.filter(p => !(p.a.node === nodeId && p.a.port === portId) && !(p.b.node === nodeId && p.b.port === portId));
  pending = null; drag = null;
  render(); persist();
}

const sameRef = (p, q) => p.node === q.node && p.port === q.port;

// The port of a junction that a new branch should use: an unconnected one facing the given point.
function branchPort(junction, towards) {
  if (!junction.ports.length) junction.ports = structuredClone(JUNCTION_PORTS);
  const used = new Set(pipesOnNode(junction.id).map(p => p.a.node === junction.id ? p.a.port : p.b.port));
  const free = junction.ports.filter(p => !used.has(p.id));
  if (!free.length) return null;
  const facing = p => { const q = transformPoint(junction, p); return q.x * (towards.x - junction.x) + q.y * (towards.y - junction.y); };
  return free.reduce((best, p) => facing(p) > facing(best) ? p : best).id;
}
// While a branch is being drawn from a junction, it leaves from the side nearest the pointer.
function aimPendingBranch(towards) {
  if (!pending?.branch) return;
  const port = branchPort(byId(pending.node), towards);
  if (port) pending.port = port;
}

// Joins the pending port to another one. Returns false if the two cannot be connected.
function connectPending(ref) {
  if (!pending || pending.node === ref.node) return false;
  aimPendingBranch(portPos(ref) || byId(ref.node));
  const from = {node: pending.node, port: pending.port};
  const exists = state.pipes.some(p => (sameRef(p.a, from) && sameRef(p.b, ref)) || (sameRef(p.b, from) && sameRef(p.a, ref)));
  if (!exists) {
    const pipeId = nextId();
    state.pipes.push({id: pipeId, lineId: pipeId, a: from, b: ref});
  }
  pending = null; drag = null;
  render(); persist();
  return true;
}
// A click or drag on a port: starts a connection, or completes the one in progress.
function beginPipe(nodeId, portId, e) {
  e.stopPropagation();
  const ref = {node: nodeId, port: portId};
  if (e.altKey && portEditable(byId(nodeId))) { removePort(nodeId, portId); return; }
  if (!pending) {
    pending = ref;
    drag = {type: 'connect', cursor: point(e), sx: e.clientX, sy: e.clientY, moved: false};
    render();
    return;
  }
  if (sameRef(pending, ref)) { pending = null; drag = null; render(); return; }
  if (!connectPending(ref)) setStatus('Choose a port on another symbol');
}
// A click on a symbol's artwork while piping: creates a port there and uses it.
function pipeFromSymbol(n, e) {
  if (!portEditable(n)) return;
  if (pending && pending.node === n.id) { setStatus('Choose a port on another symbol'); return; }
  const world = point(e);
  if (n.kind === 'junction') { pipeFromJunction(n, world, e); return; }
  const ref = {node: n.id, port: addPortAt(n, world)};
  if (pending) { connectPending(ref); return; }
  pending = ref;
  drag = {type: 'connect', cursor: world, sx: e.clientX, sy: e.clientY, moved: false};
  render(); persist();
}
// Junctions offer their unconnected ports instead of taking a new one where they are clicked.
function pipeFromJunction(junction, world, e) {
  const source = pending && portPos(pending), port = branchPort(junction, source || world);
  if (!port) { setStatus('This junction has no free port'); return; }
  if (pending) { connectPending({node: junction.id, port}); return; }
  pending = {node: junction.id, port, branch: true};
  drag = {type: 'connect', cursor: world, sx: e.clientX, sy: e.clientY, moved: false};
  render(); persist();
}
// A click on a pipe while piping: tees into it with a new junction and branches from there.
function pipeFromPipe(pipeId, e) {
  const world = point(e), target = insertionTarget('junction', world, null, pipeId);
  if (!target) { setStatus('Not enough straight pipe here for a tee; click a longer straight run'); return; }
  // Keep the tee on whole units along the pipe.
  if (target.vertical) target.y = Math.round(target.y); else target.x = Math.round(target.x);
  const spec = specs.junction, keep = {pending, selected};
  const junction = {id: nextId(), kind: 'junction', x: target.x, y: target.y, w: spec.w, h: spec.h, tag: spec.tag, notes: '', ports: []};
  state.nodes.push(junction);
  insertInlineSymbol(junction, target);
  pending = keep.pending; selected = keep.selected;
  pipeFromJunction(junction, world, e);
}

// ---- Inline insertion ----

// Finds a straight pipe segment under a point with room for an inline symbol and short leads.
// onlyPipeId restricts the search to one pipe.
function insertionTarget(kind, at, nodeId = null, onlyPipeId = null) {
  if (!isInsertable(kind) || (nodeId && pipesOnNode(nodeId).length)) return null;
  const tolerance = 14 / screenScale(), spec = specs[kind], symbol = nodeId ? byId(nodeId) : null;
  let best = null;
  for (const pipe of state.pipes) {
    const points = onlyPipeId && pipe.id !== onlyPipeId ? null : pipeRoute(pipe)?.points;
    if (!points) continue;
    for (let segment = 0; segment < points.length - 1; segment++) {
      const start = points[segment], end = points[segment + 1], vertical = start.x === end.x, axis = vertical ? 'y' : 'x';
      const length = Math.abs(end[axis] - start[axis]);
      const along = spec.inline ? (symbol?.w || spec.w) : vertical ? (symbol?.h || spec.h) : (symbol?.w || spec.w);
      const size = along * (symbol ? nodeScale(symbol) : 1), clearance = size / 2 + 12;
      if (length < clearance * 2) continue;
      const low = Math.min(start[axis], end[axis]), high = Math.max(start[axis], end[axis]);
      const projection = Math.max(low, Math.min(high, at[axis]));
      const distance = Math.hypot(vertical ? at.x - start.x : at.x - projection, vertical ? at.y - projection : at.y - start.y);
      if (distance > tolerance || (best && distance >= best.distance)) continue;
      const center = Math.max(low + clearance, Math.min(high - clearance, projection));
      const forward = end[axis] > start[axis];
      best = {
        kind, pipeId: pipe.id, segment, vertical, x: vertical ? start.x : center, y: vertical ? center : start.y,
        forward, flowForward: pipe.direction === 'reverse' ? !forward : forward, points: points.map(p => ({...p})), distance, size
      };
    }
  }
  return best;
}

// Takes an inline symbol out of its line: the two pipes meeting at it become one again, and
// the symbol is left unconnected. Returns false when the symbol is not simply in a line.
function detachFromLine(n) {
  const pipes = pipesOnNode(n.id);
  if (!isInsertable(n.kind) || pipes.length !== 2 || pipes.some(p => p.a.node === p.b.node)) return false;
  const [first, second] = pipes, portOf = p => p.a.node === n.id ? p.a.port : p.b.port;
  if (portOf(first) === portOf(second)) return false;
  // Both routes are read running through the symbol: into it along the first pipe, out along the second.
  const inward = first.b.node === n.id, outward = second.a.node === n.id;
  const through = (p, forward) => { const points = pipeRoute(p)?.points.slice(1, -1) || []; return forward ? points : points.reverse(); };
  const waypoints = [...through(first, inward), ...through(second, outward)];
  const flip = {forward: 'reverse', reverse: 'forward'};
  const joined = {
    ...first, a: inward ? first.a : first.b, b: outward ? second.b : second.a, route: {waypoints},
    ...(first.direction && !inward ? {direction: flip[first.direction]} : {})
  };
  state.pipes.splice(state.pipes.indexOf(first), 1, joined);
  state.pipes.splice(state.pipes.indexOf(second), 1);
  n.ports = [];
  return true;
}

// Splits the target pipe in two around the symbol and connects both halves to it.
function insertInlineSymbol(n, target) {
  const pipe = pipeById(target?.pipeId);
  if (!pipe) return false;
  const inline = !!specs[n.kind]?.inline;
  n.x = target.x; n.y = target.y;
  n.rotation = inline ? (target.vertical ? (target.flowForward ? 90 : 270) : (target.flowForward ? 0 : 180)) : 0;
  n.orientation = target.vertical ? 'vertical' : 'horizontal';
  n.ports = n.kind === 'junction' ? structuredClone(JUNCTION_PORTS)
    : inline || !target.vertical ? [{id: 'L', x: -n.w / 2, y: 0}, {id: 'R', x: n.w / 2, y: 0}]
    : [{id: 'T', x: 0, y: -n.h / 2}, {id: 'B', x: 0, y: n.h / 2}];
  const axis = target.vertical ? 'y' : 'x';
  const linePorts = n.ports.filter(p => Math.abs(transformPoint(n, p)[axis]) > 0.01).sort((p, q) => transformPoint(n, p)[axis] - transformPoint(n, q)[axis]);
  const before = target.forward ? linePorts[0].id : linePorts.at(-1).id, after = target.forward ? linePorts.at(-1).id : linePorts[0].id;
  const first = {...pipe, lineId: lineKey(pipe), b: {node: n.id, port: before}, route: {waypoints: target.points.slice(1, target.segment + 1)}};
  const second = {...pipe, id: nextId(), lineId: lineKey(pipe), a: {node: n.id, port: after}, route: {waypoints: target.points.slice(target.segment + 1, -1)}};
  state.pipes.splice(state.pipes.indexOf(pipe), 1, first, second);
  insertionPreview = null; pending = null;
  selected = {type: 'node', id: n.id};
  return true;
}
