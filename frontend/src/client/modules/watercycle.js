/*
 * The global water budget on a real landscape: the Tibetan Plateau, the Yangtze and the East
 * China Sea. The terrain and rivers are measured. The numbers are the published global totals,
 * placed where each term happens, and the amount of rain and vapour follows them.
 */
import { bindPause, clamp, whenNear } from '../gl/core.js';
import { createDrops, seeds } from '../gl/drops.js';
import { createTerrain } from '../gl/terrain.js';

/** The part of the block, as a fraction of its width, that is land. The rest is sea. */
const SHORE = 0.84;
const COUNTS = { rain: 900, vapour: 800, seaRain: 190, seaVapour: 210 };

export default function watercycle(root, { reduceMotion }) {
  const section = root.closest('section');
  const { flows } = JSON.parse(section.querySelector('#budget-data').textContent);
  const labels = [...root.querySelectorAll('[data-flux]')].map((el) => ({
    el,
    id: el.dataset.flux,
    at: el.dataset.at.split(',').map(Number),
    value: el.querySelector('[data-flux-value]'),
  }));

  let period = 'historical';
  const write = () => {
    for (const label of labels) {
      const flow = flows[label.id][period] ?? flows[label.id].historical;
      label.value.textContent = `${flow[0].toFixed(1)} ± ${flow[1].toFixed(1)}`;
    }
  };

  const place = (view) => {
    if (innerWidth < 760) return;
    for (const label of labels) {
      const [u, y, v] = label.at;
      const { x, y: top } = view.project(u * 2 - 1, y, (v * 2 - 1) * view.depth);
      label.el.style.transform = `translate(${x.toFixed(1)}px, ${top.toFixed(1)}px)`;
    }
  };

  const amount = { rain: 1, vapour: 1, seaRain: 1, seaVapour: 1, river: 1 };
  const aim = { ...amount };
  let view;

  section.addEventListener('lab:period', (event) => {
    period = event.detail;
    write();
    const ratio = (id) => (flows[id][period] ?? flows[id].historical)[0] / flows[id].historical[0];
    aim.rain = ratio('land_precipitation');
    aim.vapour = ratio('land_et');
    aim.seaRain = ratio('ocean_precipitation');
    aim.seaVapour = ratio('ocean_evaporation');
    aim.river = ratio('river_flow');
    if (view && !view.loop.running) view.loop.once();
  });

  whenNear(root, async () => {
    let particles;
    let batches;

    const extra = (scene, now, delta, pass) => {
      if (pass !== 'air') return;
      const { gl, state } = scene;
      if (!particles) {
        particles = createDrops(gl);
        batches = [
          { vao: seeds(gl, COUNTS.rain, 0.02, SHORE), size: COUNTS.rain * 0.9, key: 'rain', up: 0, rate: 0.42, dot: 11 },
          { vao: seeds(gl, COUNTS.vapour, 0.02, SHORE), size: COUNTS.vapour * 0.9, key: 'vapour', up: 1, rate: 0.1, dot: 3.6 },
          { vao: seeds(gl, COUNTS.seaRain, SHORE + 0.02, 0.985), size: COUNTS.seaRain * 0.9, key: 'seaRain', up: 0, rate: 0.42, dot: 11 },
          { vao: seeds(gl, COUNTS.seaVapour, SHORE + 0.02, 0.985), size: COUNTS.seaVapour * 0.9, key: 'seaVapour', up: 1, rate: 0.1, dot: 3.6 },
        ];
      }
      const follow = 1 - Math.exp(-delta / 300);
      for (const key of Object.keys(amount)) amount[key] += (aim[key] - amount[key]) * follow;
      state.flow = 0.3 * amount.river;

      gl.depthMask(false);
      gl.useProgram(particles.handle);
      scene.heights(particles);
      gl.uniformMatrix4fv(particles.u.uCamera, false, state.camera);
      gl.uniform1f(particles.u.uTime, state.time);
      const pixel = clamp(state.height / 620, 0.9, 2.2);
      for (const { vao, size, key, up, rate, dot } of batches) {
        gl.bindVertexArray(vao);
        gl.uniform1f(particles.u.uUp, up);
        gl.uniform1f(particles.u.uRate, rate);
        gl.uniform1f(particles.u.uSize, dot * pixel);
        gl.drawArrays(gl.POINTS, 0, Math.round(size * amount[key]));
      }
      gl.depthMask(true);
    };

    try {
      view = await createTerrain(root.querySelector('canvas'), { scene: 'water', yaw: -20, pitch: 30, distance: 3.05, contour: 500, swing: 6, reduceMotion, extra, onFrame: place });
    } catch (error) {
      console.warn('Terrain not available:', error.message);
    }
    if (!view) return;
    root.classList.add('is-live');
    if (reduceMotion) view.loop.once();
    else view.loop.start();
    bindPause(root, view, reduceMotion);
  });
}
