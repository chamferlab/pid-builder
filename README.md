# Seal Loop P&ID Builder

An offline, single-file HTML prototype for drawing mechanical seal support loops. Start with an empty canvas, drag in symbols, connect them with orthogonal pipes, number the instruments, keep recurring arrangements as templates, and export the drawing with its frame and title block as SVG, PNG, or PDF. All artwork is embedded in the HTML.

## Run it

Open [`PID-Builder.html`](PID-Builder.html) in a desktop browser. No installation, server, account, or network connection is required. To share it with colleagues from one computer, see [Host it for colleagues](#host-it-for-colleagues).

The browser restores the last drawing automatically. Choose **New** for an empty canvas; save your existing drawing first if you want to keep it. After updating the HTML, reload the page to use the latest controls and symbols.

## Build a loop

1. Drag a symbol from the left palette onto the sheet. Clicking a palette item places it at the center of the view. Use the search box to filter the palette.
2. Choose **Pipe** (or press **P**), click where the pipe starts, then click where it ends. Equipment and fittings already have a port on each nozzle; click one to use it. Clicking anywhere else on a symbol creates a port at that point. The pipe is routed between the two ports. The Pipe tool stays active so you can keep connecting; press **Esc** when done.
3. Drag symbols to reposition them. Connected pipes follow and re-route, and guide lines appear when a symbol lines up with another.
4. Drop a valve, instrument, or junction onto a pipe to insert it. Alt-drag it off the pipe to take it out again.
5. Select a pipe to set its line data, color, flow arrow, and route. Select a symbol to edit its caption, notes, size, and orientation, and an instrument's tag number.
6. Click blank space to fill in the title block and manage templates. Select a group you will need again and choose **Save as template**.

### Connecting

- **Pipe tool:** click a symbol or an existing port to start, click another symbol or port to finish.
- **Drag:** in the Select tool, press an existing port and release over another port or symbol.
- **Click-click:** click a port, then click another port or symbol.
- **Tee into a pipe:** with the Pipe tool, click a pipe to start or end there. A junction is inserted at that point and the new pipe branches from the side facing its other end. Clicking an existing junction uses one of its free sides. The pipe needs a straight run of about 70 units at the point you click.
- **+ Port** places a port without drawing a pipe. Ports are stored where you click, so place them on the nozzle you mean.

Pipes cannot connect a symbol to itself. A port shows as a small filled dot once a pipe is attached.

### Connection labels

Select a symbol and type a label next to a port under **Properties → Connection ports**; it is drawn beside the port on the sheet and in SVG, PNG, and PDF exports. On a seal the field suggests the usual connection codes, and any other text can be typed instead:

| Code              | Connection                        | Code              | Connection                    |
|-------------------|-----------------------------------|-------------------|-------------------------------|
| **F**             | Flush                             | **Q**             | Quench                        |
| **FI** / **FO**   | Flush in / out                    | **D**             | Drain                         |
| **LBI** / **LBO** | Liquid buffer or barrier in / out | **V**             | Vent                          |
| **GBI** / **GBO** | Gas buffer or barrier in / out    | **CSV** / **CSD** | Containment seal vent / drain |
| **C**             | Cooling                           | **H**             | Heating                       |

Labels are text only: they do not move a port, check which way a pipe flows, or stop two ports carrying the same code. Equipment ports can be labelled the same way, for example a reservoir's supply and return. Labels are kept in saved projects and templates, and follow the port when the symbol is rotated or mirrored. The built-in seal plans come without labels.

### Pipe routes

New pipes are routed automatically: they leave each port outward from the side of the symbol it sits on, and go around symbols instead of through them. Automatic routes update as you move things.

Pipes also make room for each other. Where an automatic route would run on top of another pipe, or closer than 14 units beside it, its inner runs move aside a gap at a time, to the side with fewer crossings. Pipes whose route you have set stay exactly where they are, and automatic pipes are placed around them in the order they were drawn. The runs that meet a port cannot move, so two pipes leaving ports that are in line with each other can still overlap; move a symbol or add a bend there.

Where a horizontal run crosses another pipe's vertical run, it is drawn with a small hop, on screen and in exports. A tee is a junction, not a crossing, and has no hop.

Select a pipe to adjust it. Drag the handles on the pipe, or use **Properties → Route**:

| Control                            | Result                                                                                |
|------------------------------------|---------------------------------------------------------------------------------------|
| **Automatic**                      | Hands the route back to the automatic router.                                         |
| **+ Add bend**                     | Adds a draggable bend on the longest straight segment. Alt-click a bend to remove it. |
| **Corner** (two directions)        | A single corner. Click the handle on the pipe to flip it.                             |
| **Middle** (vertical / horizontal) | Three segments with a draggable middle segment.                                       |
| **Center the middle segment**      | Three segments with the middle halfway between the ports.                             |

Dragging a handle on an automatic route keeps the shape you set: a straight or three-segment route gets a fixed middle segment, any other shape has its corners turned into bends.

### Select and align several symbols

Click a symbol, then **Shift-click** others to add or remove them from the selection. **Shift-drag** on blank sheet selects every symbol the rectangle touches. **Ctrl/Cmd+A** selects all symbols. Arrow keys nudge the selection by one unit, or one grid step with Shift. Drag any selected symbol to move the group; connected pipe endpoints follow. If a pipe connects two selected symbols, its route moves with the group too.

With several symbols selected, use **Properties → Align symbols** to align their left edges, horizontal centers, right edges, top edges, vertical centers, or bottom edges. The first selected symbol is the reference and stays in place. Alignment uses the visible symbol bounds, including rotation and size.

**Duplicate** (or **Ctrl/Cmd+D**) copies the symbols and any pipes between them, offset as a group. **Delete** removes the group and its connected pipes; a single valve, instrument, or two-way junction sitting in a line is taken out of the line instead, and the line stays. Group moves, alignment, duplication, and deletion each form one undo step.

### Alignment guides

While you drag a symbol or a group, it catches on nearby alignments with the other symbols and a pink guide line shows what it lined up with. Like aligns with like: a port with a port (solid line), a center with a center, or an edge with an edge (dashed lines). Lining up two ports is what makes the pipe between them straight. Ports win when two alignments are equally close. The catch distance is 6 screen pixels, so zoom in for finer placement.

Hold **Alt** to drag without guides. The guides are off while **Snap to grid** is on, and while a symbol is being dropped into a pipe.

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
- To take a symbol out of its line, hold **Alt** and drag it off the pipe, or select it and press **Delete**. The two sections become one pipe again, keeping the line's number, color, flow arrow, and bends. The symbol is left unconnected and can be dropped onto another pipe, even in the same drag. Alt also suspends snapping, so a connected inline symbol cannot be Alt-dragged to an off-grid position.
- Both resulting pipe sections inherit the original line color.
- Inserting a symbol fixes the pipe's bends where they were, so the two sections no longer move aside for other pipes; choose **Route → Automatic** on a section to hand it back.

### Resize, rotate, and mirror

Select any symbol and use **Properties**:

| Control                              | Result                                                                                                                              |
|--------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------|
| **Size (%)**                         | Scales the symbol uniformly from 25% to 300%.                                                                                       |
| **Rotate left / right 90°**          | Rotates the artwork and its ports around the symbol center. **R** rotates right, **Shift+R** left.                                  |
| **Mirror horizontally / vertically** | Reflects the artwork and ports in the chosen canvas direction.                                                                      |
| **Reset**                            | Restores the original size and clears rotation and mirroring.                                                                       |
| **Duplicate**                        | Copies artwork, ports, captions, notes, size, rotation, and mirroring. A numbered instrument's copy takes the next free tag number. |

Attached pipe endpoints follow the transformed ports. Instrument labels and captions stay upright. Transformations are retained in saved projects and exports.

### Line colors

Select a pipe and pick a swatch under **Properties → Appearance**: the default dark line, **Teal**, **Blue**, **Red**, or **Orange**. Colors persist in saved projects and SVG, PNG, and PDF exports.

### Line data

Select a pipe and fill in **Line number**, **Size**, **Service**, and **Piping spec** in Properties. These are free-text fields so you can use your project's own units and naming convention. A line number appears next to the pipe and in SVG, PNG, and PDF exports. All four fields are saved in project JSON and can be undone or redone.

Inserting an instrument, valve, or junction splits a pipe into segments of the same logical line. Editing line data on either segment updates every segment of that line. Duplicating a group of symbols copies their internal pipes into a separate logical line with the same field values. Separately drawn pipes remain separate lines even if you type the same line number on them.

### Instrument air lines

Select a pipe and choose **Properties → Appearance → Instrument air** for a dashed line. Choose **Solid** to restore the solid line. The line type can be combined with any line color or flow direction and is retained in saved projects and SVG, PNG, and PDF exports. Existing pipes remain solid. Inserting an instrument or junction into an instrument air line carries the dashed style onto both new sections.

### Pipe flow direction

Select a pipe and choose **Properties → Flow arrow** to show an arrow from its first connected port to its second, reverse the arrow, or remove it. The panel names both ports. The arrow follows the pipe's longest straight segment when you move symbols or bends, matches the line color, and appears in saved projects and SVG, PNG, and PDF exports. Existing pipes have no arrow until you set one. Inserting an instrument or junction into a directed pipe carries its direction onto both new sections.

## Seal plans

The **Seal plans** section at the top of the palette holds ready-made loops: click or drag one onto the sheet and you get the seal, equipment, instruments, and piping already connected.

| Plan         | What is placed                                                                                                 |
|--------------|----------------------------------------------------------------------------------------------------------------|
| **Plan 52**  | Face-to-back dual seal, buffer reservoir, vent line to flare with valve and PT, LT on the reservoir.           |
| **Plan 53A** | Back-to-back dual seal, barrier reservoir with N₂ supply valve and PI, LT on the reservoir.                    |
| **Plan 53B** | Back-to-back dual seal, TI on the outlet, cooler, bladder accumulator on an isolation valve, PI on the return. |
| **Plan 54**  | Back-to-back dual seal, TI and valve to the external barrier system, valve and PI from it.                     |

These are starting points drawn from the general arrangement of each plan, not checked against API 682 or a project standard. They contain only symbols the palette has, so there is no orifice, pressure relief, or fill connection, and the seal ports are placed on top of the gland rather than on real connection positions. A placed plan is ordinary drawing content: change it freely, and select it and choose **Save as template** to keep your version. The built-in plans themselves cannot be edited, renamed, or deleted in the application.

To change what ships in the HTML, replace or add files in `src/templates/` and rebuild. Each file is a template export from the application (`seal-loop-templates.json`), so you can build your plans on the sheet, save them as templates, export, and drop the file there. Files are read in filename order, and a plan with the name of an earlier one replaces it, so your own **Plan 53B** takes the place of the draft in `00-draft-plans.json`. A template's optional `detail` text is the second line on its tile.

## Templates

A template is a piece of drawing you keep for reuse: symbols with their ports, and the pipes between them, for example a dual seal with its cooler.

| To                  | Do this                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
|---------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Create a template   | Select the symbols (Shift-drag an area, or Ctrl+A), choose **Save as template** in Properties, and name it. Pipes are kept when both ends are in the selection. Saving under an existing name replaces that template.                                                                                                                                                                                                                                                                               |
| Use it              | Click its tile under **My templates** in the palette, or drag the tile onto the sheet. The copy is ordinary drawing content; instruments in it take the next free tag numbers.                                                                                                                                                                                                                                                                                                                      |
| Change it           | With nothing selected, find it under **Properties → Templates** and choose **Edit**. The template opens as a drawing of its own and the drawing you were working on is set aside. **Save template** replaces the template, **Save as new template** leaves it as it was and saves the sheet as another one, and **Close without saving** discards the changes; each brings your drawing back. The title is the template's name, so changing it and choosing **Save template** renames the template. |
| Rename or delete it | Use the name field and the × button in the same list. Drawings that already used the template are not affected.                                                                                                                                                                                                                                                                                                                                                                                     |
| Back up or share    | **Export** downloads every template as `seal-loop-templates.json`; **Import** adds the templates in such a file, replacing those with the same name.                                                                                                                                                                                                                                                                                                                                                |

Templates are stored in the browser, next to the autosaved drawing. They belong to that browser and to the location of `PID-Builder.html`: another browser, another computer, a moved file, or cleared site data starts with none. The exported file is the backup.

## Frame and title block

A new drawing has a frame and a title block in its bottom-right corner. With nothing selected, **Properties** holds the title, drawing number, revision, date, and author, and a checkbox to turn the frame off. The frame on screen is the exported sheet: it starts at 1500 × 900 and grows to hold everything drawn, and it gets taller rather than letting the title block cover a symbol. Text too long for its cell is cut short with an ellipsis. Drawings saved before this existed open without a frame; tick the checkbox to add one.

## Symbol palette

The mechanical seal palette includes a single seal and six dual seal variants: back-to-back, face-to-face, and face-to-back, each with or without a plug seal. Seals start without connection ports; the Pipe tool adds them where you click.

Each seal has its own artwork, so different types can coexist in one drawing. Any `+` marks still printed in artwork are only placement guides; click them with the Pipe tool to make real connection points. Seals can be moved, transformed, duplicated, and deleted.

Instrumentation includes **PI, PT, TI, TT, FI, FT, LI, LT, and PDIT**. Each new instrument is numbered per type, starting at 101 (PI-101, PI-102, TT-101), and the number is drawn in the bubble under the type letters. Select an instrument to change the number in **Properties → Tag number**, for example to give a PI and PT the same loop number; clear it to show the letters alone. Instruments in drawings saved before numbering existed stay unnumbered until you give them one. New instruments also start without ports. Inline insertion creates the two line ports required to split an existing pipe.

Equipment includes a **reservoir**, **reservoir with N₂ top connection**, **accumulator**, **cooler**, **cooler with two coils**, **heater**, **circulating pump**, **air driven pump**, and **dome-loaded pressure control valve**. Line fittings are an **isolation valve**, **check valve**, **drain**, **vent**, and a pipe junction.

All equipment is drawn as one set: the same dark line weight as the instruments and fittings, with light tints taken from the seal artwork — blue for liquid, yellow for gas, orange for heat. Each symbol is an SVG in `media/`, drawn at canvas scale (one SVG unit is one drawing unit, and the `viewBox` is the symbol's box), so you can open it in Inkscape, edit it, and rebuild. A new piece of equipment has a port at the open end of each nozzle drawn in its artwork; you can remove those you do not need and add others anywhere. The accumulator has one port, at the bottom; its top is the gas charging valve. The heater's side lead is electrical and has no port.

Valves have a port at each end; dropping one onto a pipe connects both automatically. Drains and vents are terminal symbols with a single port. Only newly placed symbols get these ports: equipment in existing drawings and templates keeps the ports it has.

Drawings saved with earlier equipment artwork open with the new symbols. Where a symbol changed size, its ports keep their relative positions, so check that they still sit on the nozzle you meant.

## Undo and redo

Use **Undo** and **Redo** in the toolbar, **Ctrl/Cmd+Z** to undo, and **Ctrl/Cmd+Shift+Z** or **Ctrl+Y** to redo. The builder remembers up to 100 drawing edits during the current session.

Adding, deleting, connecting, inserting, taking a symbol out of a line, placing a template, moving, routing, transforming, recoloring, setting pipe direction, editing line data, tag numbers, and title block fields, importing seal artwork, and editing captions or notes can be reversed. Deleting a symbol and its connected pipes is one action; dragging a symbol or pipe bend is one action; consecutive typing in one field is grouped into one edit. Pan, zoom, and selection do not add undo steps. A new edit after undo clears the redo history.

Keyboard shortcuts inside text fields retain the browser's normal text-editing behavior; use the toolbar to undo a drawing edit while a field is focused. The template library is not part of the history: saving, renaming, and deleting a template cannot be undone. History resets when starting a new drawing, opening a project, opening or closing a template for editing, or reloading the page, and is not included in saved project JSON. Undo and redo autosave the restored drawing.

## Other controls

| Action                                                    | How                                                                                                                                                                                       |
|-----------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Add a port                                                | Equipment and fittings come with ports on their nozzles. For any other point, use the **Pipe** tool, or choose **+ Port** and click a symbol. Works on transformed symbols too.           |
| Take a symbol out of a line                               | Alt-drag a valve, instrument, or two-way junction off the pipe, or select it and press Delete. The two sections become one pipe again and keep the line's number, colour, and flow arrow. |
| Remove a port                                             | Select its symbol and click the × next to the port in Properties, or Alt-click the port. Connected pipes on that port are removed too.                                                    |
| Pan                                                       | Drag empty sheet space, or drag with the middle mouse button.                                                                                                                             |
| Zoom                                                      | Use the mouse wheel or the `−`, `%`, and `+` buttons. **Fit** (or **F**) shows the whole sheet when the frame is on, otherwise everything drawn.                                          |
| Cancel a connection, port placement, or insertion preview | Press Esc.                                                                                                                                                                                |
| Delete a selected pipe or symbol                          | Press Delete/Backspace or use **Delete** in Properties. Deleting a symbol removes its pipes, except for an inline symbol, whose line is rejoined.                                         |
| Select several symbols                                    | Shift-click symbols, Shift-drag an area, or press Ctrl/Cmd+A to select all.                                                                                                               |
| Switch tools                                              | **V** Select, **P** Pipe, **Esc** back to Select.                                                                                                                                         |

**Import seal SVG** replaces the selected seal, or adds a seal at the canvas center if no seal is selected. Imported artwork is stored on its own symbol. Replacement clears that seal's old ports and connected pipes; use **+ Port** to place new connection points. Older projects containing a globally imported seal remain supported.

Older saved drawings are converted once when opened: predefined ports on seals, instruments, and equipment, along with their connected pipes, are removed so all symbols can be ported manually. Drawings already converted to manual seal and instrument ports retain those ports while equipment ports are cleared. The original imported JSON file is unchanged. Before migrating a drawing restored from browser storage, the builder saves its original JSON in browser storage under `seal-loop-pid-v1-before-all-manual-ports`.

## Save and export

| Command                         | Result                                                                                                                                                                                                                                                                                                                                                           |
|---------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Save project**                | Downloads editable JSON with symbols, ports, connections, routes, line data, colors, transformations, captions, tag numbers, notes, and the title block fields. Templates are not in it; they have their own export.                                                                                                                                             |
| **Open project**                | Loads a saved project JSON.                                                                                                                                                                                                                                                                                                                                      |
| **Export SVG**                  | Downloads a clean drawing with embedded SVG artwork, line colors, crossing hops, and the frame and title block when they are on, without the grid, handles, previews, or selection marks.                                                                                                                                                                        |
| **Export PNG**                  | Downloads a raster image of the same sheet at twice the SVG dimensions.                                                                                                                                                                                                                                                                                          |
| **Export PDF**                  | Downloads a one-page PDF of the same sheet. The page has the sheet's proportions, 397 × 238 mm for the starting sheet, so print it with "fit to page" on A3 or A4 landscape. The drawing is stored as an image at about 290 dpi (less on a very large sheet), not as vector lines, so text in it cannot be selected or searched; use the SVG where that matters. |
| **Templates → Export / Import** | Downloads or loads the template library as `seal-loop-templates.json`. See [Templates](#templates).                                                                                                                                                                                                                                                              |

Browser storage is local and can be cleared; **Save project** is the portable backup of a drawing, and the template export is the backup of your templates. Drawings are not shared with colleagues or uploaded to a server. Exports of imported SVGs may depend on fonts or external references in those files.

## Host it for colleagues

The application is one page with no server side, so hosting it means handing out `PID-Builder.html` from a computer that stays on. `scripts/serve.py` does that with Python alone. Everyone who opens the address gets the same builder; each person's drawings and templates stay in their own browser, and nothing they draw is sent to the host.

### 1. Prepare the host computer

1. Pick a computer that stays on during working hours and is on the same network as the people who will use it. Note its name (`hostname` in a terminal) or ask IT for a fixed address for it.
2. Install Python 3.8 or later if it is missing: from [python.org](https://www.python.org/downloads/) on Windows (tick **Add python.exe to PATH**), or with the package manager on Linux. Nothing else is needed.
3. Put the project on it: `git clone https://github.com/chamferlab/pid-builder.git`, or download the ZIP from GitHub and unpack it. A stable place such as `C:\pid-builder` or `/opt/pid-builder` is best. Only `PID-Builder.html` and the `scripts/` folder are used, in those places relative to each other.

### 2. Start it and try it

```sh
./scripts/run_app.sh --lan          # Windows: scripts\run_app.bat --lan, or double-click it
```

It prints the addresses, for example `http://pc-0123:8080/`. Open the `localhost` one on the host first, then the network one from another computer. Add `--port 9000` to use another port. Without `--lan` the builder is served to the host only, which is handy for a quick check.

### 3. Open the firewall

If the page opens on the host but not from another computer, the host's firewall is blocking the port.

- **Windows:** choose **Allow** for private networks when the prompt appears on first start, or run once in an administrator PowerShell: `New-NetFirewallRule -DisplayName "Seal Loop PID Builder" -Direction Inbound -Protocol TCP -LocalPort 8080 -Action Allow -Profile Domain,Private`
- **Linux (ufw):** `sudo ufw allow 8080/tcp`

On a managed work computer this step, and running a server at all, usually needs IT's agreement; ask before you start.

### 4. Start it automatically

- **Windows:** Task Scheduler → **Create Task** → trigger **At startup** → action **Start a program**: program `C:\pid-builder\scripts\run_app.bat`, arguments `--lan`, start in `C:\pid-builder`. Tick **Run whether user is logged on or not**.
- **Linux:** save this as `/etc/systemd/system/pid-builder.service`, with your own user name, then run `sudo systemctl enable --now pid-builder`:

  ```ini
  [Unit]
  Description=Seal Loop P&ID Builder
  After=network-online.target
  
  [Service]
  User=YOUR_USER
  WorkingDirectory=/opt/pid-builder
  ExecStart=/usr/bin/python3 scripts/serve.py --lan
  Restart=on-failure
  
  [Install]
  WantedBy=multi-user.target
  ```

### 5. Tell people the address

Give them `http://HOST:8080/` to bookmark. A current Firefox, Chrome, or Edge on a desktop is needed. Tell them two things:

- **Save project** is their backup and the way to hand a drawing to someone else; the same goes for the template export.
- Their drawings belong to that address in that browser. If the host's name, address, or port changes, the builder opens empty for everyone, so have them save first and keep the address fixed.

### 6. Update it

Run `git pull` in the folder, or replace `PID-Builder.html` with the new one. The server does not need a restart, and people get the new version when they reload the page. Their stored drawings are kept.

### What this is and is not

- It is plain HTTP for a trusted office network. Do not expose the port to the internet.
- There are no accounts and no shared storage: people cannot see or edit each other's drawings, and the host holds no drawings to back up.
- Any other web server works as well: publish `PID-Builder.html` under the name `index.html` on IIS, nginx, or a SharePoint or intranet file area that serves HTML.

## Project files and development

`PID-Builder.html` is generated. Edit the sources and rebuild; do not edit the HTML by hand.

- `PID-Builder.html` — the complete offline application, built from the files below.
- `src/index.html`, `src/styles.css` — page layout and styling.
- `src/js/` — the application, concatenated in filename order into one script: `01-catalog` (symbols and constants), `02-state` (drawing state, undo, autosave), `03-geometry`, `04-routing` (pipe routes), `05-symbols` (built-in artwork), `06-render`, `07-inspector` (Properties panel), `08-actions` (edits), `09-interactions` (pointer and keyboard), `10-io` (save, open, import, SVG/PNG/PDF export), `10-templates` (template library, editing, and its file), `11-main` (palette and startup).
- `media/` — source SVGs for the seals and all equipment.
- `src/templates/` — template files built into the HTML as the seal plans.
- `scripts/build.py` — builds `PID-Builder.html`; standard library only.
- `scripts/test-app.py` — Firefox regression tests; standard library only.
- `scripts/serve.py` — serves the HTML, to the local network with `--lan`; standard library only. `scripts/run_app.sh` and `scripts/run_app.bat` start it. See [Host it for colleagues](#host-it-for-colleagues).

```sh
python3 scripts/build.py      # after editing src/ or media/
python3 scripts/test-app.py   # needs Firefox
```

After editing an SVG in `media/`, rebuild and reload the page. Equipment needs nothing else. The seal drawings sit on a larger Inkscape page and are cropped using the bounds recorded in `BOUNDS` in `scripts/build.py`; update those if a seal's size or position on its page changes. To add an equipment symbol, add its SVG to `media/`, an entry to `EQUIPMENT` in the build script, and its nozzle ends to `PORTS` there. `PORTS` lists each symbol's default ports in the SVG's own coordinates; update it when you move a nozzle.

The tests start a separate headless Firefox with a temporary profile, so your normal browser profile is untouched. They cover undo and redo, saved-project migration, inline insertion and removal, line data, snapping, export, the Pipe tool, automatic routing, area selection, keyboard editing, instrument tag numbers, the frame and title block, PDF and PNG export, templates, default ports, port labels, alignment guides, pipe spacing, crossing hops, and the built-in seal plans. The PDF and PNG exports are checked on the framed sheet. Dragging a template tile onto the sheet is not covered.

## Current scope

This is a drawing prototype, not a validated P&ID or an API-plan generator. Known limits:

- Automatic pipes keep clear of other pipes only along their inner runs, and take the first clear position rather than the best overall arrangement; a crowded drawing still needs some routes set by hand. Drawings saved earlier may show automatic routes shifted by a gap where they used to overlap.
- Seals and instruments start without ports. Default equipment ports are listed by hand in the build script, so they can drift from the artwork if a nozzle is moved.
- Tag numbers run per instrument type; instruments of one loop share a number only if you set it.
- Templates live in one browser and travel only through their export file.
- The PDF holds the sheet as an image rather than vector artwork.
- The equipment symbols follow common conventions but have not been checked against a drawing standard.

## Next steps

Next: **review of the built-in seal plans** against the arrangements actually used, and the symbols they lack (orifice, relief valve, fill connection).

Smaller items: line size and spec shown on the pipe, a legend generated from the symbols used, more title block fields, and drawing validation.