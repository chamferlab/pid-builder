// Project files, seal artwork import, and SVG / PNG export.

function download(name, blob) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
const baseName = () => state.title.trim().replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '') || 'seal-loop';

function loadProject(project) {
  if (!Array.isArray(project?.nodes) || !Array.isArray(project.pipes) || !Number.isInteger(project.nextId)) throw Error('Invalid project structure');
  state = migrateManualPorts(project);
  restoreSymbolAssets();
  resetInteraction();
  view = {...HOME_VIEW};
  render(); persist(); resetHistory();
}

$('saveProject').onclick = () => download(baseName() + '.json', new Blob([JSON.stringify(state, null, 2)], {type: 'application/json'}));
$('newProject').onclick = () => {
  if (!state.nodes.length || confirm('Start a new drawing with an empty canvas? Save your current project first if you want to keep it.')) seed();
};
$('projectFile').onchange = async e => {
  const file = e.target.files[0];
  if (!file) return;
  try { loadProject(JSON.parse(await file.text())); }
  catch (err) { alert('Could not open project: ' + err.message); }
  e.target.value = '';
};

// Imported artwork replaces the selected seal, or is added as a new seal.
$('sealFile').onchange = async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const raw = await file.text(), root = new DOMParser().parseFromString(raw, 'image/svg+xml').documentElement;
    if (root.querySelector('parsererror') || root.localName !== 'svg') throw Error('This is not a valid SVG.');
    // The artwork stays inside an image element, so it is displayed as inert SVG data.
    const href = 'data:image/svg+xml;base64,' + btoa(Array.from(new TextEncoder().encode(raw), b => String.fromCharCode(b)).join(''));
    const current = selected?.type === 'node' ? byId(selected.id) : null;
    const n = (current?.kind === 'seal' ? current : null) || createNode('seal', view.x + view.w / 2, view.y + view.h / 2, false);
    let ratio = 1.8;
    const viewBox = root.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number);
    const width = parseFloat(root.getAttribute('width')), height = parseFloat(root.getAttribute('height'));
    if (viewBox?.length === 4 && viewBox[2] > 0 && viewBox[3] > 0) ratio = viewBox[2] / viewBox[3];
    else if (!viewBox && width > 0 && height > 0) ratio = width / height;
    n.sealSvg = href;
    delete n.sealVariant;
    n.tag = file.name.replace(/\.svg$/i, '');
    n.w = Math.round(Math.max(200, Math.min(480, 250 * ratio))); n.h = 250;
    n.ports = [];
    state.pipes = state.pipes.filter(p => p.a.node !== n.id && p.b.node !== n.id);
    pending = null; drag = null;
    selected = {type: 'node', id: n.id};
    render(); persist();
    setStatus(`Imported ${file.name}`);
  } catch (err) { alert('Could not import SVG: ' + err.message); }
  e.target.value = '';
};

// The exported sheet always includes the home view, and grows to hold everything drawn.
function exportSize() {
  let left = 0, top = 0, right = HOME_VIEW.w, bottom = HOME_VIEW.h;
  const box = contentBox();
  if (box) { left = Math.min(left, box.l - 85); right = Math.max(right, box.r + 85); top = Math.min(top, box.t - 85); bottom = Math.max(bottom, box.b + 85); }
  // The sheet grows downwards when the drawing would otherwise run under the title block.
  const reach = TITLE_BLOCK.inset + 25;
  if (sheetInfo().frame && box && box.r > right - TITLE_BLOCK.w - reach && box.b > bottom - TITLE_BLOCK.h - reach) bottom = box.b + TITLE_BLOCK.h + reach;
  return {x: Math.floor(left), y: Math.floor(top), w: Math.ceil(right - left), h: Math.ceil(bottom - top)};
}
function exportMarkup() {
  const copy = svg.cloneNode(true), s = exportSize();
  copy.querySelectorAll('.editor-only').forEach(el => el.remove());
  copy.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
  copy.querySelector('defs')?.remove();
  copy.removeAttribute('id'); copy.removeAttribute('class');
  copy.setAttribute('xmlns', NS);
  copy.setAttribute('viewBox', `${s.x} ${s.y} ${s.w} ${s.h}`);
  copy.setAttribute('width', s.w); copy.setAttribute('height', s.h);
  return new XMLSerializer().serializeToString(copy);
}
$('exportSVG').onclick = () => download(baseName() + '.svg', new Blob([exportMarkup()], {type: 'image/svg+xml;charset=utf-8'}));
$('exportPNG').onclick = () => {
  const size = exportSize(), url = URL.createObjectURL(new Blob([exportMarkup()], {type: 'image/svg+xml;charset=utf-8'})), img = new Image();
  img.onload = () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = size.w * 2; canvas.height = size.h * 2;
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => blob ? download(baseName() + '.png', blob) : alert('PNG export failed.'), 'image/png');
    } catch (err) { alert('PNG export failed: ' + err.message); }
    finally { URL.revokeObjectURL(url); }
  };
  img.onerror = () => { URL.revokeObjectURL(url); alert('PNG rendering failed. Check that the imported SVG does not reference external images or fonts.'); };
  img.src = url;
};
