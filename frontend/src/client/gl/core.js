/*
 * The small part of WebGL2 that the 3D views share. There is no library, because a globe and a
 * terrain need very little of one, and the site is often reached over a slow link.
 */

/**
 * A context, or null. Software rendering counts as no context, because a machine that would
 * have to draw this on its processor is better served by the still image.
 */
export function createContext(canvas, options = {}) {
  let gl = null;
  try {
    gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: true,
      depth: false,
      stencil: false,
      failIfMajorPerformanceCaveat: true,
      ...options,
    });
  } catch {
    return null;
  }
  if (!gl) return null;
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : '';
  return /swiftshader|llvmpipe|software|basic render/i.test(renderer) ? null : gl;
}

export function createProgram(gl, vertex, fragment) {
  const shader = (type, source) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const handle = gl.createProgram();
  gl.attachShader(handle, shader(gl.VERTEX_SHADER, vertex));
  gl.attachShader(handle, shader(gl.FRAGMENT_SHADER, fragment));
  gl.linkProgram(handle);
  if (!gl.getProgramParameter(handle, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(handle));
  const u = {};
  const count = gl.getProgramParameter(handle, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < count; i += 1) {
    const { name } = gl.getActiveUniform(handle, i);
    u[name] = gl.getUniformLocation(handle, name);
  }
  return { handle, u };
}

export async function loadBytes(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.arrayBuffer();
}

/** A one-channel image as a texture. Sampling in a vertex shader needs it to stay R8. */
export async function loadTexture(gl, url, { repeat = false } = {}) {
  const buffer = await loadBytes(url);
  const bitmap = await createImageBitmap(new Blob([buffer]), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, gl.RED, gl.UNSIGNED_BYTE, bitmap);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return { texture, ...size };
}

/**
 * Rivers as written by tools/build_earth.py: one record per reach, each ready to be an
 * instance of a line. Rivers come largest first.
 * Returns floats of [lonA, latA, kmA, lonB, latB, kmB, grade], and the optional header.
 */
export function readRivers(buffer, headerFloats = 0) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const lines = view.getUint32(0, true);
  const points = view.getUint32(4, true);
  const header = new Float32Array(buffer.slice(8, 8 + headerFloats * 4));
  let at = 8 + headerFloats * 4;
  const next = () => {
    let value = 0;
    let shift = 0;
    let byte;
    do {
      byte = bytes[at++];
      value |= (byte & 127) << shift;
      shift += 7;
    } while (byte > 127);
    return (value >>> 1) ^ -(value & 1);
  };

  const reaches = new Float32Array((points - lines) * 7);
  let out = 0;
  for (let l = 0; l < lines; l += 1) {
    const count = next();
    const grade = bytes[at++] / 255;
    let lon = 0;
    let lat = 0;
    let km = 0;
    for (let p = 0; p < count; p += 1) {
      const lonA = lon;
      const latA = lat;
      const kmA = km;
      lon += next();
      lat += next();
      km += next();
      if (p === 0) continue;
      reaches[out++] = lonA / 100;
      reaches[out++] = latA / 100;
      reaches[out++] = kmA;
      reaches[out++] = lon / 100;
      reaches[out++] = lat / 100;
      reaches[out++] = km;
      reaches[out++] = grade;
    }
  }
  return { reaches, count: points - lines, header };
}

/** Upload reaches as instances. Each instance draws one quad, with no vertex buffer at all. */
export function reachBuffer(gl, reaches) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, reaches, gl.STATIC_DRAW);
  const stride = 7 * 4;
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
  gl.vertexAttribDivisor(0, 1);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 12);
  gl.vertexAttribDivisor(1, 1);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 1, gl.FLOAT, false, stride, 24);
  gl.vertexAttribDivisor(2, 1);
  gl.bindVertexArray(null);
  return vao;
}

/** Anything that keeps moving offers a way to stop it. */
export function bindPause(root, scene, reduceMotion) {
  const button = root.querySelector('[data-pause]');
  if (!button || reduceMotion) return;
  button.hidden = false;
  button.addEventListener('click', () => {
    const paused = button.getAttribute('aria-pressed') !== 'true';
    button.setAttribute('aria-pressed', String(paused));
    scene.pause(paused);
  });
}

/** Starts work when a view comes near the window, so unseen views cost nothing. */
export function whenNear(element, callback) {
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      callback();
    },
    { rootMargin: '500px' },
  );
  observer.observe(element);
}

export const easeOut = (t) => 1 - (1 - t) ** 3;
export const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

/**
 * Runs a view only while somebody can see it.
 *
 * The frame loop stops off screen, in a hidden tab and on pause. Resolution starts at the
 * screen's and steps down if frames run slow, so an old laptop stays smooth and quiet.
 * draw(now, delta) returns true while it wants another frame.
 */
export function createLoop(canvas, { draw, resize, maxScale = 1.75 }) {
  let frame = 0;
  let onScreen = false;
  let wanted = false;
  let last = 0;
  let scale = Math.min(window.devicePixelRatio || 1, maxScale);
  let samples = 0;
  let slow = 0;

  const fit = () => {
    const box = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(box.width * scale));
    const height = Math.max(1, Math.round(box.height * scale));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    resize?.(width, height, box.width, box.height);
  };

  const measure = (delta) => {
    if (delta > 200) return; // The tab was away, which says nothing about speed.
    samples += 1;
    if (delta > 24) slow += 1;
    if (samples < 45) return;
    if (slow > 27) {
      if (scale > 0.8) {
        scale = Math.max(0.8, scale * 0.8);
        fit();
      } else {
        // Still too slow at the lowest setting: rest on the current frame. Dragging still works.
        wanted = false;
      }
    }
    samples = 0;
    slow = 0;
  };

  const tick = (now) => {
    frame = 0;
    const delta = last ? now - last : 16;
    last = now;
    measure(delta);
    if (draw(now, Math.min(delta, 50)) !== false && wanted) schedule();
  };

  function schedule() {
    if (!frame && onScreen && !document.hidden) frame = requestAnimationFrame(tick);
  }

  const visibility = () => {
    last = 0;
    if (wanted) schedule();
  };

  const observer = new IntersectionObserver(
    ([entry]) => {
      onScreen = entry.isIntersecting;
      visibility();
    },
    { rootMargin: '80px' },
  );

  observer.observe(canvas);
  document.addEventListener('visibilitychange', visibility);
  new ResizeObserver(() => {
    fit();
    if (!wanted) requestAnimationFrame((now) => draw(now, 0));
  }).observe(canvas);
  fit();

  return {
    start() {
      wanted = true;
      schedule();
    },
    stop() {
      wanted = false;
      cancelAnimationFrame(frame);
      frame = 0;
    },
    once() {
      requestAnimationFrame((now) => draw(now, 0));
    },
    get running() {
      return wanted;
    },
  };
}
