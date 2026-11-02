/*
 * The Earth. A sphere traced per pixel, so its edge is clean at any size, with the river
 * network drawn on top as thin ribbons.
 *
 * The surface comes from one image that holds land height and sea shade (see
 * tools/build_earth.py). Relief is lit here and not painted in, so ridges catch the light as
 * the globe turns.
 *
 * Water moves downstream: each reach knows its distance from the mouth, so a wave of
 * brightness travels through a whole network towards the sea.
 */
import { clamp, createContext, createLoop, createProgram, easeOut, loadBytes, loadTexture, reachBuffer, readRivers } from './core.js';

const QUAD = /* glsl */ `#version 300 es
out vec2 vPosition;
void main() {
  vPosition = vec2(float(gl_VertexID & 1), float((gl_VertexID >> 1) & 1)) * 2.0 - 1.0;
  gl_Position = vec4(vPosition, 0.0, 1.0);
}`;

const SURFACE = /* glsl */ `#version 300 es
precision highp float;
in vec2 vPosition;
out vec4 outColor;
uniform mat3 uTurn;
uniform vec2 uFit;
uniform float uCamera;
uniform float uFocal;
uniform float uPixel;
uniform float uTexels;
uniform sampler2D uRelief;

const float PI = 3.14159265;
const vec3 SUN = normalize(vec3(-0.52, 0.62, 0.59));
const vec3 HALO = vec3(0.56, 0.76, 0.93);
const vec3 SEA_DEEP = vec3(0.145, 0.416, 0.690);
const vec3 SEA_SHORE = vec3(0.420, 0.680, 0.875);
const vec3 LAND_LIT = vec3(0.992, 0.996, 1.000);
const vec3 LAND_SHADE = vec3(0.700, 0.778, 0.860);

vec2 mapOf(vec3 p) {
  return vec2(atan(p.x, p.z) / (2.0 * PI) + 0.5, 0.5 - asin(clamp(p.y, -1.0, 1.0)) / PI);
}

float heightAt(vec2 uv, float lod) {
  return max(textureLod(uRelief, uv, lod).r - 0.46, 0.0);
}

void main() {
  vec3 origin = vec3(0.0, 0.0, uCamera);
  vec3 ray = normalize(vec3(vPosition * uFit, -uFocal));
  float along = dot(origin, ray);
  float miss = sqrt(max(dot(origin, origin) - along * along, 0.0));
  float inside = smoothstep(1.0 + uPixel, 1.0 - uPixel, miss);

  // A soft edge of air, which is the only thing that separates the globe from a white page.
  float air = clamp((1.13 - miss) / 0.13, 0.0, 1.0);
  vec4 halo = vec4(HALO, 1.0) * air * air * air * 0.62;
  if (inside <= 0.0) {
    outColor = halo;
    return;
  }

  float depth = -along - sqrt(max(along * along - dot(origin, origin) + 1.0, 0.0));
  vec3 point = origin + ray * depth;
  vec3 normal = normalize(point);
  vec3 place = normal * uTurn;
  float facing = max(dot(normal, -ray), 0.02);

  // Mipmaps by hand, because the longitude seam would upset the automatic choice.
  float lod = clamp(log2(uTexels * uPixel / facing), 0.0, 5.0);
  float step1 = pow(2.0, lod) / 2048.0;
  vec2 uv = mapOf(place);
  float cosLat = max(sqrt(1.0 - place.y * place.y), 0.05);

  float value = textureLod(uRelief, uv, lod).r;
  float soft = 0.012 + 0.03 * lod;
  float land = smoothstep(0.38 - soft, 0.38 + soft, value);

  // Relief as a tilted normal: the slope of the height field in east and north.
  vec2 du = vec2(step1 / cosLat, 0.0);
  vec2 dv = vec2(0.0, step1);
  float east = heightAt(uv + du, lod) - heightAt(uv - du, lod);
  float north = heightAt(uv - dv, lod) - heightAt(uv + dv, lod);
  vec3 eastward = normalize(cross(vec3(0.0, 1.0, 0.0) * transpose(uTurn), normal) + 1e-5);
  vec3 northward = cross(normal, eastward);
  vec3 bumped = normalize(normal - (eastward * east + northward * north) * 15.0);

  float light = dot(normal, SUN) * 0.5 + 0.5;
  float reliefLight = clamp(dot(bumped, SUN) - dot(normal, SUN), -1.0, 1.0);

  float altitude = max(value - 0.46, 0.0) / 0.54;
  vec3 ground = mix(LAND_SHADE, LAND_LIT, smoothstep(0.10, 0.74, light + reliefLight * 1.5));
  ground = mix(ground, ground * vec3(0.90, 0.935, 0.975), smoothstep(0.25, 0.8, altitude));

  // Read a coarser level for the sea, which has no detail of its own to lose.
  float seaShade = clamp(textureLod(uRelief, uv, lod + 3.0).r / 0.30, 0.0, 1.0) * (1.0 - land);
  vec3 sea = mix(SEA_DEEP, SEA_SHORE, seaShade * seaShade) * (0.74 + 0.30 * light);
  vec3 glint = reflect(ray, normal);
  sea += vec3(0.65, 0.78, 0.90) * pow(max(dot(glint, SUN), 0.0), 40.0) * 0.28;

  // Parallels and meridians every 30 degrees, faint, as on a printed globe.
  vec2 degrees = vec2(uv.x * 360.0, uv.y * 180.0);
  vec2 cell = abs(fract(degrees / 30.0 + 0.5) - 0.5) * 30.0;
  float width = 1.5 * uPixel * 57.3 / facing;
  float grid = 1.0 - smoothstep(width * 0.3, width, min(cell.x * cosLat, cell.y));
  grid *= smoothstep(0.985, 0.93, abs(place.y));

  vec3 colour = mix(sea, ground, land);
  colour = mix(colour, mix(vec3(1.0), vec3(0.56, 0.70, 0.83), land), grid * mix(0.16, 0.20, land));

  // The limb takes the colour of the air, as it does from orbit.
  float limb = pow(1.0 - facing, 3.2);
  colour = mix(colour, vec3(0.74, 0.87, 0.97), limb * 0.72);

  outColor = vec4(colour, 1.0) * inside + halo * (1.0 - inside);
}`;

const SPHERE_POINT = /* glsl */ `
const float EPS = 1e-4;
vec3 onSphere(vec2 lonLat) {
  float lon = radians(lonLat.x);
  float lat = radians(lonLat.y);
  float c = cos(lat);
  return vec3(c * sin(lon), sin(lat), c * cos(lon));
}
vec3 project(vec3 v, float camera, float focal, vec2 fit) {
  float depth = camera - v.z;
  return vec3(v.xy * focal / depth / fit, depth);
}`;

const RIVER_VERTEX = /* glsl */ `#version 300 es
precision highp float;
layout(location = 0) in vec3 aStart;
layout(location = 1) in vec3 aEnd;
layout(location = 2) in float aGrade;
uniform mat3 uTurn;
uniform vec2 uFit;
uniform vec2 uCanvas;
uniform float uCamera;
uniform float uFocal;
uniform float uThickness;
out float vKm;
out float vEdge;
out float vHalf;
out float vFace;
out float vGrade;
${SPHERE_POINT}
void main() {
  float end = float(gl_VertexID & 1);
  float side = float((gl_VertexID >> 1) & 1) * 2.0 - 1.0;

  vec3 a = uTurn * onSphere(aStart.xy) * 1.0015;
  vec3 b = uTurn * onSphere(aEnd.xy) * 1.0015;
  vec3 here = mix(a, b, end);
  vec2 pa = project(a, uCamera, uFocal, uFit).xy;
  vec2 pb = project(b, uCamera, uFocal, uFit).xy;

  vec2 line = (pb - pa) * uCanvas;
  float length_ = length(line);
  vec2 across = length_ > EPS ? vec2(-line.y, line.x) / length_ : vec2(0.0, 1.0);

  // Thin rivers fade rather than break up when they fall under a pixel.
  float widthPx = (0.55 + 2.9 * aGrade * aGrade * aGrade + 0.45 * aGrade) * uThickness;
  vHalf = widthPx * 0.5;
  vEdge = side * (vHalf + 1.0);
  vKm = mix(aStart.z, aEnd.z, end);
  vGrade = aGrade;
  vFace = smoothstep(1.0 / uCamera, 1.0 / uCamera + 0.16, here.z);

  vec2 centre = mix(pa, pb, end);
  gl_Position = vec4(centre + across * vEdge * 2.0 / uCanvas, 0.0, 1.0);
}`;

const RIVER_FRAGMENT = /* glsl */ `#version 300 es
precision highp float;
in float vKm;
in float vEdge;
in float vHalf;
in float vFace;
in float vGrade;
out vec4 outColor;
uniform float uTime;
uniform float uReach;

const vec3 CHANNEL = vec3(0.070, 0.345, 0.620);
const vec3 CREST = vec3(0.000, 0.610, 0.960);

void main() {
  if (vKm > uReach) discard;
  float width = min(vHalf * 2.0, 1.0);
  float cover = clamp(vHalf + 0.5 - abs(vEdge), 0.0, 1.0) * width;

  // Bands of water, a few hundred kilometres long, running towards the mouth.
  float wave = fract(vKm / 1500.0 + uTime * 0.16);
  float crest = smoothstep(0.0, 0.05, wave) * smoothstep(0.34, 0.05, wave);
  vec3 colour = mix(CHANNEL, CREST, crest);
  float alpha = cover * vFace * (0.62 + 0.30 * vGrade + 0.34 * crest);
  outColor = vec4(colour, 1.0) * clamp(alpha, 0.0, 1.0);
}`;

const toRad = Math.PI / 180;
const DISTANCE = 4.6;
const RADIUS_IN_VIEW = 0.86;

/** Point for a place, as the camera sees it, and whether it faces the viewer. */
function turnMatrix(spin, tilt) {
  const cy = Math.cos(spin);
  const sy = Math.sin(spin);
  const cx = Math.cos(tilt);
  const sx = Math.sin(tilt);
  // Rotation about y, then about x. Columns, as WebGL reads them.
  return new Float32Array([cy, sx * sy, -cx * sy, 0, cx, sx, sy, -sx * cy, cx * cy]);
}

export function lonLatToWorld(lon, lat) {
  const c = Math.cos(lat * toRad);
  return [c * Math.sin(lon * toRad), Math.sin(lat * toRad), c * Math.cos(lon * toRad)];
}

export function applyTurn(m, [x, y, z]) {
  return [m[0] * x + m[3] * y + m[6] * z, m[1] * x + m[4] * y + m[7] * z, m[2] * x + m[5] * y + m[8] * z];
}

export async function createGlobe(canvas, { base = '/earth', centre = [104, 24], speed = 3.2, reduceMotion = false, intro = true, radius = RADIUS_IN_VIEW, extra, onFrame }) {
  const gl = createContext(canvas);
  if (!gl) return null;

  const surface = createProgram(gl, QUAD, SURFACE);
  const rivers = createProgram(gl, RIVER_VERTEX, RIVER_FRAGMENT);
  const [relief, bytes] = await Promise.all([loadTexture(gl, `${base}/relief.webp`, { repeat: true }), loadBytes(`${base}/rivers.bin`)]);
  const { reaches, count } = readRivers(bytes);
  const reachVao = reachBuffer(gl, reaches);
  const emptyVao = gl.createVertexArray();

  const state = {
    spin: -centre[0] * toRad,
    tilt: centre[1] * toRad,
    velocity: 0,
    dragging: false,
    idleSince: 0,
    time: 0,
    reach: intro && !reduceMotion ? 0 : 1e5,
    started: 0,
    width: 1,
    height: 1,
    cssWidth: 1,
    cssHeight: 1,
    fit: [1, 1],
    focal: 1,
    pixel: 0.002,
    target: null,
    turn: turnMatrix(0, 0),
  };

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);

  const scene = {
    gl,
    state,
    distance: DISTANCE,
    project(place) {
      const v = applyTurn(state.turn, place);
      const depth = DISTANCE - v[2];
      const x = (v[0] * state.focal) / depth / state.fit[0];
      const y = (v[1] * state.focal) / depth / state.fit[1];
      return { x: ((x + 1) / 2) * state.cssWidth, y: ((1 - y) / 2) * state.cssHeight, front: v[2] - 1 / DISTANCE };
    },
    aim(lon, lat) {
      state.target = { spin: -lon * toRad, tilt: clamp(lat, -50, 60) * toRad };
      if (state.paused || !loop.running) {
        state.spin = state.target.spin;
        state.tilt = state.target.tilt;
        state.target = null;
        loop.once();
      }
    },
    uniforms(program) {
      gl.uniformMatrix3fv(program.u.uTurn, false, state.turn);
      gl.uniform2fv(program.u.uFit, state.fit);
      gl.uniform2f(program.u.uCanvas, state.width / 2, state.height / 2);
      gl.uniform1f(program.u.uCamera, DISTANCE);
      gl.uniform1f(program.u.uFocal, state.focal);
    },
  };

  const resize = (width, height, cssWidth, cssHeight) => {
    Object.assign(state, { width, height, cssWidth, cssHeight });
    gl.viewport(0, 0, width, height);
    const small = Math.min(width, height);
    state.fit = [width / small, height / small];
    // The focal length that makes the sphere fill `radius` of the shorter side.
    const edge = 1 / Math.sqrt(DISTANCE * DISTANCE - 1);
    state.focal = radius / edge;
    state.pixel = 2 / (radius * small); // Size of one pixel, measured on the globe.
  };

  const draw = (now, delta) => {
    if (!state.started) state.started = now;
    const moving = loop.running && !state.paused;
    if (moving) state.time += delta / 1000;

    if (state.target) {
      // Take the short way round to a place someone asked for.
      const away = (state.target.spin - state.spin) % (Math.PI * 2);
      const turnBy = ((away + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      const follow = 1 - Math.exp(-delta / 260);
      state.spin += turnBy * follow;
      state.tilt += (state.target.tilt - state.tilt) * follow;
      if (Math.abs(turnBy) < 0.002) state.target = null;
    } else if (!state.dragging && moving) {
      state.velocity *= Math.exp(-delta / 700);
      const rest = now - state.idleSince > 1800 && !reduceMotion ? (speed * toRad) / 1000 : 0;
      state.spin += (state.velocity + rest) * delta;
    }

    if (state.reach < 1e5) {
      const t = clamp((now - state.started) / 2600, 0, 1);
      state.reach = t === 1 ? 1e5 : 80 + 6400 * easeOut(t);
    }

    state.turn = turnMatrix(state.spin, state.tilt);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(surface.handle);
    gl.bindVertexArray(emptyVao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, relief.texture);
    gl.uniform1i(surface.u.uRelief, 0);
    scene.uniforms(surface);
    gl.uniform1f(surface.u.uPixel, state.pixel);
    gl.uniform1f(surface.u.uTexels, relief.width / (2 * Math.PI));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.useProgram(rivers.handle);
    gl.bindVertexArray(reachVao);
    scene.uniforms(rivers);
    gl.uniform1f(rivers.u.uTime, state.time);
    gl.uniform1f(rivers.u.uReach, state.reach);
    gl.uniform1f(rivers.u.uThickness, clamp((state.height / 1000) * 1.05, 0.72, 2.2));
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);

    extra?.(scene, now, delta);
    gl.bindVertexArray(null);
    onFrame?.(scene);
    return true;
  };

  const loop = createLoop(canvas, { draw, resize });
  scene.loop = loop;

  // Dragging turns the globe sideways and leaves the page free to scroll on a touch screen.
  let lastX = 0;
  let lastY = 0;
  let lastTime = 0;
  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    state.dragging = true;
    state.target = null;
    state.velocity = 0;
    lastX = event.clientX;
    lastY = event.clientY;
    lastTime = event.timeStamp;
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add('is-dragging');
    if (!loop.running) loop.once();
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!state.dragging) return;
    const unit = 1 / (Math.min(state.cssWidth, state.cssHeight) * 0.42);
    const dx = (event.clientX - lastX) * unit;
    const dy = (event.clientY - lastY) * unit;
    const elapsed = Math.max(event.timeStamp - lastTime, 1);
    state.spin += dx;
    state.tilt = clamp(state.tilt + dy, -1.2, 1.2);
    state.velocity = dx / elapsed;
    lastX = event.clientX;
    lastY = event.clientY;
    lastTime = event.timeStamp;
    if (!loop.running) loop.once();
  });
  const release = () => {
    if (!state.dragging) return;
    state.dragging = false;
    state.idleSince = performance.now();
    canvas.classList.remove('is-dragging');
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('lostpointercapture', release);

  scene.pause = (paused) => {
    state.paused = paused;
    if (paused) loop.stop();
    else loop.start();
  };

  return scene;
}
