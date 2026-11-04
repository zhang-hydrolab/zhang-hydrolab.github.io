/**
 * The Equal Earth projection (Šavrič, Patterson and Jenny, 2018): an equal-area world map
 * with straight parallels, used for the flat map on the collaboration page.
 */
const A1 = 1.340264;
const A2 = -0.081106;
const A3 = 0.000893;
const A4 = 0.003796;
const M = Math.sqrt(3) / 2;
const RAD = Math.PI / 180;

/** Half the width and half the height of the whole map, in projection units. */
export const HALF_WIDTH = Math.PI / (M * A1);
export const HALF_HEIGHT = (Math.PI / 3) * (A1 + A2 * (Math.PI / 3) ** 2 + (Math.PI / 3) ** 6 * (A3 + A4 * (Math.PI / 3) ** 2));

/** Longitude east of the centre, from -180 to 180. */
export const relativeLon = (lon, centre) => ((((lon - centre) % 360) + 540) % 360) - 180;

/** [x, y] with y up, for longitude east of the centre and latitude, both in degrees. */
export function equalEarth(lambda, phi) {
  const theta = Math.asin(M * Math.sin(phi * RAD));
  const t2 = theta * theta;
  const t6 = t2 * t2 * t2;
  const x = (lambda * RAD * Math.cos(theta)) / (M * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2)));
  const y = theta * (A1 + A2 * t2 + t6 * (A3 + A4 * t2));
  return [x, y];
}

/** A projector onto an SVG of the given width: ([lon, lat]) -> [x, y], y down. */
export function mapProjector(width, centre) {
  const k = width / (2 * HALF_WIDTH);
  const height = 2 * HALF_HEIGHT * k;
  /** `shifted` is for outlines already cut at the edge of the map, so 180 and -180 stay apart. */
  const point = (lon, lat, { shifted = false } = {}) => {
    const [x, y] = equalEarth(shifted ? lon - centre : relativeLon(lon, centre), lat);
    return [width / 2 + x * k, height / 2 - y * k];
  };
  return { width, height, point };
}
