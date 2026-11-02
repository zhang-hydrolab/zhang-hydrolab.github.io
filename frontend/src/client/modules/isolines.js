/**
 * A flat plane of water drawn only as topographic contours. Every fifth line is
 * heavier, the map-maker's index contour. The pointer bends the surface and a
 * click drops rain, which rings outward through the lines.
 */
const VERTEX = `#version 300 es
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uPointer;
uniform float uPresence;
uniform vec3 uDrops[6];
uniform vec3 uBase;
uniform vec3 uLine;
uniform vec3 uHot;
out vec4 color;

vec2 grad(vec2 p) {
  float a = fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453) * 6.28318;
  return vec2(cos(a), sin(a));
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = dot(grad(i), f);
  float b = dot(grad(i + vec2(1, 0)), f - vec2(1, 0));
  float c = dot(grad(i + vec2(0, 1)), f - vec2(0, 1));
  float d = dot(grad(i + vec2(1, 1)), f - vec2(1, 1));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float terrain(vec2 p, float t) {
  vec2 warp = vec2(noise(p + t), noise(p - t + 7.3));
  float h = 0.62 * noise(p * 0.9 + warp * 0.5);
  h += 0.26 * noise(p * 2.0 - warp * 0.4 + t * 0.5);
  return h + 0.42 * p.y * 0.3;
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float t = uTime * 0.018;
  float h = terrain(p * 1.35, t);

  float d = length(p - uPointer);
  h += uPresence * 0.13 * exp(-d * d * 7.0);

  for (int i = 0; i < 6; i++) {
    float age = uDrops[i].z;
    if (age < 0.0) continue;
    float r = length(p - uDrops[i].xy);
    float front = age * 0.34;
    h += sin((r - front) * 42.0) * exp(-abs(r - front) * 15.0) * exp(-age * 1.1) * 0.05;
  }

  float n = h * 19.0;
  float w = fwidth(n);
  float minor = abs(fract(n - 0.5) - 0.5) / w;
  float major = abs(fract(n / 5.0 - 0.5) - 0.5) * 5.0 / w;
  float a = max((1.0 - smoothstep(0.35, 1.25, minor)) * 0.26, (1.0 - smoothstep(0.7, 1.7, major)) * 0.7);
  float hot = exp(-d * d * 8.0) * uPresence;
  color = vec4(mix(uBase, mix(uLine, uHot, hot), a), 1.0);
}`;

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const BASE = { blue: '#1437f5' };

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
  return shader;
}

export default function init(canvas, { reduceMotion }) {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'low-power' });
  if (!gl) return;

  const program = gl.createProgram();
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT));
  gl.linkProgram(program);
  gl.useProgram(program);
  gl.bindVertexArray(gl.createVertexArray());

  const uniform = (name) => gl.getUniformLocation(program, name);
  const u = { res: uniform('uRes'), time: uniform('uTime'), pointer: uniform('uPointer'), presence: uniform('uPresence'), drops: uniform('uDrops') };
  gl.uniform3fv(uniform('uBase'), rgb(BASE.blue));
  gl.uniform3fv(uniform('uLine'), [1, 1, 1]);
  gl.uniform3fv(uniform('uHot'), rgb('#c8f031'));

  const pointer = { x: 0, y: 0, tx: 0, ty: 0, presence: 0, want: 0 };
  const drops = Array.from({ length: 6 }, () => ({ x: 0, y: 0, born: -1 }));
  let nextDrop = 0;
  let visible = true;
  let rafId = 0;

  const resize = () => {
    const scale = Math.min(devicePixelRatio || 1, 1.5);
    const width = Math.max(1, Math.round(canvas.clientWidth * scale));
    const height = Math.max(1, Math.round(canvas.clientHeight * scale));
    if (canvas.width === width && canvas.height === height) return;
    canvas.width = width;
    canvas.height = height;
    gl.viewport(0, 0, width, height);
    gl.uniform2f(u.res, width, height);
  };

  const toField = (event) => {
    const box = canvas.getBoundingClientRect();
    return [(event.clientX - box.left - box.width / 2) / box.height, (box.height / 2 - (event.clientY - box.top)) / box.height];
  };

  const draw = (now) => {
    const seconds = now / 1000;
    pointer.x += (pointer.tx - pointer.x) * 0.08;
    pointer.y += (pointer.ty - pointer.y) * 0.08;
    pointer.presence += (pointer.want - pointer.presence) * 0.05;
    gl.uniform1f(u.time, seconds);
    gl.uniform2f(u.pointer, pointer.x, pointer.y);
    gl.uniform1f(u.presence, pointer.presence);
    gl.uniform3fv(u.drops, drops.flatMap((d) => [d.x, d.y, d.born < 0 ? -1 : seconds - d.born]));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  resize();
  addEventListener('resize', resize, { passive: true });

  if (reduceMotion) {
    draw(40000);
    return;
  }

  const loop = (now) => {
    rafId = visible && !document.hidden ? requestAnimationFrame(loop) : 0;
    draw(now);
  };
  const wake = () => {
    if (!rafId && visible && !document.hidden) rafId = requestAnimationFrame(loop);
  };

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    wake();
  }).observe(canvas);
  document.addEventListener('visibilitychange', wake);

  const host = canvas.parentElement;
  host.addEventListener('pointermove', (event) => {
    [pointer.tx, pointer.ty] = toField(event);
    pointer.want = 1;
  }, { passive: true });
  host.addEventListener('pointerleave', () => {
    pointer.want = 0;
  });
  host.addEventListener('pointerdown', (event) => {
    if (event.target.closest('a, button')) return;
    const [x, y] = toField(event);
    drops[nextDrop] = { x, y, born: performance.now() / 1000 };
    nextDrop = (nextDrop + 1) % drops.length;
  });

  wake();
}
