import GUI from 'muigui';
import type { RenderManager } from '@/engine';

export function createRenderDebugGui(renderManager: RenderManager): () => void {
  const gui = new GUI();
  const radToDegOptions = { min: -360, max: 360, step: 1, converters: GUI.converters.radToDeg };

  gui.add(renderManager.settings, 'useOrthographic').name('use orthographic');
  gui.add(renderManager.settings, 'zoom', 0.1, 10).name('zoom (orthographic)');
  gui.add(renderManager.settings, 'orthographicHeight', 10, 3000).name('height (orthographic)');
  gui.add(renderManager.settings, 'fieldOfView', {
    min: 1,
    max: 179,
    converters: GUI.converters.radToDeg,
  });
  gui.add(renderManager.settings.translation, '0', -1000, 1000).name('translation.x');
  gui.add(renderManager.settings.translation, '1', -1000, 1000).name('translation.y');
  gui.add(renderManager.settings.translation, '2', -2000, -1).name('translation.z');
  gui.add(renderManager.settings, 'rotation', radToDegOptions);
  gui.add(renderManager.settings.scale, '0', -10, 10).name('scale.x');
  gui.add(renderManager.settings.scale, '1', -10, 10).name('scale.y');
  gui.onChange(renderManager.redraw);

  return () => gui.destroy?.();
}
