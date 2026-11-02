/**
 * Rasterises Natural Earth land polygons into the dot grid used by the
 * collaboration map. Run only if the map's density should change:
 *   node scripts/gen-world-dots.mjs <path to world-atlas land-110m.json>
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const STEP = 2.4;
const LAT = [-56, 76];
const here = path.dirname(fileURLToPath(import.meta.url));

const topo = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const { scale, translate } = topo.transform;
const arcs = topo.arcs.map((arc) => {
  let x = 0;
  let y = 0;
  return arc.map(([dx, dy]) => {
    x += dx;
    y += dy;
    return [x * scale[0] + translate[0], y * scale[1] + translate[1]];
  });
});

const ring = (ids) => {
  const points = [];
  for (const id of ids) {
    const arc = id < 0 ? [...arcs[~id]].reverse() : arcs[id];
    points.push(...(points.length ? arc.slice(1) : arc));
  }
  return points;
};

const rings = [];
for (const geometry of topo.objects.land.geometries) {
  const polygons = geometry.type === 'Polygon' ? [geometry.arcs] : geometry.arcs;
  for (const polygon of polygons) for (const ids of polygon) rings.push(ring(ids));
}

function isLand(lon, lat) {
  let inside = false;
  for (const points of rings) {
    for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
      const [xi, yi] = points[i];
      const [xj, yj] = points[j];
      if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

const dots = [];
let row = 0;
for (let lat = LAT[1]; lat >= LAT[0]; lat -= STEP, row += 1) {
  const offset = row % 2 ? STEP / 2 : 0;
  for (let lon = -180 + offset; lon <= 180; lon += STEP) {
    if (isLand(lon, lat)) dots.push([Number(lon.toFixed(2)), Number(lat.toFixed(2))]);
  }
}

const out = path.join(here, '..', 'src', 'data', 'world-dots.json');
fs.writeFileSync(out, `${JSON.stringify({ step: STEP, latRange: LAT, dots })}\n`);
console.log(`${dots.length} dots written to ${out}`);
