/* The globe on the front page. The picture beneath it stays if WebGL is not available. */
import { bindPause } from '../gl/core.js';
import { createGlobe, lonLatToWorld } from '../gl/globe.js';

export default async function earth(root, { reduceMotion }) {
  const canvas = root.querySelector('canvas');
  const labels = [...root.querySelectorAll('[data-lon]')].map((el) => ({
    el,
    place: lonLatToWorld(Number(el.dataset.lon), Number(el.dataset.lat)),
  }));

  const place = (scene) => {
    for (const label of labels) {
      const { x, y, front } = scene.project(label.place);
      const on = front > 0.22;
      label.el.classList.toggle('is-on', on);
      if (on) label.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    }
  };

  let scene;
  try {
    // Rivers fill in as the page opens. After a slow load the picture has already shown them.
    scene = await createGlobe(canvas, { reduceMotion, onFrame: place, intro: performance.now() < 1800 });
  } catch (error) {
    console.warn('Globe not available:', error.message);
  }
  if (!scene) return;

  root.classList.add('is-live');
  if (reduceMotion) scene.loop.once();
  else scene.loop.start();
  bindPause(root, scene, reduceMotion);
}
