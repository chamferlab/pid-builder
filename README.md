# Seal Loop P&ID Builder

An offline, single-file HTML prototype for drawing mechanical seal support loops. Start with an empty canvas, drag in symbols, connect their ports with orthogonal pipes, and export the drawing as SVG or PNG. Supplied SVG artwork is embedded in the HTML.

## Run it

Open [`PID-Builder.html`](PID-Builder.html) in a desktop browser. No installation, server, account, or network connection is required.

The browser restores the last drawing automatically. Choose **New drawing** for an empty canvas; save your existing drawing first if you want to keep it. After updating the HTML, reload the page to use the latest controls and symbols.

## Build a loop

1. Drag a symbol from the left palette onto the sheet. Clicking a palette item places it at the center of the view. Use the search box to filter the palette.
2. Choose **Pipe** (or press **P**), click the symbol where the pipe starts, then click the symbol where it ends. A connection port is created at each point you click, and the pipe is routed between them. The Pipe tool stays active so you can keep connecting; press **Esc** when done.
3. Drag symbols to reposition them. Connected pipes follow and re-route.
4. Drop a valve, instrument, or junction onto a pipe to insert it.
5. Select a pipe to set its line data, color, flow arrow, and route. Select a symbol to edit its caption, notes, size, and orientation. Click blank space to edit the drawing title.

### Connecting

- **Pipe tool:** click a symbol or an existing port to start, click another symbol or port to finish.
- **Drag:** in the Select tool, press an existing port and release over another port or symbol.
- **Click-click:** click a port, then click another port or symbol.
- **Tee into a pipe:** with the Pipe tool, click a pipe to start or end there. A junction is inserted at that point and the new pipe branches from the side facing its other end. Clicking an existing junction uses one of its free sides. The pipe needs a straight run of about 70 units at the point you click.
- **+ Port** places a port without drawing a pipe. Ports are stored where you click, so place them on the nozzle you mean.

Pipes cannot connect a symbol to itself. A port shows as a small filled dot once a pipe is attached.

### Pipe routes

New pipes are routed automatically: they leave each port outward from the side of the symbol it sits on, and go around symbols instead of through them. Automatic routes update as you move things. They do not avoid other pipes.

Select a pipe to adjust it. Drag the handles on the pipe, or use **Properties → Route**:

| Control | Result |
| --- | --- |
| **Automatic** | Hands the route back to the automatic router. |
| **+ Add bend** | Adds a draggable bend on the longest straight segment. Alt-click a bend to remove it. |
| **Corner** (two directions) | A single corner. Click the handle on the pipe to flip it. |
| **Middle** (vertical / horizontal) | Three segments with a draggable middle segment. |
| **Center the middle segment** | Three segments with the middle halfway between the ports. |

Dragging a handle on an automatic route keeps the shape you set: a straight or three-segment route gets a fixed middle segment, any other shape has its corners turned into bends.

### Select and align several symbols

Click a symbol, then **Shift-click** others to add or remove them from the selection. **Shift-drag** on blank sheet selects every symbol the rectangle touches. **Ctrl/Cmd+A** selects all symbols. Arrow keys nudge the selection by one unit, or one grid step with Shift. Drag any selected symbol to move the group; connected pipe endpoints follow. If a pipe connects two selected symbols, its route moves with the group too.

With several symbols selected, use **Properties → Align symbols** to align their left edges, horizontal centers, right edges, top edges, vertical centers, or bottom edges. The first selected symbol is the reference and stays in place. Alignment uses the visible symbol bounds, including rotation and size.

**Duplicate** (or **Ctrl/Cmd+D**) copies the symbols and any pipes between them, offset as a group. **Delete** removes the group and its connected pipes. Group moves, alignment, duplication, and deletion each form one undo step.

### Snap symbols to the grid

Use **Snap to grid** above the canvas to align symbol centers to the visible 25-unit grid when placing, dragging, or duplicating symbols. Hold **Alt** during placement or dragging to position a symbol freely. The toggle is off initially and its setting is remembered in this browser. Manually placed ports and pipe waypoints remain free-moving; dropping an inline symbol onto a pipe aligns it to that pipe even when snapping is on.

### Insert instruments, valves, and junctions into a pipe

Drop an instrument, isolation valve, check valve, or pipe junction onto an existing pipe. A turquoise insertion preview shows the insertion point. Releasing the symbol splits the pipe into two connections, leaving a gap for the symbol and connecting both sides automatically.

- Horizontal and vertical segments are supported, including segments of bent pipes.
- The straight segment must have room for the symbol and a short lead on each side. Drops elsewhere place the symbol normally.
- Unconnected instruments, valves, and junctions already on the canvas can also be dragged onto a pipe.
- Junctions keep all four ports: two connect along the line, and two remain available for branches.
- An inserted check valve points in the pipe's flow direction when an arrow is set. Rotate or mirror it to change the direction later.
- Resized symbols fit using their current size; insertion aligns them with the target line.
- Moving a connected symbol retains its existing connections.
- Both resulting pipe sections inherit the original line color.

### Resize, rotate, and mirror

Select any symbol and use **Properties**:

| Control | Result |
| --- | --- |
| **Size (%)** | Scales the symbol uniformly from 25% to 300%. |
| **Rotate left / right 90°** | Rotates the artwork and its ports around the symbol center. **R** rotates right, **Shift+R** left. |
| **Mirror horizontally / vertically** | Reflects the artwork and ports in the chosen canvas direction. |
| **Reset** | Restores the original size and clears rotation and mirroring. |
| **Duplicate** | Copies artwork, ports, captions, notes, size, rotation, and mirroring. |

Attached pipe endpoints follow the transformed ports. Instrument labels and captions stay upright. Transformations are retained in saved projects and exports.

### Line colors

Select a pipe and pick a swatch under **Properties → Appearance**: the default dark line, **Teal**, **Blue**, **Red**, or **Orange**. Colors persist in saved projects and SVG/PNG exports.

### Line data

Select a pipe and fill in **Line number**, **Size**, **Service**, and **Piping spec** in Properties. These are free-text fields so you can use your project's own units and naming convention. A line number appears next to the pipe and in SVG/PNG exports. All four fields are saved in project JSON and can be undone or redone.

Inserting an instrument, valve, or junction splits a pipe into segments of the same logical line. Editing line data on either segment updates every segment of that line. Duplicating a group of symbols copies their internal pipes into a separate logical line with the same field values. Separately drawn pipes remain separate lines even if you type the same line number on them.

### Instrument air lines

Select a pipe and choose **Properties → Appearance → Instrument air** for a dashed line. Choose **Solid** to restore the solid line. The line type can be combined with any line color or flow direction and is retained in saved projects and SVG/PNG exports. Existing pipes remain solid. Inserting an instrument or junction into an instrument air line carries the dashed style onto both new sections.

### Pipe flow direction

Select a pipe and choose **Properties → Flow arrow** to show an arrow from its first connected port to its second, reverse the arrow, or remove it. The panel names both ports. The arrow follows the pipe's longest straight segment when you move symbols or bends, matches the line color, and appears in saved projects and SVG/PNG exports. Existing pipes have no arrow until you set one. Inserting an instrument or junction into a directed pipe carries its direction onto both new sections.

## Symbol palette

The mechanical seal palette includes the original single seal and six dual seal variants: back-to-back, face-to-face, and face-to-back, each with or without a plug seal. New seals start without connection ports; the Pipe tool adds them where you click.

Each seal has its own artwork, so different types can coexist in one drawing. Any `+` marks still printed in artwork are only placement guides; click them with the Pipe tool to make real connection points. Seals can be moved, transformed, duplicated, and deleted.

Instrumentation includes **PI, PT, TI, TT, FI, FT, and PDIT**. New instruments also start without ports. Inline insertion creates the two line ports required to split an existing pipe.

Equipment includes the supplied **accumulator, circulating pump, cooler, heater, reservoir, and dome-loaded pressure control valve**, plus a bladder-accumulator reservoir, an N₂-connected reservoir, an **air driven pump**, **isolation valve**, **check valve**, **drain**, **vent**, and a four-way pipe junction. The six supplied equipment types use their SVG artwork on the canvas. The new symbols use built-in vector artwork, so they remain available offline and in exports.

Place ports manually on the air driven pump, drain, and vent at the connections you need. Valves also start without ports when placed on empty canvas; dropping one onto a pipe adds two line ports and connects it automatically. Drains and vents are terminal symbols rather than inline components.

Place equipment ports on the nozzles you want to use. Saved circulating pump symbols update to revised artwork while retaining manually placed ports and transformations.
The pressure control valve artwork has inlet and outlet stubs plus a top dome connection; use **+ Port** on the connections needed in your drawing.

## Undo and redo

Use **Undo** and **Redo** in the toolbar, **Ctrl/Cmd+Z** to undo, and **Ctrl/Cmd+Shift+Z** or **Ctrl+Y** to redo. The builder remembers up to 100 drawing edits during the current session.

Adding, deleting, connecting, inserting, moving, routing, transforming, recoloring, setting pipe direction, editing line data, importing seal artwork, and editing captions or notes can be reversed. Deleting a symbol and its connected pipes is one action; dragging a symbol or pipe bend is one action; consecutive typing in one field is grouped into one edit. Pan, zoom, and selection do not add undo steps. A new edit after undo clears the redo history.

Keyboard shortcuts inside text fields retain the browser's normal text-editing behavior; use the toolbar to undo a drawing edit while a field is focused. History resets when starting a new drawing, opening a project, or reloading the page, and is not included in saved project JSON. Undo and redo autosave the restored drawing.

## Other controls

| Action | How |
| --- | --- |
| Add a port | Use the **Pipe** tool, or choose **+ Port** and click a symbol. Works on transformed symbols too. |
| Remove a port | Select its symbol and click the port's chip in Properties, or Alt-click the port. Connected pipes on that port are removed too. |
| Pan | Drag empty sheet space, or drag with the middle mouse button. |
| Zoom | Use the mouse wheel or the `−`, `%`, and `+` buttons. **Fit** (or **F**) shows the whole drawing. |
| Cancel a connection, port placement, or insertion preview | Press Esc. |
| Delete a selected pipe or symbol | Press Delete/Backspace or use **Delete** in Properties. |
| Select several symbols | Shift-click symbols, Shift-drag an area, or press Ctrl/Cmd+A to select all. |
| Switch tools | **V** Select, **P** Pipe, **Esc** back to Select. |

**Import seal SVG** replaces the selected seal, or adds a seal at the canvas center if no seal is selected. Imported artwork is stored on its own symbol. Replacement clears that seal's old ports and connected pipes; use **+ Port** to place new connection points. Older projects containing a globally imported seal remain supported.

Older saved drawings are converted once when opened: predefined ports on seals, instruments, and equipment, along with their connected pipes, are removed so all symbols can be ported manually. Drawings already converted to manual seal and instrument ports retain those ports while equipment ports are cleared. The original imported JSON file is unchanged. Before migrating a drawing restored from browser storage, the builder saves its original JSON in browser storage under `seal-loop-pid-v1-before-all-manual-ports`.

## Save and export

| Command | Result |
| --- | --- |
| **Save project** | Downloads editable JSON with symbols, ports, connections, routes, line data, colors, transformations, captions, and notes. |
| **Open project** | Loads a saved project JSON. |
| **Export SVG** | Downloads a clean drawing with embedded SVG artwork and line colors, without the grid, handles, previews, or selection marks. |
| **Export PNG** | Downloads a raster image at twice the drawing's SVG dimensions. |

Browser storage is local and can be cleared; **Save project** is the portable backup. Drawings are not shared with colleagues or uploaded to a server. Exports of imported SVGs may depend on fonts or external references in those files.

## Project files and development

`PID-Builder.html` is generated. Edit the sources and rebuild; do not edit the HTML by hand.

- `PID-Builder.html` — the complete offline application, built from the files below.
- `src/index.html`, `src/styles.css` — page layout and styling.
- `src/js/` — the application, concatenated in filename order into one script:
  `01-catalog` (symbols and constants), `02-state` (drawing state, undo, autosave), `03-geometry`, `04-routing` (pipe routes), `05-symbols` (built-in artwork), `06-render`, `07-inspector` (Properties panel), `08-actions` (edits), `09-interactions` (pointer and keyboard), `10-io` (save, open, import, export), `11-main` (palette and startup).
- `src/assets/single-seal.svgfrag` — artwork for the original single seal.
- `media/` — source SVGs for dual seals and equipment.
- `scripts/build.py` — builds `PID-Builder.html`; standard library only.
- `scripts/test-app.py` — Firefox regression tests; standard library only.

```sh
python3 scripts/build.py      # after editing src/ or media/
python3 scripts/test-app.py   # needs Firefox
```

After editing a source SVG, update its recorded artwork bounds in `scripts/build.py` if its size or location changed, then rebuild and reload the page. To add a media symbol, add its SVG to `media/` and an entry to `BOUNDS` (and `EQUIPMENT`) in the build script.

The tests start a separate headless Firefox with a temporary profile, so your normal browser profile is untouched. They cover undo and redo, saved-project migration, inline insertion, line data, snapping, export, the Pipe tool, automatic routing, area selection, and keyboard editing.

## Current scope

This is a drawing prototype, not a validated P&ID or an API-plan generator. Automatic routing avoids symbols but not other pipes, so parallel runs can overlap until you move one. Automatic insertion currently supports instruments, isolation valves, check valves, and pipe junctions.

Future improvements include more line types, pipe-to-pipe spacing, instrument tag numbers, a title block, and drawing validation.
