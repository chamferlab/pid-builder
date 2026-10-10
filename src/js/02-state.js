// Drawing state, selection, undo history, and autosave.

const $ = id => document.getElementById(id);
const svg = $('drawing');

const blankState = () => ({title: 'Untitled seal loop', nodes: [], pipes: [], nextId: 1, sealSvg: null, portModeVersion: 3});

let state = blankState();
let selected = null;         // {type:'node',id} | {type:'nodes',ids} | {type:'pipe',id}
let pending = null;          // port reference a connection is being drawn from
let mode = 'select';         // 'select' | 'pipe' | 'addPort'
let drag = null;             // the pointer gesture in progress
let view = {...HOME_VIEW};
let insertionPreview = null;
let paletteDragKind = null;

let snapEnabled = false;
try { snapEnabled = localStorage.getItem(SNAP_STORAGE) === 'true'; } catch {}
const snapCoordinate = (value, bypass = false) =>
  snapEnabled && !bypass ? Math.round(value / GRID_SIZE) * GRID_SIZE : Math.round(value);

const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const nextId = () => `n${state.nextId++}`;
const mk = (tag, attrs = {}, parent) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (parent) parent.appendChild(el);
  return el;
};

const byId = key => state.nodes.find(n => n.id === key);
const pipeById = key => state.pipes.find(p => p.id === key);
const pipeColor = p => PIPE_COLORS[p.color]?.value || DEFAULT_PIPE_COLOR;
// Segments created by splitting one pipe share a line id and therefore line data.
const lineKey = p => p.lineId || p.id;
const pipesOnNode = nodeId => state.pipes.filter(p => p.a.node === nodeId || p.b.node === nodeId);
const connectedPorts = n => [...new Set(pipesOnNode(n.id).flatMap(p => [p.a, p.b]).filter(ref => ref.node === n.id).map(ref => ref.port))].sort();

const selectedNodeIds = () => selected?.type === 'nodes' ? selected.ids : selected?.type === 'node' ? [selected.id] : [];
const selectedNodes = () => selectedNodeIds().map(byId).filter(Boolean);
const isNodeSelected = id => selectedNodeIds().includes(id);
function selectNodeIds(ids) {
  selected = ids.length > 1 ? {type: 'nodes', ids} : ids.length ? {type: 'node', id: ids[0]} : null;
  render();
}
function toggleNodeSelection(id) {
  const ids = [...selectedNodeIds()], index = ids.indexOf(id);
  if (index < 0) ids.push(id); else ids.splice(index, 1);
  selectNodeIds(ids);
}

const manuallyPorted = n => !!n && (n.kind === 'seal' || ['seal', 'instrument'].includes(specs[n.kind]?.group));
const portEditable = n => manuallyPorted(n) || (!!n && specs[n.kind]?.group === 'equipment');

// Older projects had predefined ports. They are cleared once so every symbol is ported manually.
function migrateManualPorts(project) {
  if (project.portModeVersion === 3) return project;
  // Version 2 already has manual seal and instrument ports; migrate equipment only.
  const oldVersion = project.portModeVersion || 1;
  const changed = new Set();
  for (const n of project.nodes) {
    if ((oldVersion < 2 && manuallyPorted(n)) || specs[n.kind]?.group === 'equipment') {
      changed.add(n.id);
      n.ports = [];
    }
  }
  project.pipes = project.pipes.filter(p => !changed.has(p.a.node) && !changed.has(p.b.node));
  project.portModeVersion = 3;
  return project;
}

// When a media drawing has been redrawn at a different size, symbols saved with the old one
// take the new size, and their ports keep their relative positions.
function restoreSymbolAssets() {
  for (const n of state.nodes) {
    // The single seal used to be built in at 455 by 500; it is now a seal drawing like the others.
    if (n.kind === 'seal' && !n.sealVariant && !n.sealSvg && !state.sealSvg) {
      const single = specs[DEFAULT_SEAL], k = single.w / 455;
      for (const p of n.ports) { p.x = Math.round(p.x * k); p.y = Math.round(p.y * k); }
      Object.assign(n, {sealVariant: DEFAULT_SEAL, w: single.w, h: single.h, artworkSource: 'media', artworkVersion: single.version});
    }
    const spec = specs[n.kind];
    if (n.artworkSource !== 'media' || !spec?.svg || n.artworkVersion === spec.version) continue;
    const sx = spec.w / n.w, sy = spec.h / n.h;
    if (Number.isFinite(sx) && Number.isFinite(sy)) for (const p of n.ports) { p.x = Math.round(p.x * sx); p.y = Math.round(p.y * sy); }
    n.w = spec.w; n.h = spec.h; n.artworkVersion = spec.version;
  }
}

function resetInteraction() {
  selected = null; pending = null; drag = null; paletteDragKind = null; insertionPreview = null; mode = 'select';
}

// ---- Undo history and autosave ----
// History stores serialized snapshots. persist() is called after every edit; passing the
// same group name for consecutive edits (typing in one field, nudging) merges them.

let undoStack = [], redoStack = [], historyCurrent = null, historyGroup = null;

function updateHistoryButtons() {
  $('undo').disabled = undoStack.length === 0;
  $('redo').disabled = redoStack.length === 0;
}
function resetHistory() {
  undoStack = []; redoStack = []; historyCurrent = JSON.stringify(state); historyGroup = null;
  updateHistoryButtons();
}
function persist(group = null) {
  const data = JSON.stringify(state);
  if (historyCurrent !== null && data !== historyCurrent) {
    if (!group || historyGroup !== group) {
      undoStack.push(historyCurrent);
      if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
    }
    redoStack = []; historyCurrent = data; historyGroup = group;
  }
  updateHistoryButtons();
  try { localStorage.setItem(STORAGE_KEY, data); } catch { setStatus('Autosave full; use Save project'); }
}
function restoreHistory(isRedo = false) {
  // Finish a live drag before restoring, so it is also a single reversible action.
  if (JSON.stringify(state) !== historyCurrent) persist();
  const source = isRedo ? redoStack : undoStack, destination = isRedo ? undoStack : redoStack;
  if (!source.length) return;
  destination.push(historyCurrent);
  state = JSON.parse(source.pop());
  historyCurrent = JSON.stringify(state); historyGroup = null;
  const keepMode = mode === 'pipe' ? 'pipe' : 'select';
  resetInteraction(); mode = keepMode;
  render(); persist();
}

function seed() {
  state = blankState();
  resetInteraction();
  view = {...HOME_VIEW};
  render(); persist(); resetHistory();
}
