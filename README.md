# Seal Loop P&ID Builder

An offline, single-file HTML prototype for drawing mechanical seal support loops. Start with an empty canvas, drag in symbols, connect their ports with orthogonal pipes, and export the drawing as SVG or PNG. Supplied SVG artwork is embedded in the HTML.

## Run it

Open [`PID-Builder.html`](PID-Builder.html) in a desktop browser. No installation, server, account, or network connection is required.

The browser restores the last drawing automatically. Choose **New drawing** for an empty canvas; save your existing drawing first if you want to keep it. After updating the HTML, reload the page to use the latest controls and symbols.

## Build a loop

1. Drag a symbol from the left palette onto the sheet. Clicking a palette item places it at the canvas center.
2. Click a `+` port on one symbol, then a `+` port on another to create a pipe. The visible `+` marks on the supplied artwork are clickable connection points.
3. Drag symbols to reposition them. Connected pipe endpoints follow.
4. Select a pipe and drag either turquoise bend handle to move its middle segment. **Properties** also lets you change the segment between vertical and horizontal or recenter the bends.
5. Select a symbol to edit its caption or notes. Click blank space to edit the drawing title.

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

## Symbol palette

The mechanical seal palette includes the original four-port single seal and six dual seal variants:

| Arrangement | With plug seal (`w`) | Without plug seal (`wo`) |
| --- | --- | --- |
| Back-to-back (`bb`) | 4 ports | 2 ports |
| Face-to-face (`ff`) | 4 ports | 2 ports |
| Face-to-back (`fb`) | 4 ports | 2 ports |

Each seal has its own artwork and ports, so different types can coexist in one drawing. Seals can be moved, transformed, duplicated, and deleted.

Instrumentation includes **PI, PT, TI, TT, FI, FT, and PDIT**.

Equipment includes the supplied **accumulator, circulating pump, cooler, heater, reservoir, and control valve**, plus a bladder-accumulator reservoir, an N₂-connected reservoir, and a four-way pipe junction. The six supplied equipment types have compact palette icons and use their SVG artwork on the canvas.

The reservoir has three top ports and two side ports. The control valve has two line ports and a top actuator port. Saved circulating pump symbols update to the revised artwork and port positions while retaining port IDs, connections, and transformations.

## Other controls

| Action | How |
| --- | --- |
| Add a seal port | Choose **+ Seal port**, then click the seal artwork. Works on transformed seals too. |
| Remove an added port | Alt-click it. Supplied artwork ports are protected. |
| Pan | Drag empty sheet space. |
| Zoom | Use the mouse wheel or the `−`, `100%`, and `+` buttons. |
| Cancel a connection, port placement, or insertion preview | Press Esc. |
| Delete a selected pipe or symbol | Press Delete/Backspace or use **Delete** in Properties. |

**Import seal SVG** replaces the selected seal, or adds a seal at the canvas center if no seal is selected. Imported artwork is stored on its own symbol. Replacement clears that seal's old ports and connected pipes; use **+ Seal port** to place new connection points. Older projects containing a globally imported seal remain supported.

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

After editing a source SVG, update its recorded artwork bounds in the embedding script if its size or location changed, then run:

```sh
python3 scripts/embed-symbols.py
```

The script derives connection points from the marked circles and checks the port mapping. Reload the HTML after rebuilding. The original single seal is embedded separately and requires no external file.

## Current scope

This is a drawing prototype, not a validated P&ID or an API-plan generator. Pipes have one adjustable middle segment per connection. Routing does not automatically avoid symbols or other pipes, and there is no undo history. Automatic insertion currently supports instruments and pipe junctions.

Future improvements include more piping symbols and line types, adjustable waypoints, collision-aware routing, undo/redo, and drawing validation.
