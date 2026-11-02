/*
 * The collaboration network on the globe: great-circle arcs from Beijing to each city, with
 * the same rivers and relief as the front page. The flat map stays underneath for browsers
 * without WebGL, and its links remain the way into the list of people.
 */
import { bindPause, clamp, createProgram, whenNear } from '../gl/core.js';
import { applyTurn, createGlobe, lonLatToWorld } from '../gl/globe.js';

const SEGMENTS = 64;

const ARC_VERTEX = /* glsl */ `#version 300 es
precision highp float;
layout(location = 0) in vec3 aFrom;
layout(location = 1) in vec3 aTo;
layout(location = 2) in float aLift;
layout(location = 3) in float aIndex;
uniform mat3 uTurn;
uniform vec2 uFit;
uniform vec2 uCanvas;
uniform float uCamera;
uniform float uFocal;
uniform float uThickness;
out float vAlong;
out float vEdge;
out float vFace;
flat out float vIndex;

vec3 onArc(float t) {
  float angle = acos(clamp(dot(aFrom, aTo), -1.0, 1.0));
  vec3 p = (sin((1.0 - t) * angle) * aFrom + sin(t * angle) * aTo) / sin(angle);
  return p * (1.0 + aLift * 4.0 * t * (1.0 - t));
}

vec2 toScreen(vec3 v) {
  return v.xy * uFocal / (uCamera - v.z) / uFit;
}

void main() {
  float step_ = 1.0 / ${SEGMENTS}.0;
  float segment = floor(float(gl_VertexID) / 2.0);
  float side = float(gl_VertexID & 1) * 2.0 - 1.0;
  float t = segment * step_;
  vec3 here = uTurn * onArc(t);
  vec3 near = uTurn * onArc(clamp(t + step_ * 0.5, 0.0, 1.0));
  vec3 back = uTurn * onArc(clamp(t - step_ * 0.5, 0.0, 1.0));
  vec2 line = (toScreen(near) - toScreen(back)) * uCanvas;
  vec2 across = vec2(-line.y, line.x) / max(length(line), 1e-4);
  vEdge = side * 2.4 * uThickness;
  vAlong = t;
  vIndex = aIndex;
  float limb = 1.0 / uCamera;
  // An arc above the surface can be seen past the edge of the globe, but not through it.
  vFace = 1.0 - step(here.z, limb) * step(length(here.xy), 1.0);
  gl_Position = vec4(toScreen(here) + across * vEdge * 2.0 / uCanvas, 0.0, 1.0);
}`;

const ARC_FRAGMENT = /* glsl */ `#version 300 es
precision highp float;
in float vAlong;
in float vEdge;
in float vFace;
flat in float vIndex;
out vec4 outColor;
uniform float uTime;
uniform float uDraw;
uniform float uFocus;
uniform float uThickness;
void main() {
  float reveal = clamp(uDraw * 2.2 - vIndex * 0.14, 0.0, 1.0);
  if (vAlong > reveal) discard;
  bool chosen = abs(vIndex - uFocus) < 0.5;
  float half_ = (chosen ? 1.5 : 0.85) * uThickness;
  float cover = clamp(half_ + 0.5 - abs(vEdge), 0.0, 1.0);
  float pulse = fract(vAlong * 1.5 - uTime * 0.28 + vIndex * 0.17);
  float crest = smoothstep(0.86, 0.98, pulse) * (1.0 - smoothstep(0.98, 1.0, pulse));
  vec3 base = chosen ? vec3(0.000, 0.300, 0.620) : vec3(0.040, 0.300, 0.540);
  vec3 colour = mix(base, vec3(0.000, 0.640, 0.980), crest);
  float dim = uFocus < 0.0 || chosen ? 1.0 : 0.42;
  outColor = vec4(colour, 1.0) * cover * vFace * dim;
}`;

const NODE_VERTEX = /* glsl */ `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPlace;
layout(location = 1) in float aIndex;
uniform mat3 uTurn;
uniform vec2 uFit;
uniform float uCamera;
uniform float uFocal;
uniform float uSize;
uniform float uFocus;
out float vFace;
flat out float vChosen;
void main() {
  vec3 v = uTurn * aPlace * 1.002;
  vChosen = abs(aIndex - uFocus) < 0.5 ? 1.0 : 0.0;
  vFace = smoothstep(1.0 / uCamera, 1.0 / uCamera + 0.06, v.z);
  gl_Position = vec4(v.xy * uFocal / (uCamera - v.z) / uFit, 0.0, 1.0);
  gl_PointSize = uSize * (vChosen > 0.5 ? 2.6 : 1.8);
}`;

const NODE_FRAGMENT = /* glsl */ `#version 300 es
precision highp float;
in float vFace;
flat in float vChosen;
out vec4 outColor;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float dot_ = 1.0 - smoothstep(0.34, 0.42, r);
  float ring = (1.0 - smoothstep(0.86, 1.0, r)) * smoothstep(0.42, 0.5, r);
  vec3 colour = vec3(0.040, 0.300, 0.540);
  float alpha = max(dot_, ring * 0.3);
  outColor = vec4(colour, 1.0) * alpha * vFace;
}`;

function buildArcs(gl, home, places) {
  const from = lonLatToWorld(home.lon, home.lat);
  const rows = (SEGMENTS + 1) * 2;
  const data = [];
  places.forEach((place, index) => {
    const to = lonLatToWorld(place.lon, place.lat);
    const angle = Math.acos(clamp(from[0] * to[0] + from[1] * to[1] + from[2] * to[2], -1, 1));
    data.push(...from, ...to, 0.05 + 0.2 * (angle / Math.PI), index);
  });
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
  const stride = 8 * 4;
  [
    [0, 3, 0],
    [1, 3, 12],
    [2, 1, 24],
    [3, 1, 28],
  ].forEach(([location, size, offset]) => {
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride, offset);
    gl.vertexAttribDivisor(location, 1);
  });
  gl.bindVertexArray(null);
  return { vao, rows, count: places.length };
}

function buildNodes(gl, home, places) {
  const data = [];
  places.forEach((place, index) => data.push(...lonLatToWorld(place.lon, place.lat), index));
  data.push(...lonLatToWorld(home.lon, home.lat), -5);
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 16, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 16, 12);
  gl.bindVertexArray(null);
  return { vao, count: places.length + 1 };
}

/** The point halfway along the shortest way between two places. */
function midpoint(a, b) {
  const [x, y, z] = [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const size = Math.hypot(x, y, z) || 1;
  return { lon: (Math.atan2(x, z) * 180) / Math.PI, lat: (Math.asin(y / size) * 180) / Math.PI };
}

export default function collabglobe(stage, { reduceMotion }) {
  const root = stage.closest('section');
  const home = { lon: Number(stage.dataset.lon), lat: Number(stage.dataset.lat) };
  const homePlace = lonLatToWorld(home.lon, home.lat);
  const links = [...stage.querySelectorAll('[data-city]')];
  const places = links.map((el) => ({ el, city: el.dataset.city, lon: Number(el.dataset.lon), lat: Number(el.dataset.lat), place: lonLatToWorld(Number(el.dataset.lon), Number(el.dataset.lat)) }));

  whenNear(stage, async () => {
    let arcs;
    let nodes;
    let arcProgram;
    let nodeProgram;
    let focus = -1;
    let started = 0;

    const extra = (scene, now) => {
      const { gl, state } = scene;
      if (!arcProgram) {
        arcProgram = createProgram(gl, ARC_VERTEX, ARC_FRAGMENT);
        nodeProgram = createProgram(gl, NODE_VERTEX, NODE_FRAGMENT);
        arcs = buildArcs(gl, home, places);
        nodes = buildNodes(gl, home, places);
        started = now;
      }
      const thickness = clamp(state.height / 760, 0.8, 2);
      gl.useProgram(arcProgram.handle);
      scene.uniforms(arcProgram);
      gl.uniform1f(arcProgram.u.uThickness, thickness);
      gl.uniform1f(arcProgram.u.uTime, state.time);
      gl.uniform1f(arcProgram.u.uDraw, reduceMotion ? 1 : clamp((now - started) / 2200, 0, 1));
      gl.uniform1f(arcProgram.u.uFocus, focus);
      gl.bindVertexArray(arcs.vao);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, arcs.rows, arcs.count);

      gl.useProgram(nodeProgram.handle);
      scene.uniforms(nodeProgram);
      gl.uniform1f(nodeProgram.u.uSize, 9 * thickness);
      gl.uniform1f(nodeProgram.u.uFocus, focus);
      gl.bindVertexArray(nodes.vao);
      gl.drawArrays(gl.POINTS, 0, nodes.count);
    };

    const onFrame = (scene) => {
      const shown = [];
      for (const place of places) {
        const v = applyTurn(scene.state.turn, place.place);
        const facing = v[2] > 1 / scene.distance + 0.04;
        place.el.classList.toggle('is-on', facing);
        if (facing) shown.push({ el: place.el, ...scene.project(place.place) });
      }
      // Cities can sit close together, as Ghent, Potsdam and Vienna do. Stack their names.
      shown.sort((a, b) => a.y - b.y);
      shown.forEach((label, index) => {
        const above = shown.slice(0, index).filter((other) => Math.abs(other.x - label.x) < 96);
        const clear = Math.max(label.y, ...above.map((other) => other.y + 24));
        label.y = clear;
        label.el.style.transform = `translate(${label.x.toFixed(1)}px, ${label.y.toFixed(1)}px)`;
      });
    };

    let scene;
    try {
      scene = await createGlobe(stage.querySelector('canvas'), { centre: [75, 34], speed: 0, reduceMotion, intro: false, radius: 0.88, extra, onFrame });
    } catch (error) {
      console.warn('Globe not available:', error.message);
    }
    if (!scene) return;

    root.classList.add('has-globe');
    stage.classList.add('is-live');
    if (reduceMotion) scene.loop.once();
    else scene.loop.start();
    bindPause(stage, scene, reduceMotion);

    const choose = (index) => {
      if (focus === index) return;
      focus = index;
      for (const [i, place] of places.entries()) place.el.classList.toggle('is-focus', i === index);
      if (index >= 0) {
        const { lon, lat } = midpoint(homePlace, places[index].place);
        scene.aim(lon, lat);
      }
      if (!scene.loop.running) scene.loop.once();
    };

    places.forEach((place, index) => {
      place.el.addEventListener('pointerenter', () => choose(index));
      place.el.addEventListener('focus', () => choose(index));
      place.el.addEventListener('pointerleave', () => choose(-1));
      place.el.addEventListener('blur', () => choose(-1));
    });

    // The people named in the list reach the same place on the globe.
    for (const item of root.querySelectorAll('.collab')) {
      const city = item.dataset.city;
      const index = places.findIndex((place) => place.city === city);
      if (index < 0) continue;
      item.addEventListener('pointerenter', () => choose(index));
      item.addEventListener('pointerleave', () => choose(-1));
    }
  });
}
