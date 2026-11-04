/*
 * Contour lines of the real Earth behind the group's figures, in soft blue. The strip shows
 * the northern mid-latitudes from the 1 km terrain model, the same relief as the globe. Land
 * contours follow elevation; offshore lines follow distance from the coast and move slowly
 * seaward, like a ripple, while the strip turns east with the globe.
 */
import { bindPause, createContext, createLoop, createProgram, loadTexture, whenNear } from '../gl/core.js';

const VERTEX = /* glsl */ `#version 300 es
out vec2 vUv;
void main() {
  vec2 corner = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1));
  vUv = corner;
  gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}`;

// relief.webp keeps land above 0.46 with the square root of elevation, and the sea below 0.30,
// fading from the shore to 1500 km offshore. The coast lies between them, at 0.38.
const FRAGMENT = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uRelief;
uniform vec2 uTexel;
uniform vec4 uView;   // centre longitude, centre latitude, width and height in degrees
uniform float uPhase;
out vec4 outColor;

float at(vec2 uv) {
  return textureLod(uRelief, uv, 1.6).r;
}

float relief(vec2 uv) {
  // A coarse level and a cross of samples: the lines generalise the relief, as a small-scale
  // map does, instead of tracing every ridge behind the figures.
  vec2 dx = vec2(uTexel.x * 2.5, 0.0);
  vec2 dy = vec2(0.0, uTexel.y * 2.5);
  return (at(uv) * 2.0 + at(uv + dx) + at(uv - dx) + at(uv + dy) + at(uv - dy)) / 6.0;
}

float line(float value, float width) {
  float f = fract(value);
  float d = min(f, 1.0 - f) / max(fwidth(value), 1e-4);
  return 1.0 - smoothstep(width * 0.5, width * 0.5 + 1.0, d);
}

void main() {
  float lon = uView.x + (vUv.x - 0.5) * uView.z;
  float lat = uView.y + (vUv.y - 0.5) * uView.w;
  float h = relief(vec2(fract((lon + 180.0) / 360.0), (90.0 - lat) / 180.0));

  float land = smoothstep(0.37, 0.40, h);
  float rise = clamp((h - 0.46) / 0.54, 0.0, 1.0);
  float shore = clamp(h / 0.30, 0.0, 1.0);

  float a = 0.0;
  a += land * line(rise * 7.0, 0.9) * (0.24 + 0.22 * rise);               // elevation
  a += (1.0 - land) * line(shore * 9.0 + uPhase, 0.8) * shore * 0.30;     // offshore, moving out
  a = max(a, line(h - 0.38, 1.4) * 0.55); // the coast, the only whole number in reach

  // Rest the lines towards the sides, and keep them quiet behind the figures.
  a *= smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
  a *= 0.55 + 0.45 * smoothstep(0.15, 0.85, vUv.y);
  vec3 ink = mix(vec3(0.44, 0.66, 0.87), vec3(0.20, 0.47, 0.76), rise);
  outColor = vec4(ink * a, a);
}`;

const CENTRE = [105, 37]; // China in the middle, where the group works.
const TURN = 0.5; // Degrees of longitude per second.
const RIPPLE = 0.07; // Offshore lines per second.

export default function contours(root, { reduceMotion }) {
  // The rules under the figures are drawn in when the band arrives, with or without WebGL.
  const shown = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    shown.disconnect();
    root.classList.add('is-shown');
  });
  shown.observe(root);

  const canvas = root.querySelector('canvas');
  whenNear(root, async () => {
    const gl = createContext(canvas);
    if (!gl) return;
    let relief;
    try {
      relief = await loadTexture(gl, '/earth/relief.webp', { repeat: true });
    } catch (error) {
      console.warn('Contours not available:', error.message);
      return;
    }
    const program = createProgram(gl, VERTEX, FRAGMENT);
    gl.useProgram(program.handle);
    gl.bindVertexArray(gl.createVertexArray());
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, relief.texture);
    gl.uniform1i(program.u.uRelief, 0);
    gl.uniform2f(program.u.uTexel, 1 / relief.width, 1 / relief.height);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);

    let aspect = 1;
    let clock = 0;
    let paused = false;
    const loop = createLoop(canvas, {
      maxScale: 1.5,
      resize(width, height, cssWidth, cssHeight) {
        gl.viewport(0, 0, width, height);
        aspect = cssWidth / Math.max(cssHeight, 1);
      },
      draw(now, delta) {
        if (!paused) clock += delta / 1000;
        // A wide band shows most of the hemisphere; a narrow one about a continent.
        const across = Math.min(300, 44 * aspect);
        gl.uniform4f(program.u.uView, CENTRE[0] + clock * TURN, CENTRE[1], across, across / aspect);
        gl.uniform1f(program.u.uPhase, clock * RIPPLE);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      },
    });

    if (reduceMotion) {
      loop.once();
      return;
    }
    loop.start();
    bindPause(root, {
      pause(value) {
        paused = value;
        if (paused) loop.stop();
        else loop.start();
      },
    }, reduceMotion);
  });
}
