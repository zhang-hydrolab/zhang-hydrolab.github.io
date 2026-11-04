/*
 * One terrain view for each research programme, each on real terrain from tools/build_earth.py.
 *
 *   flow   The water cycle in the Hengduan Mountains: rain falls, vapour rises from the land and
 *          pulses of water run down the routed river network.
 *   flood  Water-related disasters and water security on the middle Yangtze, in three acts. A
 *          storm rains on the upper catchment; a flood stage rises and falls over the height of
 *          each cell above its nearest channel (HAND), with the share of land under water read
 *          from the same grid; then a drought dries the smaller streams first. A gauge on the
 *          Yangtze near Shashi shows the level against a flood warning and a low-flow warning.
 *   scan   New technology over the Loess Plateau, in three acts. A satellite retrieves PML-V2.2
 *          evapotranspiration pixel by pixel; a neural network takes in values from the map;
 *          its forecast runs down the river network.
 *
 * Terrain, rivers, HAND and ET are data. Rain, the flood stage, the drought, the satellite, the
 * network and the forecast illustrate the research, and the captions say so. The gauge, clouds,
 * lightning, satellite and network are drawn on a 2D canvas over the terrain.
 */
import { bindPause, clamp, createProgram, readChannel, whenNear } from '../gl/core.js';
import { createDrops, seeds } from '../gl/drops.js';
import { createTerrain, HEIGHT, LIFT } from '../gl/terrain.js';

const GROUND_VERTEX = /* glsl */ `#version 300 es
precision highp float;
layout(location = 0) in vec2 aGrid;
uniform mat4 uCamera;
out vec2 vUv;
${HEIGHT}
void main() {
  vUv = aGrid;
  gl_Position = uCamera * vec4(placeAt(aGrid), 1.0);
}`;

// The HAND image stores sqrt(HAND / 120 m). Ripples run across open water.
const FLOOD_FRAGMENT = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uLayer;
uniform float uStage;
uniform float uRise;
uniform float uTime;
out vec4 outColor;
void main() {
  float hand = texture(uLayer, vUv).r;
  float d = (uStage - hand) / max(fwidth(hand), 1e-3);
  float wet = smoothstep(-0.6, 0.6, d) * step(0.0005, uStage);
  float shore = (1.0 - smoothstep(0.0, 1.6, abs(d))) * step(0.0005, uStage);
  float deep = clamp((uStage - hand) * 5.0, 0.0, 1.0);
  vec3 water = mix(vec3(0.360, 0.630, 0.870), vec3(0.120, 0.400, 0.700), deep);
  float ripple = sin(vUv.x * 260.0 + vUv.y * 140.0 - uTime * 2.6) * sin(vUv.y * 210.0 - vUv.x * 60.0 + uTime * 1.7);
  water = mix(water, vec3(0.700, 0.880, 1.000), smoothstep(0.55, 1.0, ripple) * 0.35 * deep);
  vec4 colour = vec4(water, 1.0) * wet * 0.78;
  colour = mix(colour, vec4(0.780, 0.920, 1.000, 1.0) * 0.9, shore * 0.8);
  outColor = colour * uRise;
}`;

// The ET grid stores ET / 900 mm per year, one texel per 0.1 degree cell. It is shown from 100
// to 700 mm, the range of the plateau, so the gradient from the desert to the forests reads.
const SCAN_FRAGMENT = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uLayer;
uniform vec2 uCells;
uniform float uSweep;
uniform float uFade;
uniform float uRise;
out vec4 outColor;
void main() {
  vec2 cell = vUv * uCells;
  float et = clamp((texture(uLayer, (floor(cell) + 0.5) / uCells).r * 900.0 - 100.0) / 600.0, 0.0, 1.0);
  // Each pixel appears as the swath passes it, then settles to its colour.
  float behind = uSweep - (floor(cell.x) + 0.5) / uCells.x;
  float shown = smoothstep(0.0, 0.05, behind);
  float flash = smoothstep(0.0, 0.01, behind) * (1.0 - smoothstep(0.01, 0.07, behind));
  vec3 ramp = et < 0.5
    ? mix(vec3(0.930, 0.960, 0.990), vec3(0.420, 0.660, 0.860), et * 2.0)
    : mix(vec3(0.420, 0.660, 0.860), vec3(0.060, 0.300, 0.510), et * 2.0 - 1.0);
  vec2 f = abs(fract(cell) - 0.5);
  float seam = smoothstep(0.43, 0.5, max(f.x, f.y));
  vec3 colour = mix(ramp, ramp * 0.93, seam);
  colour = mix(colour, vec3(0.800, 0.940, 1.000), flash);
  outColor = vec4(colour, 1.0) * max(shown * 0.86, flash) * uFade * uRise;
}`;

async function layerTexture(gl, url, nearest) {
  const layer = await readChannel(url);
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, layer.width, layer.height, 0, gl.RED, gl.UNSIGNED_BYTE, layer.values);
  const filter = nearest ? gl.NEAREST : gl.LINEAR;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return { texture, ...layer };
}

/** The height of the ground at (u, v), in scene units, read as the mesh reads it: smoothed. */
async function groundOf(scene) {
  const map = await readChannel(`/earth/${scene}.webp`);
  const at = (x, y) => map.values[clamp(y, 0, map.height - 1) * map.width + clamp(x, 0, map.width - 1)];
  return (u, v) => {
    const cx = Math.round(u * (map.width - 1));
    const cy = Math.round(v * (map.height - 1));
    let sum = 0;
    for (let dy = -3; dy <= 3; dy += 1) for (let dx = -3; dx <= 3; dx += 1) sum += at(cx + dx, cy + dy);
    const h = Math.max(sum / 49 / 255 - 0.04, 0) / 0.96;
    return h * h * LIFT;
  };
}

const zh = () => document.documentElement.dataset.lang === 'zh';
const ramp = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const smooth = (t, a, b) => {
  const k = ramp(t, a, b);
  return k * k * (3 - 2 * k);
};
const lerp = (a, b, k) => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });

/** A circle on the ground, drawn in perspective. */
function groundRing(pen, scene, [x, y, z], radius) {
  pen.beginPath();
  for (let i = 0; i <= 32; i += 1) {
    const a = (i / 32) * Math.PI * 2;
    const p = scene.project(x + Math.cos(a) * radius, y, z + Math.sin(a) * radius);
    if (i) pen.lineTo(p.x, p.y);
    else pen.moveTo(p.x, p.y);
  }
}

/** Pixels per scene unit at a point, for sizing what is drawn there. */
const unitAt = (scene, [x, y, z]) => {
  const a = scene.project(x - 0.05, y, z);
  const b = scene.project(x + 0.05, y, z);
  return Math.hypot(b.x - a.x, b.y - a.y) / 0.1;
};

/* ---------- The water cycle ---------- */

function flow(ui) {
  let drops;
  let batches;
  return {
    scene: 'hengduan',
    camera: { yaw: -26, pitch: 33, distance: 4.2, contour: 300 },
    flow: 0.5,
    setup(gl) {
      drops = createDrops(gl);
      batches = [
        { vao: seeds(gl, 420, 0.03, 0.97), count: 420, up: 0, rate: 0.36, dot: 9 },
        { vao: seeds(gl, 520, 0.03, 0.97), count: 520, up: 1, rate: 0.09, dot: 3.2 },
      ];
    },
    frame() {
      ui.say('Rain falls, vegetation returns vapour, and runoff travels down the river network', '降水落地，植被蒸散发上升，径流沿河网下泄');
    },
    draw(scene, pass) {
      if (pass !== 'air') return;
      drawDrops(scene, drops, batches);
    },
  };
}

function drawDrops(scene, drops, batches) {
  const { gl, state } = scene;
  gl.depthMask(false);
  gl.useProgram(drops.handle);
  scene.heights(drops);
  gl.uniformMatrix4fv(drops.u.uCamera, false, state.camera);
  gl.uniform1f(drops.u.uTime, state.time);
  const pixel = clamp(state.height / 620, 0.9, 2.2);
  for (const { vao, count, up, rate, dot } of batches) {
    if (count < 1) continue;
    gl.bindVertexArray(vao);
    gl.uniform1f(drops.u.uUp, up);
    gl.uniform1f(drops.u.uRate, rate);
    gl.uniform1f(drops.u.uSize, dot * pixel);
    gl.drawArrays(gl.POINTS, 0, count);
  }
  gl.depthMask(true);
}

/* ---------- Water-related disasters and water security ---------- */

const PEAK = 24; // Metres above the channel at the top of the flood.
const STORM_CYCLE = 20; // Seconds from one calm to the next.
const STORM_START = 1.4; // Seconds into the cycle at first sight.
const STORM_STILL = 8.4; // The moment the still image shows: rain, and the flood near its peak.
const GAUGE = [112.26, 30.28]; // On the Yangtze near Shashi, where the routed channel passes.
const RAIN_DROPS = 1300;
const FLOOD_LINE = 0.72; // Flood warning, as a share of the gauge.
const LOW_LINE = 0.18; // Low-flow warning.
// Lightning: seconds into the cycle, and where it strikes, as (u, v) on the block.
const BOLTS = [
  [3.2, 0.34, 0.4],
  [4.9, 0.55, 0.28],
  [6.3, 0.22, 0.62],
];
// The storm's cloud deck, over the upper catchment: (u, v, size).
const CLOUDS = [
  [0.14, 0.32, 1.0], [0.28, 0.22, 1.2], [0.42, 0.34, 1.05], [0.22, 0.52, 1.1],
  [0.38, 0.6, 0.95], [0.55, 0.42, 1.0], [0.08, 0.66, 0.9], [0.6, 0.2, 0.85],
];

/** Everything the storm view shows at time t into its cycle. */
function stormAt(t) {
  const rain = smooth(t, 0.8, 2.2) * (1 - smooth(t, 7.6, 9.4));
  const wave = t < 9.6 ? smooth(t, 2.6, 9.6) : 1 - smooth(t, 9.6, 13.4);
  const dry = smooth(t, 13.6, 15.8) * (1 - smooth(t, 18.4, 19.8));
  const level = 0.42 + 0.55 * wave - 0.32 * dry;
  const act = t >= 0.8 && t < 6.6 ? 0 : t >= 6.6 && t < 13.5 ? 1 : t >= 13.5 && t < 19.3 ? 2 : -1;
  return { t, rain, metres: PEAK * wave, dry, level, act };
}

function flood(ui) {
  let program;
  let layer;
  let below; // Share of the grid at or below each of the 256 stored values.
  let drops;
  let rain;
  let gauge; // The gauge's foot, in scene units.
  let ground;
  let now = stormAt(STORM_STILL);
  return {
    scene: 'gorges',
    camera: { yaw: -22, pitch: 34, distance: 4.3, aim: 0.07, contour: 150 },
    flow: 0.42,
    async setup(gl, scene) {
      program = createProgram(gl, GROUND_VERTEX, FLOOD_FRAGMENT);
      drops = createDrops(gl);
      // Rain over the upper catchment, west of the plains that flood.
      rain = seeds(gl, RAIN_DROPS, 0.02, 0.74);
      [layer, ground] = await Promise.all([layerTexture(gl, '/earth/gorges-hand.webp', false), groundOf('gorges')]);
      const counts = new Float64Array(256);
      for (const v of layer.values) counts[v] += 1;
      below = new Float64Array(256);
      let sum = 0;
      for (let v = 0; v < 256; v += 1) below[v] = sum += counts[v] / layer.values.length;
      const { lon0, lat0, lon1, lat1 } = scene.bounds;
      const u = (GAUGE[0] - lon0) / (lon1 - lon0);
      const v = (lat1 - GAUGE[1]) / (lat1 - lat0);
      gauge = { u, v, x: u * 2 - 1, z: (v * 2 - 1) * scene.depth };
    },
    frame(scene, still) {
      now = stormAt(still ? STORM_STILL : (scene.state.time + STORM_START) % STORM_CYCLE);
      scene.state.dry = now.dry;
      ui.step(still ? 1 : now.act);
      const m = Math.round(now.metres);
      if (now.act === 1) {
        const share = Math.round(100 * below[Math.min(255, Math.floor(Math.sqrt(now.metres / 120) * 255))]);
        ui.say(`Flood: water ${m} m above the nearest channel, ${share}% of the land under water`, `洪水：水位高出最近河道 ${m} 米，${share}% 的土地被淹没`);
      } else if (now.act === 0) {
        ui.say('Storm: heavy rain over the upper catchment', '暴雨：上游流域强降水');
      } else if (now.act === 2) {
        ui.say('Drought: the smaller streams dry first, and low water spreads down the network', '干旱：较小支流先断流，低水位沿河网向下游扩展');
      } else {
        ui.say('Normal flow at the gauge on the Yangtze near Shashi', '长江沙市附近水位标尺：水位正常');
      }
    },
    draw(scene, pass) {
      const { gl, state } = scene;
      if (pass === 'ground') {
        gl.useProgram(program.handle);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, layer.texture);
        gl.uniform1i(program.u.uLayer, 1);
        gl.uniform1f(program.u.uStage, Math.sqrt(now.metres / 120));
        gl.uniform1f(program.u.uTime, state.time);
        scene.ground(program); // Also sets the rise, shared with the vertex stage.
      } else if (pass === 'air') {
        drawDrops(scene, drops, [{ vao: rain, count: Math.round(RAIN_DROPS * now.rain), up: 0, rate: 0.62, dot: 12 }]);
      }
    },
    overlay(scene, pen) {
      const rise = scene.state.rise;
      if (now.rain > 0.01) clouds(scene, pen, now.rain * rise);
      for (const [at, u, v] of BOLTS) {
        const age = now.t - at;
        if (age >= 0 && age < 0.34) bolt(scene, pen, u, v, ground(u, v), age);
      }
      staff(scene, pen, [gauge.x, ground(gauge.u, gauge.v), gauge.z], now, rise);
    },
  };
}

function clouds(scene, pen, strength) {
  for (const [u, v, size] of CLOUDS) {
    const at = [u * 2 - 1, 0.64 + size * 0.03, (v * 2 - 1) * scene.depth];
    const p = scene.project(...at);
    const r = unitAt(scene, at) * 0.16 * size;
    // Three puffs, the middle one higher, each flattened to half its height.
    for (const [dx, dy, k] of [
      [-0.55, 0.1, 0.72],
      [0, -0.12, 1],
      [0.6, 0.06, 0.8],
    ]) {
      const cx = p.x + dx * r;
      const cy = p.y + dy * r;
      const radius = r * k;
      pen.save();
      pen.translate(cx, cy);
      pen.scale(1, 0.55);
      const fill = pen.createRadialGradient(0, -radius * 0.25, 0, 0, 0, radius);
      fill.addColorStop(0, `rgba(203, 217, 234, ${0.7 * strength})`);
      fill.addColorStop(0.55, `rgba(160, 184, 212, ${0.45 * strength})`);
      fill.addColorStop(1, 'rgba(160, 184, 212, 0)');
      pen.fillStyle = fill;
      pen.beginPath();
      pen.arc(0, 0, radius, 0, Math.PI * 2);
      pen.fill();
      pen.restore();
    }
  }
}

/** A lightning stroke from the cloud base to the ground, flickering out over a third of a second. */
function bolt(scene, pen, u, v, groundY, age) {
  const x = u * 2 - 1;
  const z = (v * 2 - 1) * scene.depth;
  const top = scene.project(x, 0.6, z);
  const foot = scene.project(x, groundY, z);
  const flicker = age < 0.07 || (age > 0.12 && age < 0.19) ? 1 : 0.45;
  const strength = (1 - age / 0.34) * flicker;
  // A fixed zig-zag for each bolt, so it does not crawl while it shows.
  let seed = Math.round(u * 997 + v * 131);
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647 - 0.5;
  };
  // A random walk down to the strike, uneven in step, pulled back towards the line as it goes.
  const span = foot.y - top.y;
  const points = [top];
  let drift = 0;
  let y = top.y;
  while (y < foot.y - span * 0.12) {
    y += span * (0.08 + (random() + 0.5) * 0.1);
    drift = drift * 0.55 + random() * span * 0.22;
    const k = (y - top.y) / span;
    points.push({ x: top.x + (foot.x - top.x) * k + drift, y });
  }
  points.push(foot);
  const fork = points[Math.min(2, points.length - 2)];
  const branch = [fork, { x: fork.x + span * 0.1, y: fork.y + span * 0.12 }, { x: fork.x + span * 0.13, y: fork.y + span * 0.2 }, { x: fork.x + span * 0.2, y: fork.y + span * 0.27 }];
  pen.save();
  pen.lineJoin = 'round';
  for (const [line, width] of [
    [points, 1],
    [branch, 0.6],
  ]) {
    pen.beginPath();
    line.forEach((p, i) => (i ? pen.lineTo(p.x, p.y) : pen.moveTo(p.x, p.y)));
    pen.strokeStyle = `rgba(120, 185, 255, ${0.45 * strength})`;
    pen.lineWidth = 7 * width;
    pen.stroke();
    pen.strokeStyle = `rgba(29, 95, 170, ${0.9 * strength})`;
    pen.lineWidth = 3 * width;
    pen.stroke();
    pen.strokeStyle = `rgba(255, 255, 255, ${strength})`;
    pen.lineWidth = 1.3 * width;
    pen.stroke();
  }
  const glow = pen.createRadialGradient(foot.x, foot.y, 0, foot.x, foot.y, 22);
  glow.addColorStop(0, `rgba(170, 215, 255, ${0.7 * strength})`);
  glow.addColorStop(1, 'rgba(170, 215, 255, 0)');
  pen.fillStyle = glow;
  pen.fillRect(foot.x - 22, foot.y - 22, 44, 44);
  pen.restore();
}

/** A staff gauge: the water level against a flood warning and a low-flow warning. */
function staff(scene, pen, foot, now, rise) {
  const [x, y, z] = foot;
  const base = scene.project(x, y, z);
  const top = scene.project(x, y + 0.26 * rise, z);
  const tall = base.y - top.y;
  if (tall < 4) return;
  const wide = Math.max(5, tall * 0.11);
  const left = base.x - wide / 2;
  const alarm = now.level > FLOOD_LINE ? '#c8423b' : now.level < LOW_LINE ? '#d9861a' : null;

  pen.save();
  // Alert rings spread on the ground while the level is past a warning line.
  if (alarm) {
    pen.strokeStyle = alarm;
    for (let i = 0; i < 2; i += 1) {
      const k = (now.t * 0.8 + i / 2) % 1;
      groundRing(pen, scene, foot, 0.03 + k * 0.13);
      pen.globalAlpha = (1 - k) * 0.85;
      pen.lineWidth = 1.6;
      pen.stroke();
    }
    pen.globalAlpha = 1;
  }
  groundRing(pen, scene, foot, 0.022);
  pen.fillStyle = 'rgba(15, 76, 129, 0.25)';
  pen.fill();

  // The staff, its water and its scale.
  pen.fillStyle = '#ffffff';
  pen.fillRect(left, top.y, wide, tall);
  const water = base.y - tall * clamp(now.level, 0, 1);
  pen.fillStyle = '#2f74b5';
  pen.fillRect(left, water, wide, base.y - water);
  pen.strokeStyle = '#0f4c81';
  pen.lineWidth = 1;
  pen.strokeRect(left + 0.5, top.y + 0.5, wide - 1, tall - 1);
  pen.beginPath();
  for (let i = 1; i < 10; i += 1) {
    const ty = base.y - (tall * i) / 10;
    pen.moveTo(left, ty);
    pen.lineTo(left + wide * (i % 5 ? 0.35 : 0.6), ty);
  }
  pen.stroke();
  for (const [share, colour] of [
    [FLOOD_LINE, '#c8423b'],
    [LOW_LINE, '#d9861a'],
  ]) {
    const ty = base.y - tall * share;
    pen.strokeStyle = colour;
    pen.lineWidth = 1.8;
    pen.beginPath();
    pen.moveTo(left - wide * 0.7, ty);
    pen.lineTo(left + wide * 1.7, ty);
    pen.stroke();
  }
  // A flag on top, in the colour of any warning.
  pen.fillStyle = alarm ?? '#0f4c81';
  pen.beginPath();
  pen.moveTo(left + wide, top.y);
  pen.lineTo(left + wide + wide * 1.4, top.y + wide * 0.55);
  pen.lineTo(left + wide, top.y + wide * 1.1);
  pen.fill();
  pen.restore();
}

/* ---------- New technology: satellite, AI, forecast ---------- */

const SCAN_CYCLE = 18; // Seconds from one pass to the next.
const SCAN_START = 2.2; // Seconds into the cycle at first sight.
const SWEEP = 6.4; // Seconds for the satellite to cross the block.
const SCAN_STILL = 4.9; // The still shows the satellite most of the way across, and the network.
const OUTLET = [113.32, 35.19]; // Where the Yellow River leaves the block.

/** Everything the technology view shows at time t into its cycle. */
function passAt(t) {
  return {
    t,
    // The swath, as a share of the block; the satellite flies over it, from off one edge to off the other.
    sweep: t < SWEEP ? (t / SWEEP) * 1.2 - 0.1 : 1.2,
    fade: 1 - smooth(t, 16.4, 17.8),
    net: smooth(t, 6.4, 7.4) * (1 - smooth(t, 15.6, 16.8)),
    feed: ramp(t, 7.0, 8.8),
    hidden: ramp(t, 8.8, 9.9),
    output: ramp(t, 9.9, 11.0),
    glow: smooth(t, 10.8, 11.3) * (1 - smooth(t, 15.2, 16.4)),
    down: ramp(t, 11.2, 12.3),
    boost: smooth(t, 12.0, 12.9) * (1 - smooth(t, 15.0, 16.4)),
    act: t < 6.4 ? 0 : t < 11.2 ? 1 : t < 16.4 ? 2 : -1,
  };
}

/** The ET ramp of the scan layer, for values carried into the network. */
function etColour(et) {
  const k = clamp((et - 100) / 600, 0, 1);
  const mix = (a, b, s) => a.map((v, i) => Math.round((v + (b[i] - v) * s) * 255));
  const [r, g, b] = k < 0.5 ? mix([0.93, 0.96, 0.99], [0.42, 0.66, 0.86], k * 2) : mix([0.42, 0.66, 0.86], [0.06, 0.3, 0.51], k * 2 - 1);
  return `rgb(${r}, ${g}, ${b})`;
}

function scan(ui) {
  let program;
  let layer;
  let ground;
  let mean = 0;
  let net; // The network: layers of nodes and the links between them, in scene units.
  let outlet;
  let now = passAt(SCAN_STILL);
  let still = false;
  return {
    scene: 'loess',
    camera: { yaw: -24, pitch: 31, distance: 4.5, aim: 0.17, contour: 200 },
    flow: 0.42,
    async setup(gl, scene) {
      program = createProgram(gl, GROUND_VERTEX, SCAN_FRAGMENT);
      [layer, ground] = await Promise.all([layerTexture(gl, '/earth/loess-et.webp', true), groundOf('loess')]);
      let sum = 0;
      let n = 0;
      for (const v of layer.values) {
        if (v > 0) {
          sum += (v / 255) * 900;
          n += 1;
        }
      }
      mean = n ? sum / n : 0;
      const d = scene.depth;
      const etAt = (u, v) => (layer.values[Math.min(layer.height - 1, Math.floor(v * layer.height)) * layer.width + Math.min(layer.width - 1, Math.floor(u * layer.width))] / 255) * 900;
      // Inputs over the map, each fed by the ET of the cell beneath it; a smaller hidden layer;
      // one output.
      const inputs = [];
      for (let i = 0; i < 4; i += 1) {
        for (let j = 0; j < 3; j += 1) {
          const x = -0.66 + i * 0.44;
          const z = (-0.55 + j * 0.55) * d;
          const u = (x + 1) / 2;
          const v = (z / d + 1) / 2;
          inputs.push({ at: [x * 0.92, 0.5, z * 0.9], foot: [x, ground(u, v), z], colour: etColour(etAt(u, v)), order: i * 3 + j });
        }
      }
      const hidden = [];
      for (let i = 0; i < 3; i += 1) for (let j = 0; j < 2; j += 1) hidden.push({ at: [-0.42 + i * 0.42, 0.72, (-0.28 + j * 0.56) * d] });
      const output = { at: [0, 0.94, 0] };
      const links = [];
      inputs.forEach((a, i) => hidden.forEach((b, j) => links.push({ a, b, stage: 'hidden', order: (i * 6 + j) % 9 })));
      hidden.forEach((a, i) => links.push({ a, b: output, stage: 'output', order: i }));
      net = { inputs, hidden, output, links };
      const { lon0, lat0, lon1, lat1 } = scene.bounds;
      const u = (OUTLET[0] - lon0) / (lon1 - lon0);
      const v = (lat1 - OUTLET[1]) / (lat1 - lat0);
      outlet = [u * 2 - 1, ground(u, v), (v * 2 - 1) * d];
    },
    frame(scene, isStill) {
      still = isStill;
      now = isStill ? { ...passAt(SCAN_STILL), net: 1, feed: 1, hidden: 1, output: 0 } : passAt((scene.state.time + SCAN_START) % SCAN_CYCLE);
      scene.state.boost = now.boost;
      ui.step(now.act);
      if (now.act === 0) {
        const share = Math.round(clamp(now.sweep, 0, 1) * 20) * 5;
        ui.say(
          `Satellite retrieval: PML-V2.2 evapotranspiration, ${share}% mapped. Mean for 2001–2020: ${Math.round(mean)} mm per year`,
          `卫星遥感反演：PML-V2.2 蒸散发已完成 ${share}%，2001–2020 年平均 ${Math.round(mean)} 毫米/年`,
        );
      } else if (now.act === 1) {
        ui.say('AI model: a neural network takes in values from the retrieved map', '人工智能：神经网络读取反演得到的蒸散发数据');
      } else if (now.act === 2) {
        ui.say('Forecast: the model output runs down the river network', '预报：模型输出沿河网传递');
      } else {
        ui.say('PML-V2.2 evapotranspiration, mean for 2001–2020', 'PML-V2.2 蒸散发，2001–2020 年平均');
      }
    },
    draw(scene, pass) {
      if (pass !== 'ground') return;
      const { gl } = scene;
      gl.useProgram(program.handle);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, layer.texture);
      gl.uniform1i(program.u.uLayer, 1);
      gl.uniform2f(program.u.uCells, layer.width, layer.height);
      gl.uniform1f(program.u.uSweep, now.sweep);
      gl.uniform1f(program.u.uFade, now.fade);
      scene.ground(program);
    },
    overlay(scene, pen) {
      const rise = scene.state.rise;
      if (now.net > 0.01) network(scene, pen, net, outlet, now, rise, still);
      if (now.sweep <= 1.1) satellite(scene, pen, now.sweep * 2 - 1, ground, rise);
    },
  };
}

/** The satellite, its field of view, and the line it is reading across the ground. */
function satellite(scene, pen, x, ground, rise) {
  const d = scene.depth;
  const at = [x, 1.0, 0];
  const s = scene.project(...at);
  const edge = clamp((1.25 - Math.abs(x)) / 0.2, 0, 1) * rise;
  pen.save();
  pen.globalAlpha = edge;
  if (Math.abs(x) <= 1) {
    const u = (x + 1) / 2;
    const line = [];
    for (let i = 0; i <= 24; i += 1) {
      const v = i / 24;
      line.push(scene.project(x, ground(u, v) + 0.004, (v * 2 - 1) * d));
    }
    const mid = line[12];
    const beam = pen.createLinearGradient(s.x, s.y, mid.x, mid.y);
    beam.addColorStop(0, 'rgba(110, 185, 255, 0.42)');
    beam.addColorStop(1, 'rgba(110, 185, 255, 0.1)');
    pen.fillStyle = beam;
    pen.beginPath();
    pen.moveTo(s.x, s.y);
    line.forEach((p) => pen.lineTo(p.x, p.y));
    pen.closePath();
    pen.fill();
    pen.strokeStyle = 'rgba(205, 236, 255, 0.95)';
    pen.lineWidth = 2.2;
    pen.beginPath();
    line.forEach((p, i) => (i ? pen.lineTo(p.x, p.y) : pen.moveTo(p.x, p.y)));
    pen.stroke();
    pen.strokeStyle = 'rgba(30, 110, 200, 0.85)';
    pen.lineWidth = 0.8;
    pen.stroke();
  }
  // The craft: a body with two solar wings, set along the track's cross direction.
  const a = scene.project(x, 1.0, -0.17);
  const b = scene.project(x, 1.0, 0.17);
  const half = Math.hypot(b.x - a.x, b.y - a.y) / 2;
  pen.translate(s.x, s.y);
  pen.rotate(Math.atan2(b.y - a.y, b.x - a.x));
  const wing = half * 0.17;
  for (const sign of [-1, 1]) {
    const x0 = sign < 0 ? -half : half * 0.24;
    pen.fillStyle = '#2a6bb0';
    pen.fillRect(x0, -wing, half * 0.76, wing * 2);
    pen.strokeStyle = '#0a3559';
    pen.lineWidth = 1;
    pen.strokeRect(x0, -wing, half * 0.76, wing * 2);
    pen.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    pen.beginPath();
    for (let i = 1; i < 4; i += 1) {
      pen.moveTo(x0 + (half * 0.76 * i) / 4, -wing);
      pen.lineTo(x0 + (half * 0.76 * i) / 4, wing);
    }
    pen.moveTo(x0, 0);
    pen.lineTo(x0 + half * 0.76, 0);
    pen.stroke();
  }
  pen.strokeStyle = '#0a3559';
  pen.beginPath();
  pen.moveTo(-half * 0.24, 0);
  pen.lineTo(half * 0.24, 0);
  pen.stroke();
  pen.fillStyle = '#ffffff';
  pen.fillRect(-half * 0.16, -half * 0.2, half * 0.32, half * 0.4);
  pen.strokeRect(-half * 0.16, -half * 0.2, half * 0.32, half * 0.4);
  pen.fillStyle = '#e8a33a';
  pen.fillRect(-half * 0.1, -half * 0.06, half * 0.2, half * 0.12);
  pen.restore();
}

/**
 * The network: values rise from the map into the inputs, signals pass up through the layers, and
 * the output sends its forecast down to the river's outlet.
 */
function network(scene, pen, net, outlet, now, rise, still) {
  const p = (at) => scene.project(...at);
  const show = now.net * rise;
  const size = (at) => clamp(unitAt(scene, at) * 0.022, 3, 8);
  pen.save();
  pen.globalAlpha = show;

  // Links, brighter while a signal crosses them.
  for (const link of net.links) {
    const k = link.stage === 'hidden' ? now.hidden : now.output;
    const busy = k > 0 && k < 1 ? 0.35 : 0;
    const a = p(link.a.at);
    const b = p(link.b.at);
    pen.strokeStyle = `rgba(42, 107, 176, ${0.22 + busy + (k >= 1 ? 0.12 : 0)})`;
    pen.lineWidth = 0.8;
    pen.beginPath();
    pen.moveTo(a.x, a.y);
    pen.lineTo(b.x, b.y);
    pen.stroke();
  }

  // Values rising from the map to the inputs.
  for (const node of net.inputs) {
    const a = p(node.foot);
    const b = p(node.at);
    pen.setLineDash([2, 3]);
    pen.strokeStyle = 'rgba(15, 76, 129, 0.45)';
    pen.lineWidth = 0.9;
    pen.beginPath();
    pen.moveTo(a.x, a.y);
    pen.lineTo(b.x, b.y);
    pen.stroke();
    pen.setLineDash([]);
    const k = clamp(now.feed * 1.35 - node.order * 0.03, 0, 1);
    node.fed = k >= 1;
    if (k > 0 && k < 1 && !still) {
      const q = lerp(a, b, k);
      pen.fillStyle = node.colour;
      pen.strokeStyle = '#0f4c81';
      pen.beginPath();
      pen.arc(q.x, q.y, 2.6, 0, Math.PI * 2);
      pen.fill();
      pen.stroke();
    }
  }

  // Signals along the links.
  if (!still) {
    for (const link of net.links) {
      const k = clamp((link.stage === 'hidden' ? now.hidden : now.output) * 1.3 - link.order * 0.035, 0, 1);
      if (k <= 0 || k >= 1) continue;
      const q = lerp(p(link.a.at), p(link.b.at), k);
      pen.fillStyle = '#ffffff';
      pen.strokeStyle = '#3d8fe0';
      pen.lineWidth = 1.2;
      pen.beginPath();
      pen.arc(q.x, q.y, 1.9, 0, Math.PI * 2);
      pen.fill();
      pen.stroke();
    }
  }

  // The output's glow, and its forecast falling to the outlet.
  const out = p(net.output.at);
  if (now.glow > 0.01) {
    const r = size(net.output.at) * (3.2 + Math.sin(now.t * 5) * 0.5);
    const halo = pen.createRadialGradient(out.x, out.y, 0, out.x, out.y, r);
    halo.addColorStop(0, `rgba(110, 185, 255, ${0.65 * now.glow})`);
    halo.addColorStop(1, 'rgba(110, 185, 255, 0)');
    pen.fillStyle = halo;
    pen.beginPath();
    pen.arc(out.x, out.y, r, 0, Math.PI * 2);
    pen.fill();
  }
  if (now.down > 0 && now.glow > 0.01) {
    const end = p(outlet);
    const q = lerp(out, end, now.down);
    pen.strokeStyle = `rgba(42, 107, 176, ${0.6 * now.glow})`;
    pen.lineWidth = 1.2;
    pen.setLineDash([4, 3]);
    pen.beginPath();
    pen.moveTo(out.x, out.y);
    pen.lineTo(q.x, q.y);
    pen.stroke();
    pen.setLineDash([]);
    if (now.down < 1) {
      pen.fillStyle = '#ffffff';
      pen.strokeStyle = '#1d6fc4';
      pen.lineWidth = 1.6;
      pen.beginPath();
      pen.arc(q.x, q.y, 3.4, 0, Math.PI * 2);
      pen.fill();
      pen.stroke();
    } else {
      for (let i = 0; i < 2; i += 1) {
        const k = (now.t * 0.9 + i / 2) % 1;
        groundRing(pen, scene, outlet, 0.02 + k * 0.12);
        pen.strokeStyle = `rgba(29, 111, 196, ${(1 - k) * 0.9 * now.glow})`;
        pen.lineWidth = 1.5;
        pen.stroke();
      }
    }
  }

  // Nodes, drawn last so they sit over their links.
  const dot = (node, fill) => {
    const q = p(node.at);
    pen.fillStyle = fill;
    pen.strokeStyle = '#0f4c81';
    pen.lineWidth = 1.2;
    pen.beginPath();
    pen.arc(q.x, q.y, size(node.at), 0, Math.PI * 2);
    pen.fill();
    pen.stroke();
  };
  for (const node of net.inputs) dot(node, node.fed ? node.colour : '#ffffff');
  for (const node of net.hidden) dot(node, now.hidden >= 1 ? '#8cc2ef' : '#ffffff');
  dot(net.output, now.output >= 1 ? '#0f4c81' : '#ffffff');
  pen.restore();
}

/* ---------- The view ---------- */

const VIEWS = { flow, flood, scan };

export default function theme(root, { reduceMotion }) {
  const make = VIEWS[root.dataset.view];
  if (!make) return;
  const readout = root.querySelector('[data-readout]');
  const steps = [...root.querySelectorAll('[data-step]')];
  const overlay = root.querySelector('.tv__overlay');
  const pen = overlay?.getContext('2d');

  let said = '';
  let step = -2;
  const ui = {
    say(en, zhText) {
      if (!readout) return;
      const text = zh() ? zhText : en;
      if (text !== said) readout.textContent = said = text;
    },
    step(i) {
      if (i === step) return;
      step = i;
      steps.forEach((el, k) => el.classList.toggle('is-on', k === i));
    },
  };
  const view = make(ui);
  addEventListener('lab:lang', () => {
    said = '';
  });

  whenNear(root, async () => {
    let ready = false;
    let terrain;
    const paint = (scene) => {
      if (!ready || !pen || !view.overlay) return;
      const { width, height, cssWidth, cssHeight } = scene.state;
      if (overlay.width !== width || overlay.height !== height) {
        overlay.width = width;
        overlay.height = height;
      }
      pen.setTransform(width / cssWidth, 0, 0, height / cssHeight, 0, 0);
      pen.clearRect(0, 0, cssWidth, cssHeight);
      view.overlay(scene, pen);
    };
    try {
      terrain = await createTerrain(root.querySelector('.tv__canvas'), {
        scene: view.scene,
        ...view.camera,
        flow: view.flow,
        swing: 6,
        reduceMotion,
        extra: (scene, now, delta, pass) => {
          if (!ready) return;
          if (pass === 'before') view.frame(scene, reduceMotion);
          else view.draw(scene, pass);
        },
        onFrame: paint,
      });
      if (terrain) {
        await view.setup(terrain.gl, terrain);
        ready = true;
      }
    } catch (error) {
      console.warn('Terrain not available:', error.message);
      return;
    }
    if (!terrain) return;
    root.classList.add('is-live');
    if (reduceMotion) terrain.loop.once();
    else terrain.loop.start();
    bindPause(root, terrain, reduceMotion);
  });
}
