# Seal Loop P&ID Builder

A single-file HTML prototype for laying out a mechanical seal support loop. Drag instruments and equipment onto a drawing, connect their ports with orthogonal pipes, then export the result as SVG or PNG.

The starter drawing contains the supplied **single seal** cross section. Its four visible `+` marks are clickable connection ports. The seal artwork is embedded as vector paths, so no separate image file is needed to open the builder.

## Run it

Open [`PID-Builder.html`](PID-Builder.html) in a desktop browser. No installation, server, account, or network connection is required.

If an earlier drawing appears because the browser restored it, use **New drawing** to start with the four-port single seal. Save the existing drawing as a project first if you want to keep it.

## Build a loop

1. Drag a symbol from the left palette onto the sheet. Clicking a palette item places it near the center instead.
2. Click a `+` port on one symbol, then a `+` port on another to add a pipe. The four `+` marks on the starter seal are its ports.
3. Drag symbols to reposition them. Connected pipe endpoints follow.
4. Click a pipe to select it. Drag either turquoise bend handle to move its middle segment. In **Properties**, switch between a vertical and horizontal middle segment or recenter the bends.
5. Click blank space and edit the drawing title in **Properties**. Select a symbol to change its caption or add notes.

The palette currently includes PI, PT, TI, TT, FI, FT, PDIT, a bladder-accumulator reservoir, an N₂-connected reservoir, a dual-coil cooler, and a four-way pipe junction.

### Other controls

| Action | How |
| --- | --- |
| Add a seal port | Choose **+ Seal port**, then click the seal artwork. |
| Remove a port you added | Alt-click that port. The four starter ports are protected. |
| Pan | Drag empty sheet space. |
| Zoom | Use the mouse wheel or the `−`, `100%`, and `+` buttons. |
| Cancel a pending connection or port placement | Press Esc. |
| Remove a selected pipe or non-seal symbol | Press Delete/Backspace or use **Delete** in Properties. |

## Save and export

| Command | Result |
| --- | --- |
| **Save project** | Downloads editable JSON with symbols, positions, ports, pipes, route settings, tags, and notes. |
| **Open project** | Loads a previously saved project JSON. |
| **Export SVG** | Downloads a clean drawing without the editor grid, handles, or selection marks. The supplied seal remains vector artwork. |
| **Export PNG** | Downloads a raster image at twice the drawing's SVG dimensions. |

The builder also attempts to restore the last drawing from this browser's local storage. **Save project** is the portable backup; browser storage is local to that browser and can be cleared. Project data is not shared with colleagues or stored on a server.

## Current scope

This is a drawing prototype, not a validated P&ID or an API-plan generator. Pipe routing has one adjustable middle segment per connection. It does not automatically avoid symbols or other pipes, and it has no undo history. You can add junctions where a branch is needed.

**Import seal SVG** replaces the displayed seal artwork with another SVG. Imported artwork is kept as an embedded image inside the drawing; only the supplied starter seal is inserted as editable vector paths. The import currently retains the existing port coordinates, so they may not line up with a different arrangement. You can add ports with **+ Seal port**; proper per-arrangement port mapping is planned for a later iteration. SVG/PNG export of imported artwork may depend on that SVG's fonts and external references.

## Project files

- `PID-Builder.html` — the complete offline application, including the starter seal artwork and styles.
- `README.md` — these instructions.

The original `single_seal.svg` was used to create the embedded starter drawing. It is useful as the source artwork for later arrangements, but is not required alongside the HTML file.

## Next iterations

- Add selectable seal arrangements with defined port locations.
- Add more piping symbols and line types.
- Add adjustable waypoints and collision-aware routing where the single middle segment is insufficient.
- Add undo/redo and drawing validation before export.
