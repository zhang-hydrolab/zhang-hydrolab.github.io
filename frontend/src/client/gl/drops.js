/*
 * Rain and vapour over a terrain block: points that fall to the ground or rise from it, each on
 * its own cycle. Shared by the water budget and the water-cycle research view.
 */
import { createProgram } from './core.js';
import { HEIGHT } from './terrain.js';

const VERTEX = /* glsl */ `#version 300 es
precision highp float;
layout(location = 0) in vec3 aSeed;
uniform mat4 uCamera;
uniform float uTime;
uniform float uRate;
uniform float uUp;
uniform float uSize;
out float vLife;
${HEIGHT}
void main() {
  float t = fract(aSeed.z + uTime * uRate);
  vec3 ground = placeAt(aSeed.xy);
  float high = 0.52 + aSeed.z * 0.08;
  float y = uUp > 0.5 ? mix(ground.y + 0.01, high, t) : mix(high, ground.y + 0.005, t);
  vLife = sin(t * 3.14159) * uRise;
  gl_Position = uCamera * vec4(ground.x, y, ground.z, 1.0);
  gl_PointSize = uSize;
}`;

const FRAGMENT = /* glsl */ `#version 300 es
precision highp float;
in float vLife;
out vec4 outColor;
uniform float uUp;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  // Rain is a short streak and vapour a small round drop.
  float shape = uUp > 0.5
    ? 1.0 - smoothstep(0.22, 0.5, length(p))
    : (1.0 - smoothstep(0.02, 0.07, abs(p.x))) * (1.0 - smoothstep(0.2, 0.5, abs(p.y)));
  vec3 colour = uUp > 0.5 ? vec3(0.47, 0.70, 0.90) : vec3(0.13, 0.43, 0.72);
  outColor = vec4(colour, 1.0) * shape * sqrt(max(vLife, 0.0)) * (uUp > 0.5 ? 0.5 : 0.42);
}`;

/** Random points over part of the block: across from fromU to toU, any depth, any phase. */
export function seeds(gl, count, fromU, toU) {
  let state = 12345;
  const random = () => {
    state = (state * 48271) % 2147483647;
    return state / 2147483647;
  };
  const data = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    data[i * 3] = fromU + random() * (toU - fromU);
    data[i * 3 + 1] = 0.02 + random() * 0.96;
    data[i * 3 + 2] = random();
  }
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  return vao;
}

export const createDrops = (gl) => createProgram(gl, VERTEX, FRAGMENT);
