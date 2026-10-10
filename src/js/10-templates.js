// Templates: named pieces of drawing kept in the browser for reuse, with a file for backup and sharing.
// A template holds symbols and the pipes between them, positioned around its own centre.

const TEMPLATE_STORAGE = 'seal-loop-pid-templates-v1';
const TEMPLATE_STASH = 'seal-loop-pid-template-stash-v1';
const TEMPLATE_FILE_TYPE = 'seal-loop-pid-templates';

let templates = [];
try {
  const saved = JSON.parse(localStorage.getItem(TEMPLATE_STORAGE));
  if (Array.isArray(saved)) templates = saved.filter(validTemplate);
} catch {}

function validTemplate(t) {
  return !!t && typeof t.name === 'string' && Array.isArray(t.nodes) && t.nodes.length > 0 && Array.isArray(t.pipes);
}
function storeTemplates() {
  try { localStorage.setItem(TEMPLATE_STORAGE, JSON.stringify(templates)); }
  catch { alert('The browser storage is full, so templates could not be saved. Export them to a file and remove some.'); }
  renderTemplates(); render();
}
// Built-in templates come with the application and cannot be changed; a placed copy can be saved as your own.
const templateById = id => templates.find(t => t.id === id) || BUILTIN_TEMPLATES.find(t => t.id === id);
const templateByName = name => templates.find(t => t.name.toLowerCase() === name.trim().toLowerCase());
const newTemplateId = () => 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// Copies the given symbols and the pipes running between them, centred on the origin.
function fragmentOf(nodes) {
  const ids = new Set(nodes.map(n => n.id)), boxes = nodes.map(nodeBox);
  const cx = Math.round((Math.min(...boxes.map(b => b.l)) + Math.max(...boxes.map(b => b.r))) / 2);
  const cy = Math.round((Math.min(...boxes.map(b => b.t)) + Math.max(...boxes.map(b => b.b))) / 2);
  return {
    nodes: nodes.map(n => ({...structuredClone(n), x: n.x - cx, y: n.y - cy})),
    pipes: state.pipes.filter(p => ids.has(p.a.node) && ids.has(p.b.node)).map(p => ({...structuredClone(p), route: shiftedRoute(p.route, -cx, -cy)}))
  };
}

// Saves a fragment under a name, replacing the template that already has that name.
function saveTemplate(name, fragment, id = null) {
  name = name.trim();
  const existing = templateById(id) || templateByName(name);
  if (existing) Object.assign(existing, fragment, {name});
  else templates.push({id: newTemplateId(), name, ...fragment});
  storeTemplates();
}
function saveSelectionAsTemplate() {
  const nodes = selectedNodes();
  if (!nodes.length) return;
  const name = prompt('Template name', nodes.length === 1 ? nodes[0].tag || '' : '')?.trim();
  if (!name) return;
  if (templateByName(name) && !confirm(`Replace the existing template “${templateByName(name).name}”?`)) return;
  saveTemplate(name, fragmentOf(nodes));
  setStatus(`Saved template ${name}`);
}

function placeTemplate(id, x, y, bypassSnap = false) {
  const t = templateById(id);
  if (!t) return;
  addCopies(t.nodes, t.pipes, snapCoordinate(x, bypassSnap), snapCoordinate(y, bypassSnap));
  restoreSymbolAssets();  // a template may predate redrawn artwork
  mode = 'select'; pending = null;
  render(); persist();
}

// A small drawing of the template, built by rendering it as if it were the whole drawing.
function templateThumbnail(t) {
  const keep = state;
  state = {...blankState(), nodes: t.nodes, pipes: t.pipes};
  try {
    const box = contentBox(), pad = 12;
    const pipes = t.pipes.map(p => { const r = pipeRoute(p); return r ? `<path d="${r.g.path}" fill="none" stroke="${pipeColor(p)}" stroke-width="2.6" vector-effect="non-scaling-stroke"/>` : ''; }).join('');
    const nodes = t.nodes.map(n => `<g transform="translate(${n.x} ${n.y})"><g transform="${nodeTransform(n)}">${symbolMarkup(n)}</g>${isInstrument(n.kind) ? captionMarkup({...n, tag: n.kind}) : ''}</g>`).join('');
    return `<svg xmlns="${NS}" viewBox="${box.l - pad} ${box.t - pad} ${box.r - box.l + 2 * pad} ${box.b - box.t + 2 * pad}" aria-hidden="true">${pipes}${nodes}</svg>`;
  } catch { return ''; }
  finally { state = keep; }
}

function templateTile(t) {
  const tile = document.createElement('button');
  tile.className = 'item template';
  tile.draggable = true;
  tile.dataset.template = t.id;
  tile.title = [t.name, t.detail, 'template'].filter(Boolean).join(' · ');
  tile.innerHTML = `<span class="glyph">${templateThumbnail(t)}</span><b>${escapeHtml(t.name)}</b>${t.detail ? `<small>${escapeHtml(t.detail)}</small>` : ''}`;
  tile.ondragstart = e => { e.dataTransfer.setData('text/plain', 'template:' + t.id); e.dataTransfer.effectAllowed = 'copy'; };
  tile.onclick = e => placeTemplate(t.id, view.x + view.w / 2, view.y + view.h / 2, e.altKey);
  return tile;
}
function renderTemplates() {
  const target = $('templatePalette');
  target.replaceChildren();
  if (!templates.length) target.innerHTML = '<p class="palette-hint">Select symbols on the sheet and choose <b>Save as template</b> to reuse them.</p>';
  for (const t of templates) target.appendChild(templateTile(t));
}
function renderBuiltinTemplates() {
  for (const t of BUILTIN_TEMPLATES) $('planPalette').appendChild(templateTile(t));
  $('planPalette').previousElementSibling.hidden = $('planPalette').hidden = !BUILTIN_TEMPLATES.length;
}

// ---- Editing a template ----
// The template is opened as a drawing of its own; the drawing that was open is set aside in
// browser storage and comes back when the template is saved or closed.

const editingTemplate = () => state.templateId || null;

function editTemplate(id) {
  const t = templateById(id);
  if (!t || editingTemplate()) return;
  try { localStorage.setItem(TEMPLATE_STASH, JSON.stringify(state)); }
  catch { alert('The browser storage is full, so the current drawing cannot be set aside. Save it to a file first.'); return; }
  state = {...blankState(), title: t.name, templateId: t.id};
  state.sheet.frame = false;
  resetInteraction();
  view = {...HOME_VIEW};
  addCopies(t.nodes, t.pipes, HOME_VIEW.w / 2, HOME_VIEW.h / 2);
  restoreSymbolAssets();
  selected = null;
  zoomToFit(); persist(); resetHistory();
}
// save: false closes without saving, true replaces the template being edited, and 'new' leaves
// that template as it was and saves the sheet as another one under the title.
function closeTemplate(save) {
  const id = editingTemplate();
  if (!id) return;
  if (save) {
    if (!state.nodes.length) { alert('A template needs at least one symbol.'); return; }
    const name = state.title.trim() || templateById(id)?.name || 'Template';
    const clash = templateByName(name);
    if (save === 'new' && clash) { alert(`A template is already called “${clash.name}”. Give this one another title first.`); return; }
    if (clash && clash.id !== id) { alert(`Another template is already called “${clash.name}”. Change the title first.`); return; }
    saveTemplate(name, fragmentOf(state.nodes), save === 'new' ? null : id);
  }
  let previous = null;
  try { previous = JSON.parse(localStorage.getItem(TEMPLATE_STASH)); localStorage.removeItem(TEMPLATE_STASH); } catch {}
  if (previous && Array.isArray(previous.nodes) && Array.isArray(previous.pipes)) loadProject(previous);
  else seed();
}
$('templateSave').onclick = () => closeTemplate(true);
$('templateSaveNew').onclick = () => closeTemplate('new');
$('templateClose').onclick = () => closeTemplate(false);

// ---- Template file ----

function exportTemplates() {
  download('seal-loop-templates.json', new Blob([JSON.stringify({type: TEMPLATE_FILE_TYPE, version: 1, templates}, null, 2)], {type: 'application/json'}));
}
// Imported templates are added to the library; one with the name of an existing template replaces it.
$('templateFile').onchange = async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text()), incoming = data?.type === TEMPLATE_FILE_TYPE && Array.isArray(data.templates) ? data.templates.filter(validTemplate) : null;
    if (!incoming?.length) throw Error('This file contains no templates.');
    for (const t of incoming) {
      const existing = templateByName(t.name);
      if (existing) Object.assign(existing, {nodes: t.nodes, pipes: t.pipes});
      else templates.push({id: newTemplateId(), name: t.name.trim(), nodes: t.nodes, pipes: t.pipes});
    }
    storeTemplates();
    setStatus(`Imported ${incoming.length} template${incoming.length === 1 ? '' : 's'}`);
  } catch (err) { alert('Could not import templates: ' + err.message); }
  e.target.value = '';
};

// The template list in the Properties panel, shown with the drawing's own properties.
function templatePanelMarkup() {
  const rows = templates.map(t => `
    <div class="template-row" data-template-row="${t.id}">
      <input class="text" value="${escapeHtml(t.name)}" data-template-name="${t.id}" aria-label="Template name">
      <button class="button" data-template-edit="${t.id}" title="Open this template on the sheet to change it" ${editingTemplate() ? 'disabled' : ''}>Edit</button>
      <button class="button danger" data-template-delete="${t.id}" title="Delete this template">×</button>
    </div>`).join('');
  return `
    <div class="panel-title">Templates</div>
    ${rows || '<p class="note">None yet. Select symbols and choose Save as template.</p>'}
    <div class="button-grid">
      <button class="button" id="templatesExport" ${templates.length ? '' : 'disabled'} title="Download all templates as one file">Export</button>
      <button class="button" id="templatesImport" title="Add templates from a file">Import</button>
    </div>
    <p class="note">Templates are kept in this browser. Export them to back them up or share them.</p>`;
}
function wireTemplatePanel(box) {
  box.querySelectorAll('[data-template-name]').forEach(input => input.onchange = () => {
    const t = templateById(input.dataset.templateName), name = input.value.trim(), clash = templateByName(name);
    if (!t) return;
    if (!name || (clash && clash !== t)) { input.value = t.name; return; }
    t.name = name; storeTemplates();
  });
  box.querySelectorAll('[data-template-edit]').forEach(button => button.onclick = () => editTemplate(button.dataset.templateEdit));
  box.querySelectorAll('[data-template-delete]').forEach(button => button.onclick = () => {
    const t = templateById(button.dataset.templateDelete);
    if (!t || !confirm(`Delete the template “${t.name}”? Drawings that already use it are not affected.`)) return;
    templates = templates.filter(other => other !== t); storeTemplates();
  });
  $('templatesExport').onclick = exportTemplates;
  $('templatesImport').onclick = () => $('templateFile').click();
}
