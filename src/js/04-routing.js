// Orthogonal pipe routes.
//
// A pipe's stored route is one of:
//   undefined / {waypoints: []}   automatic: leaves each port outward and steers around symbols
//   {axis, value}                 three segments with a movable middle segment at x or y = value
//   {elbow: 'horizontal'|'vertical'}   a single corner
//   {waypoints: [{x, y}, ...]}    fixed bends the route passes through

const DIRS = {L: {x: -1, y: 0}, R: {x: 1, y: 0}, T: {x: 0, y: -1}, B: {x: 0, y: 1}};
const pathData = points => `M ${points.map(p => `${p.x} ${p.y}`).join(' L ')}`;
const hasWaypoints = route => Array.isArray(route?.waypoints) && route.waypoints.length > 0;

// Drops repeated points and points in the middle of a straight run.
function simplifyPipePoints(points) {
  const distinct = points.filter((p, i) => !i || p.x !== points[i - 1].x || p.y !== points[i - 1].y);
  return distinct.filter((p, i) => {
    if (i === 0 || i === distinct.length - 1) return true;
    const before = distinct[i - 1], after = distinct[i + 1];
    return !((before.x === p.x && p.x === after.x && (p.y - before.y) * (after.y - p.y) >= 0) ||
             (before.y === p.y && p.y === after.y && (p.x - before.x) * (after.x - p.x) >= 0));
  });
}

// Length of an axis-aligned segment that lies inside a box.
function lengthInside(p, q, box) {
  if (p.y === q.y) {
    if (p.y <= box.t || p.y >= box.b) return 0;
    return Math.max(0, Math.min(Math.max(p.x, q.x), box.r) - Math.max(Math.min(p.x, q.x), box.l));
  }
  if (p.x <= box.l || p.x >= box.r) return 0;
  return Math.max(0, Math.min(Math.max(p.y, q.y), box.b) - Math.max(Math.min(p.y, q.y), box.t));
}

// Lower is better: short, few bends, leaving ports outward, and not running through symbols.
function routeCost(points, va, vb, boxes) {
  let cost = 40 * (points.length - 2);
  for (let i = 1; i < points.length; i++) {
    const p = points[i - 1], q = points[i], length = Math.abs(q.x - p.x) + Math.abs(q.y - p.y);
    const dx = Math.sign(q.x - p.x), dy = Math.sign(q.y - p.y);
    cost += length;
    for (const box of boxes) cost += box.weight * lengthInside(p, q, box);
    if (i > 1) {
      const o = points[i - 2];
      if (Math.sign(p.x - o.x) === -dx && Math.sign(p.y - o.y) === -dy) cost += 1000;
    }
    const first = i === 1, last = i === points.length - 1, cornered = points.length > 2;
    if (first && va) {
      const outward = dx * va.x + dy * va.y;
      cost += outward < 0 ? 2000 : outward === 0 ? 150 : cornered && length < 14 ? 80 : 0;
    }
    if (last && vb) {
      const inward = dx * vb.x + dy * vb.y;
      cost += inward > 0 ? 2000 : inward === 0 ? 150 : cornered && length < 14 ? 80 : 0;
    }
  }
  return cost;
}

// Picks the best of a small family of orthogonal paths between two ports.
// ends: {da, db} port facings, {boxA, boxB} the connected symbols, {obstacles} other symbols.
function autoRoute(a, b, ends = {}) {
  const va = DIRS[ends.da], vb = DIRS[ends.db], margin = 24, stub = 22;
  const boxes = [];
  for (const box of [ends.boxA, ends.boxB]) if (box) boxes.push({l: box.l + 2, r: box.r - 2, t: box.t + 2, b: box.b - 2, weight: 8});
  for (const box of ends.obstacles || []) boxes.push({...box, weight: 3});

  const xa = new Set(), xb = new Set(), ya = new Set(), yb = new Set();
  if (va?.x) xa.add(a.x + va.x * stub);
  if (va?.y) ya.add(a.y + va.y * stub);
  if (vb?.x) xb.add(b.x + vb.x * stub);
  if (vb?.y) yb.add(b.y + vb.y * stub);
  if (ends.boxA) { xa.add(ends.boxA.l - margin); xa.add(ends.boxA.r + margin); ya.add(ends.boxA.t - margin); ya.add(ends.boxA.b + margin); }
  if (ends.boxB) { xb.add(ends.boxB.l - margin); xb.add(ends.boxB.r + margin); yb.add(ends.boxB.t - margin); yb.add(ends.boxB.b + margin); }
  const xs = [(a.x + b.x) / 2, ...new Set([...xa, ...xb])], ys = [(a.y + b.y) / 2, ...new Set([...ya, ...yb])];

  const candidates = [[a, {x: b.x, y: a.y}, b], [a, {x: a.x, y: b.y}, b]];
  for (const x of xs) candidates.push([a, {x, y: a.y}, {x, y: b.y}, b]);
  for (const y of ys) candidates.push([a, {x: a.x, y}, {x: b.x, y}, b]);
  for (const x of xs) for (const y of ys) {
    candidates.push([a, {x, y: a.y}, {x, y}, {x: b.x, y}, b]);
    candidates.push([a, {x: a.x, y}, {x, y}, {x, y: b.y}, b]);
  }
  for (const y of ys) for (const x1 of xa) for (const x2 of xb) candidates.push([a, {x: x1, y: a.y}, {x: x1, y}, {x: x2, y}, {x: x2, y: b.y}, b]);
  for (const x of xs) for (const y1 of ya) for (const y2 of yb) candidates.push([a, {x: a.x, y: y1}, {x, y: y1}, {x, y: y2}, {x: b.x, y: y2}, b]);

  let best = null, bestCost = Infinity;
  for (const candidate of candidates) {
    const points = simplifyPipePoints(candidate), cost = routeCost(points, va, vb, boxes);
    if (cost < bestCost) { best = points; bestCost = cost; }
  }

  const g = {auto: true, points: best, path: pathData(best)};
  // Straight and three-segment results expose a middle segment that can be dragged.
  if (best.length === 2) {
    g.axis = a.y === b.y ? 'x' : 'y';
    g.value = g.axis === 'x' ? (a.x + b.x) / 2 : (a.y + b.y) / 2;
    g.c1 = g.c2 = g.axis === 'x' ? {x: g.value, y: a.y} : {x: a.x, y: g.value};
  } else if (best.length === 4) {
    g.axis = best[0].y === best[1].y ? 'x' : 'y';
    g.value = g.axis === 'x' ? best[1].x : best[1].y;
    g.c1 = best[1]; g.c2 = best[2];
  }
  return g;
}

function pipeGeometry(a, b, route, ends = {}) {
  if (route?.elbow === 'horizontal' || route?.elbow === 'vertical') {
    const corner = route.elbow === 'horizontal' ? {x: b.x, y: a.y} : {x: a.x, y: b.y};
    const points = simplifyPipePoints([a, corner, b]);
    return {elbow: route.elbow, corner, points, path: pathData(points)};
  }
  if (hasWaypoints(route)) {
    const stops = [a, ...route.waypoints, b], points = [a];
    for (let i = 1; i < stops.length; i++) {
      const from = points.at(-1), to = stops[i];
      if (from.x !== to.x && from.y !== to.y) points.push({x: to.x, y: from.y});
      points.push(to);
    }
    return {waypoints: true, points, path: pathData(points)};
  }
  if (route?.axis === 'x' || route?.axis === 'y') {
    const axis = route.axis;
    const value = Number.isFinite(route.value) ? route.value : axis === 'x' ? (a.x + b.x) / 2 : (a.y + b.y) / 2;
    const c1 = axis === 'x' ? {x: value, y: a.y} : {x: a.x, y: value};
    const c2 = axis === 'x' ? {x: value, y: b.y} : {x: b.x, y: value};
    const points = [a, c1, c2, b];
    return {axis, value, c1, c2, points, path: pathData(points)};
  }
  return autoRoute(a, b, ends);
}

// Everything needed to draw one pipe, or null if a port no longer exists.
function pipeRoute(pipe) {
  const a = portPos(pipe.a), b = portPos(pipe.b);
  if (!a || !b) return null;
  const nodeA = byId(pipe.a.node), nodeB = byId(pipe.b.node), ends = {da: portFacing(pipe.a), db: portFacing(pipe.b), boxA: nodeBox(nodeA), boxB: nodeBox(nodeB)};
  const automatic = !pipe.route || (Array.isArray(pipe.route.waypoints) && !pipe.route.waypoints.length);
  if (automatic) ends.obstacles = state.nodes.filter(n => n !== nodeA && n !== nodeB && n.kind !== 'junction').map(n => nodeBox(n, -2));
  const g = pipeGeometry(a, b, pipe.route, ends);
  return {a, b, g, points: g.points};
}
// The axis a centered three-segment route would use for this pipe.
function defaultAxis(pipe) {
  const facing = portFacing(pipe.a);
  return facing === 'T' || facing === 'B' ? 'y' : 'x';
}

function shiftedRoute(route, dx, dy) {
  if (!route) return route;
  const copy = structuredClone(route);
  if (Array.isArray(copy.waypoints)) copy.waypoints = copy.waypoints.map(q => ({x: q.x + dx, y: q.y + dy}));
  else if (Number.isFinite(copy.value)) copy.value += copy.axis === 'x' ? dx : dy;
  return copy;
}

const longestSegment = points => {
  let best = null;
  for (let i = 1; i < points.length; i++) {
    const start = points[i - 1], end = points[i], length = Math.hypot(end.x - start.x, end.y - start.y);
    if (!best || length > best.length) best = {start, end, length, index: i - 1};
  }
  return best;
};

// Adds a bend handle to the middle of the pipe's longest straight segment.
function addPipeWaypoint(pipe) {
  const r = pipeRoute(pipe);
  if (!r) return;
  const points = hasWaypoints(pipe.route) ? r.g.points : simplifyPipePoints(r.g.points);
  const longest = longestSegment(points);
  if (!longest || longest.length < 1) return;
  const {start, end, index} = longest;
  const midpoint = {x: Math.round((start.x + end.x) / 2), y: Math.round((start.y + end.y) / 2)};
  pipe.route = {waypoints: [...points.slice(1, index + 1), midpoint, ...points.slice(index + 1, -1)].map(p => ({...p}))};
  render(); persist();
}
// Freezes an automatic route's corners so one of them can be dragged.
function routeToWaypoints(pipe) {
  const r = pipeRoute(pipe);
  if (r) pipe.route = {waypoints: simplifyPipePoints(r.g.points).slice(1, -1).map(p => ({x: Math.round(p.x), y: Math.round(p.y)}))};
}

function pipeArrow(g, direction) {
  if (direction !== 'forward' && direction !== 'reverse') return null;
  const segment = longestSegment(g.points);
  if (!segment || segment.length < 0.1) return null;
  const sign = direction === 'forward' ? 1 : -1;
  const dx = sign * (segment.end.x - segment.start.x) / segment.length, dy = sign * (segment.end.y - segment.start.y) / segment.length;
  const x = (segment.start.x + segment.end.x) / 2, y = (segment.start.y + segment.end.y) / 2;
  const length = Math.min(13, segment.length * .8), halfWidth = length * 5 / 13;
  const tip = {x: x + dx * length / 2, y: y + dy * length / 2}, base = {x: x - dx * length / 2, y: y - dy * length / 2};
  return `M ${tip.x} ${tip.y} L ${base.x - dy * halfWidth} ${base.y + dx * halfWidth} L ${base.x + dy * halfWidth} ${base.y - dx * halfWidth} Z`;
}
function lineLabelPoint(points) {
  const best = longestSegment(points);
  if (!best || best.length < 1) return null;
  const vertical = best.start.x === best.end.x;
  return {x: (best.start.x + best.end.x) / 2 + (vertical ? 18 : 0), y: (best.start.y + best.end.y) / 2 - 12};
}
