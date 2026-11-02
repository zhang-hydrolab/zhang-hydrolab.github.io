/* A block of real terrain beside a page title. */
import { bindPause, whenNear } from '../gl/core.js';
import { createTerrain } from '../gl/terrain.js';

export default function block(root, { reduceMotion }) {
  whenNear(root, async () => {
    const { scene, contour, yaw, pitch, distance } = root.dataset;
    let view;
    try {
      view = await createTerrain(root.querySelector('canvas'), {
        scene,
        contour: Number(contour ?? 200),
        yaw: Number(yaw ?? -26),
        pitch: Number(pitch ?? 34),
        distance: Number(distance ?? 4.4),
        reduceMotion,
      });
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
