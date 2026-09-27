# Seal Loop P&ID Builder

A single-file HTML prototype for laying out a mechanical seal support loop. Drag instruments and equipment onto a drawing, connect their ports with orthogonal pipes, then export the result as SVG or PNG.

New drawings start with an **empty canvas**. Drag a mechanical seal, instrument, or equipment symbol from the palette to build a loop. The supplied SVG artwork is embedded in the HTML, so no separate image files are needed to open the builder.

## Run it

Open [`PID-Builder.html`](PID-Builder.html) in a desktop browser. No installation, server, account, or network connection is required.

If an earlier drawing appears because the browser restored it, use **New drawing** to start with an empty canvas. Save the existing drawing as a project first if you want to keep it.

## Build a loop

1. Drag a symbol from the left palette onto the sheet. Clicking a palette item places it near the center instead.
2. Click a `+` port on one symbol, then a `+` port on another to add a pipe. The visible `+` marks on the supplied artwork are clickable ports at their original locations.
3. Drag symbols to reposition them. Connected pipe endpoints follow.
4. Click a pipe to select it. Drag either turquoise bend handle to move its middle segment. In **Properties**, switch between a vertical and horizontal middle segment or recenter the bends.
5. Click blank space and edit the drawing title in **Properties**. Select a symbol to change its caption or add notes.

The mechanical seal palette includes the original single seal and all six dual seal arrangements:

| Arrangement | With plug seal (`w`) | Without plug seal (`wo`) |
| --- | --- | --- |
| Back-to-back (`bb`) | 4 ports | 2 ports |
| Face-to-face (`ff`) | 4 ports | 2 ports |
| Face-to-back (`fb`) | 4 ports | 2 ports |

Each seal has its own artwork and ports, so different seal types can coexist in one drawing. Seals can be moved, duplicated, and deleted like other symbols.

The palette also includes PI, PT, TI, TT, FI, FT, PDIT, the supplied accumulator, circulating pump, cooler, and heater, a bladder-accumulator reservoir, an N₂-connected reservoir, and a four-way pipe junction.

### Other controls

| Action | How |
| --- | --- |
| Add a seal port | Choose **+ Seal port**, then click the seal artwork. |
| Remove a port you added | Alt-click that port. The supplied artwork ports are protected. |
| Pan | Drag empty sheet space. |
| Zoom | Use the mouse wheel or the `−`, `100%`, and `+` buttons. |
| Cancel a pending connection or port placement | Press Esc. |
| Remove a selected pipe or symbol | Press Delete/Backspace or use **Delete** in Properties. |

## Save and export

| Command | Result |
| --- | --- |
| **Save project** | Downloads editable JSON with symbols, positions, ports, pipes, route settings, tags, and notes. |
| **Open project** | Loads a previously saved project JSON. |
| **Export SVG** | Downloads a clean drawing without the editor grid, handles, or selection marks. The supplied symbols retain their embedded SVG artwork. |
| **Export PNG** | Downloads a raster image at twice the drawing's SVG dimensions. |

The builder also attempts to restore the last drawing from this browser's local storage. **Save project** is the portable backup; browser storage is local to that browser and can be cleared. Project data is not shared with colleagues or stored on a server.

## Current scope

This is a drawing prototype, not a validated P&ID or an API-plan generator. Pipe routing has one adjustable middle segment per connection. It does not automatically avoid symbols or other pipes, and it has no undo history. You can add junctions where a branch is needed.

**Import seal SVG** replaces the selected seal, or adds a new seal at the canvas center if no seal is selected. Each imported image is saved on its own symbol. Replacing a seal clears its old ports and connected pipes; use **+ Seal port** to place ports on the new artwork. SVG/PNG export of imported artwork may depend on that SVG's fonts and external references. Older projects containing a single globally imported seal remain supported.

## Project files

- `PID-Builder.html` — the complete offline application, including the starter seal artwork and styles.
- `README.md` — these instructions.
- `media/` — supplied source SVGs for dual seals and equipment.
- `scripts/embed-symbols.py` — rebuilds the embedded catalog from the source SVGs (`python3 scripts/embed-symbols.py`). The script records artwork bounds and derives port coordinates from the marked circles; update the bounds if source artwork changes size or location.

The original `single_seal.svg` was used to create the embedded starter drawing. It is useful as the source artwork for later arrangements, but is not required alongside the HTML file.

## Next iterations

- Add more piping symbols and line types.
- Add adjustable waypoints and collision-aware routing where the single middle segment is insufficient.
- Add undo/redo and drawing validation before export.
