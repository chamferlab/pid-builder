// Palette, toolbar wiring, and startup.

function buildPalette(group, target) {
  for (const [kind, spec] of Object.entries(specs)) {
    if (spec.group !== group || spec.hidden) continue;
    const tile = document.createElement('button');
    tile.className = 'item';
    tile.draggable = true;
    tile.dataset.kind = kind;
    tile.title = [spec.name, spec.detail].filter(Boolean).join(' · ');
    tile.innerHTML = `<span class="glyph">${paletteGlyph(kind)}</span><b>${escapeHtml(spec.name)}</b>${spec.detail && group === 'seal' ? `<small>${escapeHtml(spec.detail)}</small>` : ''}`;
    tile.ondragstart = e => { paletteDragKind = kind; e.dataTransfer.setData('text/plain', kind); e.dataTransfer.effectAllowed = 'copy'; };
    tile.ondragend = () => { paletteDragKind = null; showInsertionPreview(null); };
    tile.onclick = e => createNodeAtCenter(kind, e.altKey);
    $(target).appendChild(tile);
  }
}
buildPalette('seal', 'sealPalette');
buildPalette('instrument', 'instrumentPalette');
buildPalette('equipment', 'equipmentPalette');
renderTemplates();
renderBuiltinTemplates();

$('paletteSearch').oninput = e => {
  const query = e.target.value.trim().toLowerCase();
  for (const tile of document.querySelectorAll('.palette .item')) tile.hidden = !!query && !`${tile.title} ${tile.dataset.kind}`.toLowerCase().includes(query);
  for (const section of document.querySelectorAll('.palette .tiles')) section.previousElementSibling.hidden = !section.querySelector('.item:not([hidden])');
};

const canvasWrap = $('canvasWrap');
canvasWrap.ondragover = e => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
  showInsertionPreview(insertionTarget(paletteDragKind, point(e)));
};
canvasWrap.ondragleave = e => { if (!canvasWrap.contains(e.relatedTarget)) showInsertionPreview(null); };
canvasWrap.ondrop = e => {
  e.preventDefault();
  const kind = e.dataTransfer.getData('text/plain');
  if (kind.startsWith('template:')) { const p = point(e); placeTemplate(kind.slice(9), p.x, p.y, e.altKey); }
  else if (specs[kind]) {
    const p = point(e), target = insertionTarget(kind, p);
    showInsertionPreview(null);
    const n = createNode(kind, p.x, p.y, false, e.altKey);
    if (target) insertInlineSymbol(n, target);
    render(); persist();
  }
  paletteDragKind = null;
  showInsertionPreview(null);
};

$('undo').onclick = () => restoreHistory();
$('redo').onclick = () => restoreHistory(true);

// Restore the autosaved drawing, keeping a one-time backup before migrating an old one.
buildCanvas();
try {
  const raw = localStorage.getItem(STORAGE_KEY), saved = JSON.parse(raw);
  if (saved && Array.isArray(saved.nodes) && Array.isArray(saved.pipes)) {
    if (saved.portModeVersion !== 3) {
      try { if (!localStorage.getItem(LEGACY_BACKUP_KEY)) localStorage.setItem(LEGACY_BACKUP_KEY, raw); } catch {}
    }
    state = migrateManualPorts(saved);
  } else seed();
} catch { seed(); }
restoreSymbolAssets();
render(); persist(); resetHistory();
