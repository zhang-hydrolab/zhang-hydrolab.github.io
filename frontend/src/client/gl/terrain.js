/*
 * A block of real terrain, drawn like the block diagrams of a physical geography textbook:
 * a lit surface with contour lines, the rivers routed over that same surface, cut walls, and
 * the sea at its true level where the block reaches the coast.
 *
 * Heights and rivers come from tools/build_earth.py. Height is sampled in the vertex shader,
 * so the mesh needs no data of its own and can rise out of the plane when it first appears.
 */
import { clamp, createContext, createLoop, createProgram, easeOut, loadBytes, loadTexture, reachBuffer, readRivers } from './core.js';

const LIFT = 0.25;

export const HEIGHT = /* glsl */ `
uniform sampler2D uHeight;
uniform float uRise;
uniform float uDepth;

// The image stores the square root of relative height, with 0 for the sea. A coarser level
// is read for the mesh: the block is a model of the landscape, not a survey of every ridge.
float heightAt(vec2 uv) {
  float v = textureLod(uHeight, uv, 2.4).r;
  float h = max(v - 0.04, 0.0) / 0.96;
  return h * h;
}

vec3 placeAt(vec2 uv) {
  return vec3(uv.x * 2.0 - 1.0, heightAt(uv) * ${LIFT.toFixed(2)} * uRise, (uv.y * 2.0 - 1.0) * uDepth);
}`;

const SURFACE_VERTEX = /* glsl */ `#version 300 es
precision highp float;
layout(location = 0) in vec2 aGrid;
uniform mat4 uCamera;
out vec2 vUv;
out float vHeight;
${HEIGHT}
void main() {
  vUv = aGrid;
  vec3 p = placeAt(aGrid);
  vHeight = heightAt(aGrid);
  gl_Position = uCamera * vec4(p, 1.0);
}`;

const SURFACE_FRAGMENT = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
in float vHeight;
out vec4 outColor;
uniform sampler2D uHeight;
uniform vec2 uTexel;
uniform float uMeters;
uniform float uBase;
uniform float uContour;
uniform float uTime;
uniform float uRise;

const vec3 SUN = normalize(vec3(-0.55, 0.72, 0.42));

float at(vec2 uv) {
  float h = max(textureLod(uHeight, uv, 2.1).r - 0.04, 0.0) / 0.96;
  return h * h;
}

void main() {
  float raw = texture(uHeight, vUv).r;
  float land = smoothstep(0.012, 0.03, raw);

  float slopeX = at(vUv + vec2(uTexel.x, 0.0)) - at(vUv - vec2(uTexel.x, 0.0));
  float slopeZ = at(vUv + vec2(0.0, uTexel.y)) - at(vUv - vec2(0.0, uTexel.y));
  vec3 normal = normalize(vec3(-slopeX * 26.0, 1.0, -slopeZ * 26.0));
  float lit = dot(normal, SUN);

  vec3 shade = vec3(0.640, 0.735, 0.835);
  vec3 bright = vec3(0.998, 0.999, 1.000);
  vec3 colour = mix(shade, bright, smoothstep(0.12, 0.84, lit));
  colour = mix(colour, colour * vec3(0.90, 0.94, 0.985), smoothstep(0.1, 0.9, sqrt(vHeight)));

  // Contours in metres, every fifth one heavier, the way a survey map draws them.
  float metres = uBase + at(vUv) * uMeters;
  float level = metres / uContour;
  float width = fwidth(level);
  float line = 1.0 - smoothstep(0.0, 1.2, abs(fract(level - 0.5) - 0.5) / max(width, 1e-4));
  float major = metres / (uContour * 5.0);
  float widthMajor = fwidth(major);
  float heavy = 1.0 - smoothstep(0.0, 1.6, abs(fract(major - 0.5) - 0.5) / max(widthMajor, 1e-4));
  float crowded = smoothstep(0.30, 0.10, width);
  float crowdedMajor = smoothstep(0.34, 0.12, widthMajor);
  colour = mix(colour, vec3(0.170, 0.420, 0.660), max(line * 0.16 * crowded, heavy * 0.30 * crowdedMajor) * uRise);

  // Sea: flat, with slow swells of lighter water.
  float swell = sin(vUv.x * 90.0 + vUv.y * 34.0 + uTime * 0.7) * sin(vUv.y * 120.0 - uTime * 0.5);
  vec3 sea = mix(vec3(0.250, 0.530, 0.780), vec3(0.380, 0.640, 0.860), 0.5 + 0.25 * swell);
  outColor = vec4(mix(sea, colour, land), 1.0);
}`;

const WALL_VERTEX = /* glsl */ `#version 300 es
precision highp float;
layout(location = 0) in vec3 aWall;
uniform mat4 uCamera;
out float vLevel;
${HEIGHT}
void main() {
  vec3 p = placeAt(aWall.xy);
  p.y = mix(p.y, -0.13, aWall.z);
  vLevel = p.y;
  gl_Position = uCamera * vec4(p, 1.0);
}`;

const WALL_FRAGMENT = /* glsl */ `#version 300 es
precision highp float;
in float vLevel;
out vec4 outColor;
void main() {
  // Level bands, as in a geological section: ground, water table, bedrock.
  vec3 ground = vec3(0.835, 0.895, 0.950);
  vec3 water = vec3(0.330, 0.570, 0.790);
  vec3 rock = vec3(0.075, 0.270, 0.470);
  float colour1 = smoothstep(-0.018, -0.052, vLevel);
  float colour2 = smoothstep(-0.066, -0.118, vLevel);
  outColor = vec4(mix(mix(ground, water, colour1), rock, colour2), 1.0);
}`;

const RIVER_VERTEX = /* glsl */ `#version 300 es
precision highp float;
layout(location = 0) in vec3 aStart;
layout(location = 1) in vec3 aEnd;
layout(location = 2) in float aGrade;
uniform mat4 uCamera;
uniform vec4 uBounds;
uniform vec2 uCanvas;
uniform float uThickness;
out float vKm;
out float vEdge;
out float vHalf;
out float vGrade;
${HEIGHT}
vec2 uvOf(vec2 lonLat) {
  return vec2((lonLat.x - uBounds.x) / (uBounds.z - uBounds.x), (uBounds.w - lonLat.y) / (uBounds.w - uBounds.y));
}
void main() {
  float end = float(gl_VertexID & 1);
  float side = float((gl_VertexID >> 1) & 1) * 2.0 - 1.0;
  vec4 a = uCamera * vec4(placeAt(uvOf(aStart.xy)) + vec3(0.0, 0.003, 0.0), 1.0);
  vec4 b = uCamera * vec4(placeAt(uvOf(aEnd.xy)) + vec3(0.0, 0.003, 0.0), 1.0);
  vec2 pa = a.xy / a.w;
  vec2 pb = b.xy / b.w;
  vec2 line = (pb - pa) * uCanvas;
  float size = length(line);
  vec2 across = size > 1e-4 ? vec2(-line.y, line.x) / size : vec2(0.0, 1.0);

  vHalf = (0.5 + 1.7 * aGrade * aGrade * aGrade + 0.4 * aGrade) * uThickness * 0.5;
  vEdge = side * (vHalf + 1.0);
  vKm = mix(aStart.z, aEnd.z, end);
  vGrade = aGrade;
  vec4 here = mix(a, b, end);
  gl_Position = vec4(here.xy + across * vEdge * 2.0 / uCanvas * here.w, here.z - 0.0012 * here.w, here.w);
}`;

const RIVER_FRAGMENT = /* glsl */ `#version 300 es
precision highp float;
in float vKm;
in float vEdge;
in float vHalf;
in float vGrade;
out vec4 outColor;
uniform float uTime;
uniform float uFlow;
uniform float uRise;
void main() {
  float cover = clamp(vHalf + 0.5 - abs(vEdge), 0.0, 1.0);
  float wave = fract(vKm / 260.0 + uTime * uFlow);
  float crest = smoothstep(0.0, 0.06, wave) * smoothstep(0.42, 0.06, wave);
  vec3 colour = mix(vec3(0.085, 0.370, 0.650), vec3(0.000, 0.640, 0.980), crest);
  outColor = vec4(colour, 1.0) * cover * uRise * min(vHalf * 2.0, 1.0);
}`;

function perspective(fov, aspect, near, far) {
  const f = 1 / Math.tan(fov / 2);
  return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, (2 * far * near) / (near - far), 0];
}

function lookAt([ex, ey, ez], [cx, cy, cz]) {
  let zx = ex - cx;
  let zy = ey - cy;
  let zz = ez - cz;
  const zl = Math.hypot(zx, zy, zz);
  zx /= zl;
  zy /= zl;
  zz /= zl;
  let xx = zz;
  let xy = 0;
  let xz = -zx;
  const xl = Math.hypot(xx, xy, xz);
  xx /= xl;
  xz /= xl;
  const yx = zy * xz - zz * xy;
  const yy = zz * xx - zx * xz;
  const yz = zx * xy - zy * xx;
  return [xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0, -(xx * ex + xz * ez), -(yx * ex + yy * ey + yz * ez), -(zx * ex + zy * ey + zz * ez), 1];
}

function multiply(a, b) {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c += 1) {
    for (let r = 0; r < 4; r += 1) {
      out[c * 4 + r] = a[r] * b[c * 4] + a[r + 4] * b[c * 4 + 1] + a[r + 8] * b[c * 4 + 2] + a[r + 12] * b[c * 4 + 3];
    }
  }
  return out;
}

function gridMesh(gl, columns, rows) {
  const vertices = new Float32Array((columns + 1) * (rows + 1) * 2);
  let at = 0;
  for (let r = 0; r <= rows; r += 1) {
    for (let c = 0; c <= columns; c += 1) {
      vertices[at++] = c / columns;
      vertices[at++] = r / rows;
    }
  }
  const indices = new Uint32Array(columns * rows * 6);
  at = 0;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < columns; c += 1) {
      const a = r * (columns + 1) + c;
      const b = a + 1;
      const d = a + columns + 1;
      const e = d + 1;
      indices.set([a, d, b, b, d, e], at);
      at += 6;
    }
  }
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
  gl.bindVertexArray(null);
  return { vao, count: indices.length };
}

/** The four cut faces: a ribbon of quads running round the edge of the block. */
function wallMesh(gl, columns, rows) {
  const edge = [];
  for (let c = 0; c <= columns; c += 1) edge.push([c / columns, 1]);
  for (let r = rows - 1; r >= 0; r -= 1) edge.push([1, r / rows]);
  for (let c = columns - 1; c >= 0; c -= 1) edge.push([c / columns, 0]);
  for (let r = 1; r <= rows; r += 1) edge.push([0, r / rows]);
  const vertices = new Float32Array(edge.length * 2 * 3);
  edge.forEach(([x, y], i) => {
    vertices.set([x, y, 0, x, y, 1], i * 6);
  });
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  return { vao, count: edge.length * 2 };
}

const toRad = Math.PI / 180;

/**
 * options: scene (file name), yaw and pitch of the camera in degrees, distance, rise (seconds),
 * contour (metres), and extra(scene, now, delta) to add to the picture.
 */
export async function createTerrain(canvas, { scene: name, base = '/earth', yaw = -24, pitch = 32, distance = 3.5, contour = 200, swing = 7, reduceMotion = false, flow = 0.32, extra, onFrame }) {
  const gl = createContext(canvas, { depth: true });
  if (!gl) return null;

  const [height, bytes] = await Promise.all([loadTexture(gl, `${base}/${name}.webp`), loadBytes(`${base}/${name}.bin`)]);
  const { reaches, count, header } = readRivers(bytes, 6);
  const [lon0, lat0, lon1, lat1, hMin, hMax] = header;
  const depth = height.height / height.width;

  const surface = createProgram(gl, SURFACE_VERTEX, SURFACE_FRAGMENT);
  const walls = createProgram(gl, WALL_VERTEX, WALL_FRAGMENT);
  const rivers = createProgram(gl, RIVER_VERTEX, RIVER_FRAGMENT);

  const columns = 340;
  const rows = Math.round(columns * depth);
  const mesh = gridMesh(gl, columns, rows);
  const wall = wallMesh(gl, columns, rows);
  const reachVao = reachBuffer(gl, reaches);

  const state = {
    yaw: yaw * toRad,
    pitch: pitch * toRad,
    baseYaw: yaw * toRad,
    aimYaw: 0,
    aimPitch: 0,
    time: 0,
    rise: reduceMotion ? 1 : 0,
    started: 0,
    width: 1,
    height: 1,
    cssWidth: 1,
    cssHeight: 1,
    aspect: 1,
    camera: new Float32Array(16),
    flow,
    paused: false,
  };

  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0, 0, 0, 0);

  const scene = {
    gl,
    state,
    depth,
    bounds: { lon0, lat0, lon1, lat1, hMin, hMax },
    sample: null,
    /** Canvas position of a point on the block, in CSS pixels. */
    project(x, y, z) {
      const m = state.camera;
      const w = m[3] * x + m[7] * y + m[11] * z + m[15];
      return {
        x: (((m[0] * x + m[4] * y + m[8] * z + m[12]) / w + 1) / 2) * state.cssWidth,
        y: ((1 - (m[1] * x + m[5] * y + m[9] * z + m[13]) / w) / 2) * state.cssHeight,
      };
    },
    heights(program) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, height.texture);
      gl.uniform1i(program.u.uHeight, 0);
      gl.uniform1f(program.u.uRise, state.rise);
      gl.uniform1f(program.u.uDepth, depth);
    },
  };

  const resize = (width, heightPx, cssWidth, cssHeight) => {
    Object.assign(state, { width, height: heightPx, cssWidth, cssHeight, aspect: width / heightPx });
    gl.viewport(0, 0, width, heightPx);
  };

  const draw = (now, delta) => {
    if (!state.started) state.started = now;
    const moving = loop.running;
    if (moving) state.time += delta / 1000;
    if (!reduceMotion) {
      const t = clamp((now - state.started) / 1700, 0, 1);
      state.rise = easeOut(t);
    }

    // Follow the pointer a little, and drift slowly so the block never looks like a picture.
    const drift = reduceMotion ? 0 : Math.sin(state.time * 0.13) * 3 * toRad;
    const follow = 1 - Math.exp(-delta / 240);
    state.yaw += (state.baseYaw + drift + state.aimYaw * swing * toRad - state.yaw) * follow;
    state.pitch += (pitch * toRad + state.aimPitch * 2.2 * toRad - state.pitch) * follow;

    const eye = [Math.sin(state.yaw) * Math.cos(state.pitch) * distance, Math.sin(state.pitch) * distance, Math.cos(state.yaw) * Math.cos(state.pitch) * distance];
    // A long lens, because a block diagram should not look like a wide-angle photograph.
    const fov = 2 * Math.atan(Math.tan(13.5 * toRad) * Math.max(1, 1.5 / state.aspect));
    state.camera = multiply(perspective(fov, state.aspect, 0.1, 20), lookAt(eye, [0, -0.03, 0]));

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(walls.handle);
    scene.heights(walls);
    gl.uniformMatrix4fv(walls.u.uCamera, false, state.camera);
    gl.bindVertexArray(wall.vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, wall.count);

    gl.useProgram(surface.handle);
    scene.heights(surface);
    gl.uniformMatrix4fv(surface.u.uCamera, false, state.camera);
    gl.uniform2f(surface.u.uTexel, 3.0 / height.width, 3.0 / height.height);
    gl.uniform1f(surface.u.uMeters, hMax - hMin);
    gl.uniform1f(surface.u.uBase, hMin);
    gl.uniform1f(surface.u.uContour, contour);
    gl.uniform1f(surface.u.uTime, state.time);
    gl.bindVertexArray(mesh.vao);
    gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_INT, 0);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(rivers.handle);
    scene.heights(rivers);
    gl.uniformMatrix4fv(rivers.u.uCamera, false, state.camera);
    gl.uniform4f(rivers.u.uBounds, lon0, lat0, lon1, lat1);
    gl.uniform2f(rivers.u.uCanvas, state.width / 2, state.height / 2);
    gl.uniform1f(rivers.u.uThickness, clamp(state.height / 620, 0.8, 2.4));
    gl.uniform1f(rivers.u.uTime, state.time);
    gl.uniform1f(rivers.u.uFlow, state.flow);
    gl.bindVertexArray(reachVao);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);

    extra?.(scene, now, delta);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
    onFrame?.(scene);
    return true;
  };

  const loop = createLoop(canvas, { draw, resize });
  scene.loop = loop;

  if (!reduceMotion) {
    canvas.parentElement.addEventListener('pointermove', (event) => {
      const box = canvas.getBoundingClientRect();
      state.aimYaw = clamp((event.clientX - box.left) / box.width - 0.5, -0.5, 0.5) * 2;
      state.aimPitch = clamp((event.clientY - box.top) / box.height - 0.5, -0.5, 0.5) * 2;
    });
    canvas.parentElement.addEventListener('pointerleave', () => {
      state.aimYaw = 0;
      state.aimPitch = 0;
    });
  }

  scene.pause = (paused) => {
    state.paused = paused;
    if (paused) loop.stop();
    else loop.start();
  };

  return scene;
}
