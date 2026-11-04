/*
 * A globe of the group's PML-V2.2 evapotranspiration, mean of each calendar month for
 * 2001-2020, turning slowly while the months pass. Each pixel finds its point on the sphere
 * and reads the two months it lies between, so the seasons move smoothly across the land.
 *
 * et-months.webp holds the twelve maps four across and three down, January at top left, each
 * 0.5 degrees from 90 N to 90 S, as ET / 150 mm per month. relief.webp gives land and sea.
 */
import { bindPause, createContext, createLoop, createProgram, loadTexture, whenNear } from '../gl/core.js';

const VERTEX = /* glsl */ `#version 300 es
out vec2 vXY;
void main() {
  vec2 corner = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1));
  vXY = corner * 2.0 - 1.0;
  gl_Position = vec4(vXY, 0.0, 1.0);
}`;

const FRAGMENT = /* glsl */ `#version 300 es
precision highp float;
in vec2 vXY;
uniform sampler2D uMonths;
uniform sampler2D uRelief;
uniform float uMonth;
uniform float uYaw;
uniform float uTilt;
uniform float uPixel;
out vec4 outColor;

const float PI = 3.14159265;
const vec3 SUN = normalize(vec3(-0.45, 0.5, 0.75));

float month(vec2 lonLat, float m) {
  float index = mod(m, 12.0);
  vec2 tile = vec2(mod(index, 4.0), floor(index / 4.0));
  vec2 inner = clamp(lonLat, vec2(0.5 / 720.0, 0.5 / 360.0), vec2(1.0 - 0.5 / 720.0, 1.0 - 0.5 / 360.0));
  // Level 0 throughout: mipmaps would bleed between tiles and draw a seam at the date line.
  return textureLod(uMonths, (tile + inner) / vec2(4.0, 3.0), 0.0).r;
}

vec3 ramp(float v) {
  vec3 a = vec3(0.955, 0.972, 0.986);
  vec3 b = vec3(0.640, 0.800, 0.925);
  vec3 c = vec3(0.250, 0.530, 0.790);
  vec3 d = vec3(0.040, 0.250, 0.470);
  return v < 0.33 ? mix(a, b, v / 0.33) : v < 0.66 ? mix(b, c, (v - 0.33) / 0.33) : mix(c, d, (v - 0.66) / 0.34);
}

void main() {
  float r = length(vXY);
  float edge = 1.0 - smoothstep(1.0 - uPixel * 1.5, 1.0, r);
  if (edge <= 0.0) {
    outColor = vec4(0.0);
    return;
  }
  vec3 p = vec3(vXY, sqrt(max(0.0, 1.0 - r * r)));
  float light = 0.86 + 0.14 * max(dot(p, SUN), 0.0);

  // Tilt towards the viewer, then turn about the pole.
  float ct = cos(uTilt), st = sin(uTilt);
  vec3 q = vec3(p.x, p.y * ct + p.z * st, -p.y * st + p.z * ct);
  float lat = asin(clamp(q.y, -1.0, 1.0));
  float lon = atan(q.x, q.z) + uYaw;
  vec2 uv = vec2(fract(lon / (2.0 * PI) + 0.5), 0.5 - lat / PI);

  float relief = textureLod(uRelief, uv, 0.0).r;
  float land = smoothstep(0.36, 0.42, relief);
  float m = floor(uMonth);
  float et = mix(month(uv, m), month(uv, m + 1.0), smoothstep(0.0, 1.0, fract(uMonth)));

  vec3 sea = mix(vec3(0.930, 0.960, 0.988), vec3(0.860, 0.918, 0.970), clamp(relief / 0.30, 0.0, 1.0));
  vec3 ground = ramp(clamp(et, 0.0, 1.0));
  // The ice sheets and deserts have little or no ET; a touch of relief keeps them readable.
  ground *= 0.94 + 0.06 * clamp((relief - 0.46) / 0.54, 0.0, 1.0);
  vec3 colour = mix(sea, ground, land) * light;
  // A fine rim, the way a printed globe is outlined.
  colour = mix(colour, vec3(0.55, 0.70, 0.85), smoothstep(1.0 - uPixel * 4.0, 1.0 - uPixel, r) * 0.6);
  outColor = vec4(colour, 1.0) * edge;
}`;

const SPIN = -0.08; // Radians per second; west to east, as the Earth turns.
const PACE = 0.75; // Months per second.
const START = { month: 6, yaw: 2.0 }; // July, with East Asia towards the viewer.

export default function etglobe(root, { reduceMotion }) {
  const canvas = root.querySelector('canvas');
  const label = root.querySelector('[data-etg-month]');
  const names = JSON.parse(root.querySelector('#etg-months').textContent);
  const zh = () => document.documentElement.dataset.lang === 'zh';
  let shownMonth = -1;
  const write = (index) => {
    shownMonth = index;
    label.textContent = names[index][zh() ? 1 : 0];
  };
  addEventListener('lab:lang', () => write(shownMonth < 0 ? START.month : shownMonth));

  whenNear(root, async () => {
    const gl = createContext(canvas);
    if (!gl) return;
    let months;
    let relief;
    try {
      [months, relief] = await Promise.all([loadTexture(gl, '/earth/et-months.webp'), loadTexture(gl, '/earth/relief.webp', { repeat: true })]);
    } catch (error) {
      console.warn('Globe not available:', error.message);
      return;
    }
    const program = createProgram(gl, VERTEX, FRAGMENT);
    gl.useProgram(program.handle);
    gl.bindVertexArray(gl.createVertexArray());
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, months.texture);
    gl.uniform1i(program.u.uMonths, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, relief.texture);
    gl.uniform1i(program.u.uRelief, 1);
    gl.uniform1f(program.u.uTilt, 0.36);
    gl.clearColor(0, 0, 0, 0);

    let clock = 0;
    let paused = false;
    let size = 1;
    const loop = createLoop(canvas, {
      resize(width, height) {
        gl.viewport(0, 0, width, height);
        size = Math.min(width, height);
      },
      draw(now, delta) {
        if (!paused && loop.running) clock += delta / 1000;
        const month = START.month + clock * PACE;
        gl.uniform1f(program.u.uMonth, month % 12);
        gl.uniform1f(program.u.uYaw, START.yaw + clock * SPIN);
        gl.uniform1f(program.u.uPixel, 2 / size);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        const index = Math.floor(month + 0.5) % 12;
        if (index !== shownMonth) write(index);
      },
    });

    root.classList.add('is-live');
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
