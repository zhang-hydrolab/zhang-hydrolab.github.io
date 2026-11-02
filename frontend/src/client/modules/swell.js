/*
 * Lines of open water behind the group's figures. The surface moves with the page and rests
 * when the page rests, so it needs no animation loop and uses nothing while being read.
 */
import { createContext, createProgram, whenNear } from '../gl/core.js';

const COLUMNS = 180;
const ROWS = 38;

const VERTEX = /* glsl */ `#version 300 es
precision highp float;
uniform float uPhase;
uniform float uAspect;
out float vFade;
void main() {
  float column = mod(float(gl_VertexID), ${COLUMNS}.0);
  float row = floor(float(gl_VertexID) / ${COLUMNS}.0);
  float x = column / ${COLUMNS - 1}.0 * 2.0 - 1.0;
  float far = row / ${ROWS - 1}.0;
  float depth = 0.2 + far * far * 2.4;
  float eye = 1.0 + depth;
  float ground = x * eye * uAspect;
  float swell = sin(ground * 2.1 + depth * 5.0 + uPhase)
    + 0.55 * sin(ground * 4.3 - depth * 7.0 + uPhase * 1.4)
    + 0.28 * sin(ground * 9.0 + depth * 11.0 - uPhase * 0.8);
  gl_Position = vec4(x, (0.06 * swell - 0.62 + depth * 1.05) / eye - 0.02, 0.0, 1.0);
  vFade = (1.0 - far) * smoothstep(0.0, 0.16, far);
}`;

const FRAGMENT = /* glsl */ `#version 300 es
precision highp float;
in float vFade;
out vec4 outColor;
void main() {
  outColor = vec4(vec3(0.70, 0.86, 1.0), 1.0) * vFade * 0.3;
}`;

export default function swell(root, { reduceMotion }) {
  const canvas = root.querySelector('canvas');
  whenNear(root, () => {
    const gl = createContext(canvas);
    if (!gl) return;
    const program = createProgram(gl, VERTEX, FRAGMENT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.clearColor(0, 0, 0, 0);
    gl.useProgram(program.handle);
    gl.bindVertexArray(gl.createVertexArray());

    let phase = window.scrollY * 0.0035;
    let frame = 0;
    const draw = () => {
      frame = 0;
      const box = canvas.getBoundingClientRect();
      const scale = Math.min(window.devicePixelRatio || 1, 1.5);
      const width = Math.round(box.width * scale);
      const height = Math.round(box.height * scale);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
      gl.uniform1f(program.u.uAspect, box.width / box.height / 2);
      gl.uniform1f(program.u.uPhase, phase);
      gl.clear(gl.COLOR_BUFFER_BIT);
      for (let row = 0; row < ROWS; row += 1) gl.drawArrays(gl.LINE_STRIP, row * COLUMNS, COLUMNS);
    };
    const request = () => {
      if (!frame) frame = requestAnimationFrame(draw);
    };

    if (!reduceMotion) {
      addEventListener(
        'scroll',
        () => {
          phase = window.scrollY * 0.0035;
          const { top, bottom } = root.getBoundingClientRect();
          if (bottom > 0 && top < innerHeight) request();
        },
        { passive: true },
      );
    }
    new ResizeObserver(request).observe(canvas);
    request();
  });
}
