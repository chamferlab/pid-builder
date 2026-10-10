// Symbol catalog and drawing constants.
// MEDIA_SYMBOLS and DEFAULT_SEAL_MARKUP are injected above this file by scripts/build.py.

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

const specs = {
  PI: {name: 'Pressure indicator', group: 'instrument', w: 90, h: 90},
  PT: {name: 'Pressure transmitter', group: 'instrument', w: 90, h: 90},
  TI: {name: 'Temperature indicator', group: 'instrument', w: 90, h: 90},
  TT: {name: 'Temperature transmitter', group: 'instrument', w: 90, h: 90},
  FI: {name: 'Flow indicator', group: 'instrument', w: 90, h: 90},
  FT: {name: 'Flow transmitter', group: 'instrument', w: 90, h: 90},
  PDIT: {name: 'Differential pressure indicator / transmitter', group: 'instrument', w: 100, h: 90},
  bladder: {name: 'Reservoir + bladder accumulator', group: 'equipment', w: 170, h: 215, tag: 'BLADDER'},
  nitrogen: {name: 'Reservoir + N₂ top connection', group: 'equipment', w: 170, h: 215, tag: 'N₂ RESERVOIR'},
  cooler: {name: 'Dual-coil cooler', group: 'equipment', w: 190, h: 150, tag: 'COOLER'},
  'air-driven-pump': {name: 'Air driven pump', detail: 'Air operated pump', group: 'equipment', w: 170, h: 150, tag: 'AIR PUMP'},
  'isolation-valve': {name: 'Isolation valve', detail: 'Inline shutoff valve', group: 'equipment', w: 96, h: 80, tag: 'ISOLATION VALVE', inline: true},
  'check-valve': {name: 'Check valve', detail: 'One-way flow valve', group: 'equipment', w: 96, h: 80, tag: 'CHECK VALVE', inline: true},
  drain: {name: 'Drain', detail: 'Line termination', group: 'equipment', w: 70, h: 90, tag: 'DRAIN'},
  vent: {name: 'Vent', detail: 'Line termination', group: 'equipment', w: 70, h: 90, tag: 'VENT'},
  junction: {name: 'Pipe junction', detail: 'Branch connection', group: 'equipment', w: 44, h: 44, tag: ''}
};
Object.assign(specs, MEDIA_SYMBOLS);
// The single seal uses the original embedded vector artwork rather than a media file.
specs.seal = {name: 'Single seal', detail: 'Original artwork', group: 'seal', w: 455, h: 500, tag: 'SINGLE SEAL'};

const JUNCTION_PORTS = [{id: 'L', x: -22, y: 0}, {id: 'R', x: 22, y: 0}, {id: 'T', x: 0, y: -22}, {id: 'B', x: 0, y: 22}];

const isInstrument = kind => specs[kind]?.group === 'instrument';
// Symbols that can be dropped onto a pipe to split it.
const isInsertable = kind => isInstrument(kind) || kind === 'junction' || !!specs[kind]?.inline;
