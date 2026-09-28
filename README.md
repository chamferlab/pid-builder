# Seal Loop P&ID Builder

An offline, single-file HTML prototype for drawing mechanical seal support loops. Start with an empty canvas, drag in symbols, connect their ports with orthogonal pipes, and export the drawing as SVG or PNG. Supplied SVG artwork is embedded in the HTML.

## Run it

Open [`PID-Builder.html`](PID-Builder.html) in a desktop browser. No installation, server, account, or network connection is required.

The browser restores the last drawing automatically. Choose **New drawing** for an empty canvas; save your existing drawing first if you want to keep it. After updating the HTML, reload the page to use the latest controls and symbols.

## Build a loop

1. Drag a symbol from the left palette onto the sheet. Clicking a palette item places it at the canvas center.
2. Choose **+ Port** and click any symbol's artwork to place each connection point. New symbols start without ports. Click a port on one symbol, then a port on another to create a pipe.
3. Drag symbols to reposition them. Connected pipe endpoints follow.
4. Select a pipe and drag its turquoise bend handles to move the middle segment. In **Properties → Pipe route**, choose **+ Add waypoint** to create more bends. Drag a waypoint to route around equipment; Alt-click one to remove it. The vertical, horizontal, and centered controls return the pipe to a simple route.
5. Select a symbol to edit its caption or notes. Click blank space to edit the drawing title.

### Snap symbols to the grid

Use **Snap to grid** above the canvas to align symbol centers to the visible 25-unit grid when placing, dragging, or duplicating symbols. Hold **Alt** during placement or dragging to position a symbol freely. The toggle is off initially and its setting is remembered in this browser. Manually placed ports and pipe waypoints remain free-moving; dropping an instrument or junction onto a pipe aligns it to that pipe even when snapping is on.

### Insert instruments and junctions into a pipe

Drop an instrument or pipe junction onto an existing pipe. A turquoise **Insert instrument** or **Insert junction** preview shows the insertion point. Releasing the symbol splits the pipe into two connections, leaving a gap for the symbol and connecting both sides automatically.

- Horizontal and vertical segments are supported, including segments of bent pipes.
- The straight segment must have room for the symbol and a short lead on each side. Drops elsewhere place the symbol normally.
- Unconnected instruments and junctions already on the canvas can also be dragged onto a pipe.
- Junctions keep all four ports: two connect along the line, and two remain available for branches.
- Resized symbols fit using their current size; insertion aligns them with the target line.
- Moving a connected symbol retains its existing connections.
- Both resulting pipe sections inherit the original line color.

### Resize, rotate, and mirror

Select any symbol and use **Properties**:

| Control | Result |
| --- | --- |
| **Size (%)** | Scales the symbol uniformly from 25% to 300%. |
| **Rotate left / right 90°** | Rotates the artwork and its ports around the symbol center. |
| **Mirror horizontally / vertically** | Reflects the artwork and ports in the chosen canvas direction. |
| **Reset size / rotation / mirror** | Restores the original size and clears rotation and mirroring. |
| **Duplicate symbol** | Copies artwork, ports, captions, notes, size, rotation, and mirroring. |

Attached pipe endpoints follow the transformed ports. Instrument labels and captions stay upright. Transformations are retained in saved projects and exports.

### Line colors

Select a pipe and choose **Properties → Line color**: **Teal**, **Blue**, **Red**, or **Orange**. The selected pipe keeps its chosen color while its bend handles remain turquoise. Colors persist in saved projects and SVG/PNG exports. Pipes without a chosen color retain the default dark stroke.

### Instrument air lines

Select a pipe and choose **Properties → Line type → Dashed instrument air**. Choose **Solid pipe** to restore the solid line. The line type can be combined with any line color or flow direction and is retained in saved projects and SVG/PNG exports. Existing pipes remain solid. Inserting an instrument or junction into an instrument air line carries the dashed style onto both new sections.

### Pipe flow direction

Select a pipe and choose **Properties → Flow direction** to show an arrow from its first connected port to its second, reverse the arrow, or remove it. The inspector identifies both ports. The arrow follows the pipe's longest straight segment when you move symbols or bends, matches the line color, and appears in saved projects and SVG/PNG exports. Existing pipes have no arrow until you set one. Inserting an instrument or junction into a directed pipe carries its direction onto both new sections.

### Additional pipe waypoints

Select a pipe and choose **Properties → Pipe route → + Add waypoint**. A turquoise handle appears on its longest straight segment; drag it anywhere to adjust the orthogonal route. Add more waypoints for additional bends. Alt-click a waypoint handle to remove it. **Vertical**, **Horizontal**, or **Reset to centered route** clears the added waypoints and restores a single movable middle segment. Waypoints stay in saved projects and exports. Pipe endpoints remain attached when symbols move, and inline insertion keeps the route on both sides of the inserted symbol.

## Symbol palette

The mechanical seal palette includes the original single seal and six dual seal variants: back-to-back, face-to-face, and face-to-back, each with or without a plug seal. New seals start without connection ports; place them where needed with **+ Port**.

Each seal has its own artwork, so different types can coexist in one drawing. Any `+` marks still printed in artwork are only placement guides; use **+ Port** to make real connection points. Seals can be moved, transformed, duplicated, and deleted.

Instrumentation includes **PI, PT, TI, TT, FI, FT, and PDIT**. New instruments also start without ports. Inline insertion creates the two line ports required to split an existing pipe.

Equipment includes the supplied **accumulator, circulating pump, cooler, heater, reservoir, and control valve**, plus a bladder-accumulator reservoir, an N₂-connected reservoir, and a four-way pipe junction. The six supplied equipment types have compact palette icons and use their SVG artwork on the canvas. Place their ports manually like any other symbol.

Place equipment ports on the nozzles you want to use. Saved circulating pump symbols update to revised artwork while retaining manually placed ports and transformations.

## Undo and redo

Use **Undo** and **Redo** in the toolbar, **Ctrl/Cmd+Z** to undo, and **Ctrl/Cmd+Shift+Z** or **Ctrl+Y** to redo. The builder remembers up to 100 drawing edits during the current session.

Adding, deleting, connecting, inserting, moving, routing, transforming, recoloring, setting pipe direction, importing seal artwork, and editing captions or notes can be reversed. Deleting a symbol and its connected pipes is one action; dragging a symbol or pipe bend is one action; consecutive typing in one field is grouped into one edit. Pan, zoom, and selection do not add undo steps. A new edit after undo clears the redo history.

Keyboard shortcuts inside text fields retain the browser's normal text-editing behavior; use the toolbar to undo a drawing edit while a field is focused. History resets when starting a new drawing, opening a project, or reloading the page, and is not included in saved project JSON. Undo and redo autosave the restored drawing.

## Other controls

| Action | How |
| --- | --- |
| Add a port | Choose **+ Port**, then click any symbol's artwork. Works on transformed symbols too. |
| Remove a port | Select its symbol and click **Remove [port]** in Properties, or Alt-click the port. Connected pipes on that port are removed too. |
| Pan | Drag empty sheet space. |
| Zoom | Use the mouse wheel or the `−`, `100%`, and `+` buttons. |
| Cancel a connection, port placement, or insertion preview | Press Esc. |
| Delete a selected pipe or symbol | Press Delete/Backspace or use **Delete** in Properties. |

**Import seal SVG** replaces the selected seal, or adds a seal at the canvas center if no seal is selected. Imported artwork is stored on its own symbol. Replacement clears that seal's old ports and connected pipes; use **+ Port** to place new connection points. Older projects containing a globally imported seal remain supported.

Older saved drawings are converted once when opened: predefined ports on seals, instruments, and equipment, along with their connected pipes, are removed so all symbols can be ported manually. Drawings already converted to manual seal and instrument ports retain those ports while equipment ports are cleared. The original imported JSON file is unchanged. Before migrating a drawing restored from browser storage, the builder saves its original JSON in browser storage under `seal-loop-pid-v1-before-all-manual-ports`.

## Save and export

| Command | Result |
| --- | --- |
| **Save project** | Downloads editable JSON with symbols, ports, connections, routes, colors, transformations, captions, and notes. |
| **Open project** | Loads a saved project JSON. |
| **Export SVG** | Downloads a clean drawing with embedded SVG artwork and line colors, without the grid, handles, previews, or selection marks. |
| **Export PNG** | Downloads a raster image at twice the drawing's SVG dimensions. |

Browser storage is local and can be cleared; **Save project** is the portable backup. Drawings are not shared with colleagues or uploaded to a server. Exports of imported SVGs may depend on fonts or external references in those files.

## Project files and artwork updates

- `PID-Builder.html` — the complete offline application and embedded symbol artwork.
- `README.md` — usage instructions.
- `media/` — supplied source SVGs for dual seals and equipment, including `reservoir.svg` and `Control_valve.svg`.
- `scripts/embed-symbols.py` — rebuilds the embedded catalog from the source SVGs.
- `scripts/test-history.py` — Firefox regression tests for undo/redo, using only the Python standard library.

After editing a source SVG, update its recorded artwork bounds in the embedding script if its size or location changed, then run:

```sh
python3 scripts/embed-symbols.py
```

The script accepts SVG artwork with or without marked connection circles. New symbols receive ports manually. Reload the HTML after rebuilding. The original single seal is embedded separately and requires no external file.

## Verify undo and redo

With Python 3 and Firefox installed, run:

```sh
python3 scripts/test-history.py
```

The test starts a separate headless Firefox with a temporary profile. It checks restored drawing state, connections, colors, transformations, grouped edits, imports, keyboard shortcuts, and history limits without touching your normal browser profile.

## Current scope

This is a drawing prototype, not a validated P&ID or an API-plan generator. Routing does not automatically avoid symbols or other pipes. Automatic insertion currently supports instruments and pipe junctions.

Future improvements include more piping symbols and line types, collision-aware routing, and drawing validation.
