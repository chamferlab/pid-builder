// Symbol catalog and drawing constants.
// MEDIA_SYMBOLS and BUILTIN_TEMPLATES are injected above this file by scripts/build.py.

const NS = 'http://www.w3.org/2000/svg';
const STORAGE_KEY = 'seal-loop-pid-v1';
const LEGACY_BACKUP_KEY = 'seal-loop-pid-v1-before-all-manual-ports';
const SNAP_STORAGE = 'seal-loop-pid-snap-v1';
const GRID_SIZE = 25;
const HISTORY_LIMIT = 100;
const INK = '#253d51';
const DEFAULT_PIPE_COLOR = '#233b50';
const HOME_VIEW = {x: 0, y: 0, w: 1500, h: 900};

const PIPE_COLORS = {
  teal: {name: 'Teal', value: '#008080'},
  blue: {name: 'Blue', value: '#2563eb'},
  red: {name: 'Red', value: '#dc2626'},
  orange: {name: 'Orange', value: '#ea580c'}
};

const specs = {};
const INSTRUMENTS = {
  PI: {name: 'Pressure indicator', group: 'instrument', w: 90, h: 90},
  PT: {name: 'Pressure transmitter', group: 'instrument', w: 90, h: 90},
  TI: {name: 'Temperature indicator', group: 'instrument', w: 90, h: 90},
  TT: {name: 'Temperature transmitter', group: 'instrument', w: 90, h: 90},
  FI: {name: 'Flow indicator', group: 'instrument', w: 90, h: 90},
  FT: {name: 'Flow transmitter', group: 'instrument', w: 90, h: 90},
  LI: {name: 'Level indicator', group: 'instrument', w: 90, h: 90},
  LT: {name: 'Level transmitter', group: 'instrument', w: 90, h: 90},
  PDIT: {name: 'Differential pressure indicator / transmitter', group: 'instrument', w: 100, h: 90}
};
// Line fittings are drawn in code (05-symbols.js) because they turn with the pipe they sit in.
const FITTINGS = {
  'isolation-valve': {name: 'Isolation valve', detail: 'Inline shutoff valve', group: 'equipment', w: 96, h: 80, tag: 'ISOLATION VALVE', inline: true, ports: [{id: 'L', x: -48, y: 0}, {id: 'R', x: 48, y: 0}]},
  'check-valve': {name: 'Check valve', detail: 'One-way flow valve', group: 'equipment', w: 96, h: 80, tag: 'CHECK VALVE', inline: true, ports: [{id: 'L', x: -48, y: 0}, {id: 'R', x: 48, y: 0}]},
  drain: {name: 'Drain', detail: 'Line termination', group: 'equipment', w: 70, h: 90, tag: 'DRAIN', ports: [{id: 'P1', x: 0, y: -45}]},
  vent: {name: 'Vent', detail: 'Line termination', group: 'equipment', w: 70, h: 90, tag: 'VENT', ports: [{id: 'P1', x: 0, y: 45}]},
  junction: {name: 'Pipe junction', detail: 'Branch connection', group: 'equipment', w: 44, h: 44, tag: ''}
};
// Palette order: instruments, then seals and equipment from media/, then fittings.
Object.assign(specs, INSTRUMENTS, MEDIA_SYMBOLS, FITTINGS);
// Every seal on the sheet has kind 'seal' and names its drawing in sealVariant. This entry is
// the kind itself, used for imported artwork; it has no palette tile.
const DEFAULT_SEAL = 'single-seal';
specs.seal = {name: 'Mechanical seal', group: 'seal', w: specs[DEFAULT_SEAL].w, h: specs[DEFAULT_SEAL].h, tag: 'SEAL', hidden: true};

const JUNCTION_PORTS = [{id: 'L', x: -22, y: 0}, {id: 'R', x: 22, y: 0}, {id: 'T', x: 0, y: -22}, {id: 'B', x: 0, y: 22}];

// The ports a new symbol of this kind starts with, on the nozzles its artwork shows.
const defaultPorts = kind => structuredClone(specs[kind]?.ports || []);
const isInstrument = kind => specs[kind]?.group === 'instrument';
// Symbols that can be dropped onto a pipe to split it.
const isInsertable = kind => isInstrument(kind) || kind === 'junction' || !!specs[kind]?.inline;
