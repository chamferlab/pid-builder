// Properties panel for the current selection.

const pressed = on => `aria-pressed="${on ? 'true' : 'false'}"`;
const field = (label, id, value, attrs = '') =>
  `<label class="field" for="${id}">${label}</label><input class="text" id="${id}" value="${escapeHtml(value)}" ${attrs}>`;

function renderProperties() {
  const box = $('properties');
  if (selected?.type === 'nodes' && selectedNodes().length < 2) { selectNodeIds(selectedNodes().map(n => n.id)); return; }
  if (selected?.type === 'pipe' && !pipeById(selected.id)) selected = null;
  if (selected?.type === 'node' && !byId(selected.id)) selected = null;
  if (!selected) renderDrawingProperties(box);
  else if (selected.type === 'nodes') renderGroupProperties(box);
  else if (selected.type === 'pipe') renderPipeProperties(box, pipeById(selected.id));
  else renderNodeProperties(box, byId(selected.id));
}

function renderDrawingProperties(box) {
  box.innerHTML = `
    <div class="panel-title">Drawing</div>
    ${field('Title', 'titleEdit', state.title)}
    <div class="panel-title">How to draw</div>
    <ol class="steps">
      <li>Drag symbols from the palette onto the sheet.</li>
      <li>Choose <b>Pipe</b>, then click where a pipe starts and where it ends. Clicking a symbol creates a port there; clicking a pipe tees into it.</li>
      <li>Drop a valve, instrument, or junction onto a pipe to insert it.</li>
      <li>Select a pipe to set its line number, colour, flow arrow, and route.</li>
    </ol>
    <div class="panel-title">Shortcuts</div>
    <dl class="keys">
      <dt>P</dt><dd>Pipe tool</dd><dt>V / Esc</dt><dd>Select tool</dd>
      <dt>Shift-click</dt><dd>Add to selection</dd><dt>Shift-drag</dt><dd>Select an area</dd>
      <dt>Arrows</dt><dd>Nudge (Shift: one grid step)</dd><dt>Ctrl+D</dt><dd>Duplicate</dd>
      <dt>R</dt><dd>Rotate selected symbol</dd><dt>F</dt><dd>Zoom to fit</dd>
      <dt>Alt</dt><dd>Ignore snapping · Alt-click a port or bend to remove it</dd>
    </dl>`;
  $('titleEdit').oninput = e => { state.title = e.target.value; $('sheetTitle').textContent = state.title; persist('titleEdit'); };
}

function renderGroupProperties(box) {
  const nodes = selectedNodes();
  const align = (key, label, title) => `<button class="button" data-align="${key}" title="${title}">${label}</button>`;
  box.innerHTML = `
    <div class="info"><b>${nodes.length} symbols selected</b><br>Drag any of them to move the group. Shift-click adds or removes a symbol.</div>
    <div class="panel-title">Align to ${escapeHtml(nodes[0].tag || nodes[0].kind)}</div>
    <div class="button-grid three">
      ${align('x:start', 'Left', 'Align left edges')}${align('x:center', 'Center X', 'Align horizontal centers')}${align('x:end', 'Right', 'Align right edges')}
      ${align('y:start', 'Top', 'Align top edges')}${align('y:center', 'Center Y', 'Align vertical centers')}${align('y:end', 'Bottom', 'Align bottom edges')}
    </div>
    <div class="panel-title">Actions</div>
    <div class="button-grid">
      <button class="button" id="duplicateGroup">Duplicate</button>
      <button class="button danger" id="deleteSelected">Delete</button>
    </div>`;
  box.querySelectorAll('[data-align]').forEach(button => button.onclick = () => { const [axis, edge] = button.dataset.align.split(':'); alignSelected(axis, edge); });
  $('duplicateGroup').onclick = e => duplicateSelectedNodes(e.altKey);
  $('deleteSelected').onclick = deleteSelected;
}

function renderPipeProperties(box, p) {
  const r = pipeRoute(p);
  if (!r) { selected = null; renderDrawingProperties(box); return; }
  const {a, b, g} = r, line = lineKey(p), segmentCount = state.pipes.filter(candidate => lineKey(candidate) === line).length;
  const endName = ref => `${escapeHtml(byId(ref.node)?.tag || specs[byId(ref.node)?.kind]?.name || ref.node)} (${escapeHtml(ref.port)})`;
  const air = p.service === 'instrument-air';
  const routeKind = g.elbow ? 'elbow' : g.waypoints ? 'waypoints' : g.auto ? 'auto' : 'middle';
  const routeHelp = {
    auto: 'Routed automatically around symbols. Drag a handle on the pipe to take over.',
    middle: 'Drag the handles on the pipe to move the middle segment.',
    elbow: 'Click the handle on the pipe to flip the corner.',
    waypoints: 'Drag a bend to move it. Alt-click a bend to remove it.'
  }[routeKind];

  box.innerHTML = `
    <div class="panel-title">Line data${segmentCount > 1 ? ` <span class="muted">· ${segmentCount} segments</span>` : ''}</div>
    <div class="field-grid">
      <div>${field('Line number', 'lineNumberEdit', p.lineNumber || '', 'maxlength="40"')}</div>
      <div>${field('Size', 'lineSizeEdit', p.lineSize || '', 'maxlength="40"')}</div>
      <div>${field('Service', 'lineServiceEdit', p.lineService || '', 'maxlength="80"')}</div>
      <div>${field('Piping spec', 'lineSpecEdit', p.lineSpec || '', 'maxlength="80"')}</div>
    </div>

    <div class="panel-title">Appearance</div>
    <div class="segmented">
      <button data-pipe-service="process" ${pressed(!air)}>Solid</button>
      <button data-pipe-service="instrument-air" ${pressed(air)} title="Dashed instrument air line">Instrument air</button>
    </div>
    <div class="swatches" role="group" aria-label="Line color">
      <button class="swatch" data-pipe-color="default" ${pressed(!PIPE_COLORS[p.color])} title="Default"><span style="background:${DEFAULT_PIPE_COLOR}"></span></button>
      ${Object.entries(PIPE_COLORS).map(([key, color]) => `<button class="swatch" data-pipe-color="${key}" ${pressed(p.color === key)} title="${color.name}"><span style="background:${color.value}"></span></button>`).join('')}
    </div>

    <div class="panel-title">Flow arrow</div>
    <div class="segmented">
      <button data-pipe-direction="none" ${pressed(!p.direction)}>None</button>
      <button data-pipe-direction="forward" ${pressed(p.direction === 'forward')} title="From ${endName(p.a)} to ${endName(p.b)}">Forward →</button>
      <button data-pipe-direction="reverse" ${pressed(p.direction === 'reverse')} title="From ${endName(p.b)} to ${endName(p.a)}">← Reverse</button>
    </div>
    <p class="note">Runs from ${endName(p.a)} to ${endName(p.b)}.</p>

    <div class="panel-title">Route</div>
    <div class="button-grid">
      <button class="button" id="routeAuto" ${pressed(routeKind === 'auto')}>Automatic</button>
      <button class="button" id="routeAdd">+ Add bend</button>
      <button class="button" id="routeElbowHorizontal" ${pressed(g.elbow === 'horizontal')} title="One corner: horizontal, then vertical">Corner ⌐</button>
      <button class="button" id="routeElbowVertical" ${pressed(g.elbow === 'vertical')} title="One corner: vertical, then horizontal">Corner ∟</button>
      <button class="button" id="routeVertical" ${pressed(routeKind === 'middle' && g.axis === 'x')} title="Three segments with a vertical middle">Middle ┃</button>
      <button class="button" id="routeHorizontal" ${pressed(routeKind === 'middle' && g.axis === 'y')} title="Three segments with a horizontal middle">Middle ━</button>
      <button class="button wide" id="routeCenter" title="Three segments with the middle halfway between the ports">Center the middle segment</button>
    </div>
    <p class="note">${routeHelp}</p>

    <button class="button danger block" id="deleteSelected">Delete pipe</button>`;

  for (const [key, elementId] of [['lineNumber', 'lineNumberEdit'], ['lineService', 'lineServiceEdit'], ['lineSize', 'lineSizeEdit'], ['lineSpec', 'lineSpecEdit']]) {
    $(elementId).oninput = e => {
      for (const candidate of state.pipes) if (lineKey(candidate) === line) candidate[key] = e.target.value;
      renderCanvasOnly(); persist(`${elementId}:${line}`);
    };
  }
  const change = edit => () => { edit(); render(); persist(); };
  box.querySelectorAll('[data-pipe-service]').forEach(button => button.onclick = change(() => {
    if (button.dataset.pipeService === 'process') delete p.service; else p.service = button.dataset.pipeService;
  }));
  box.querySelectorAll('[data-pipe-color]').forEach(button => button.onclick = change(() => {
    if (button.dataset.pipeColor === 'default') delete p.color; else p.color = button.dataset.pipeColor;
  }));
  box.querySelectorAll('[data-pipe-direction]').forEach(button => button.onclick = change(() => {
    if (button.dataset.pipeDirection === 'none') delete p.direction; else p.direction = button.dataset.pipeDirection;
  }));
  const centered = axis => ({axis, value: axis === 'x' ? (a.x + b.x) / 2 : (a.y + b.y) / 2});
  $('routeAuto').onclick = change(() => { delete p.route; });
  $('routeAdd').onclick = () => addPipeWaypoint(p);
  $('routeElbowHorizontal').onclick = change(() => { p.route = {elbow: 'horizontal'}; });
  $('routeElbowVertical').onclick = change(() => { p.route = {elbow: 'vertical'}; });
  $('routeVertical').onclick = change(() => { p.route = centered('x'); });
  $('routeHorizontal').onclick = change(() => { p.route = centered('y'); });
  $('routeCenter').onclick = change(() => { p.route = centered(g.axis || defaultAxis(p)); });
  $('deleteSelected').onclick = deleteSelected;
}

function renderNodeProperties(box, n) {
  const spec = specs[n.sealVariant] || specs[n.kind];
  const name = n.kind === 'seal' ? (specs[n.sealVariant] ? [spec.name, spec.detail].filter(Boolean).join(' · ') : 'Mechanical seal') : spec?.name || n.kind;
  const editable = portEditable(n);
  const mirrored = [n[mirrorKey(n, 'x')] ? 'horizontal' : '', n[mirrorKey(n, 'y')] ? 'vertical' : ''].filter(Boolean).join(' + ') || 'none';
  const ports = n.ports.map(p => editable
    ? `<button class="chip" type="button" data-remove-port="${escapeHtml(p.id)}" title="Remove port ${escapeHtml(p.id)} and its pipes">${escapeHtml(p.id)} <span aria-hidden="true">×</span></button>`
    : `<span class="chip">${escapeHtml(p.id)}</span>`).join('');

  box.innerHTML = `
    <div class="info"><b>${escapeHtml(name)}</b><br>X ${Math.round(n.x)}, Y ${Math.round(n.y)}</div>
    ${field('Tag / caption', 'tagEdit', n.tag)}

    <div class="panel-title">Connection ports</div>
    <div class="chips">${ports || '<span class="muted">None yet. The Pipe tool adds them as you connect.</span>'}</div>
    ${editable ? '<button class="button block" id="addPortHere" type="button">+ Add port</button>' : ''}

    <div class="panel-title">Size and orientation</div>
    <div class="transform-row">
      <button class="button icon" id="rotateLeft" title="Rotate left 90°">↶</button>
      <button class="button icon" id="rotateRight" title="Rotate right 90° (R)">↷</button>
      <button class="button icon" id="mirrorHorizontal" title="Mirror horizontally">⇋</button>
      <button class="button icon" id="mirrorVertical" title="Mirror vertically">⇵</button>
      <label class="size" title="Size, 25% to 300%"><input class="text" id="symbolScale" type="number" min="25" max="300" step="5" value="${Math.round(nodeScale(n) * 100)}"><span>%</span></label>
    </div>
    <p class="note">Rotation ${n.rotation || 0}° · mirror ${mirrored} · <button class="link" id="resetTransform">Reset</button></p>

    <label class="field" for="notesEdit">Notes (saved in project)</label>
    <textarea class="text" id="notesEdit">${escapeHtml(n.notes)}</textarea>

    <div class="button-grid">
      <button class="button" id="duplicateSelected">Duplicate</button>
      <button class="button danger" id="deleteSelected">Delete</button>
    </div>`;

  $('tagEdit').oninput = e => { n.tag = e.target.value; renderCanvasOnly(); persist('tagEdit:' + n.id); };
  $('notesEdit').oninput = e => { n.notes = e.target.value; persist('notesEdit:' + n.id); };
  $('symbolScale').onchange = e => {
    const percent = Number(e.target.value);
    if (!Number.isFinite(percent) || percent < 25 || percent > 300) { e.target.value = Math.round(nodeScale(n) * 100); return; }
    n.scale = percent / 100; applyTransform();
  };
  $('rotateLeft').onclick = () => rotateNode(n, 270);
  $('rotateRight').onclick = () => rotateNode(n, 90);
  $('mirrorHorizontal').onclick = () => { const key = mirrorKey(n, 'x'); n[key] = !n[key]; applyTransform(); };
  $('mirrorVertical').onclick = () => { const key = mirrorKey(n, 'y'); n[key] = !n[key]; applyTransform(); };
  $('resetTransform').onclick = () => { delete n.scale; delete n.rotation; delete n.mirrorX; delete n.mirrorY; applyTransform(); };
  if (editable) $('addPortHere').onclick = () => setMode('addPort');
  box.querySelectorAll('[data-remove-port]').forEach(button => button.onclick = () => removePort(n.id, button.dataset.removePort));
  $('duplicateSelected').onclick = e => duplicateNode(n, e.altKey);
  $('deleteSelected').onclick = deleteSelected;
}
