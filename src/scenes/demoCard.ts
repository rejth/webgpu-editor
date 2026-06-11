import type { RenderManager } from '@/engine/render/RenderManager.js';
import type { SceneGraphNode } from '@/engine/scene/SceneGraph.js';
import { parseColorToRGBA } from '@/engine/utils/utils.js';

export function buildDemoCard(
  renderManager: RenderManager,
  vertexData: Float32Array,
  indexData: Uint16Array,
): SceneGraphNode {
  const card = renderManager.addNode('card', { translation: [0, 0, 0], scale: [300, 300, 1] });

  renderManager.addRect(
    `${card.id}-background`,
    { vertexData, indexData, source: { scale: [1.4, 1.4, 1] } },
    { color: parseColorToRGBA('#4a5568') },
    card,
  );
  renderManager.addRect(
    `${card.id}-inner`,
    { vertexData, indexData, source: { scale: [0.8, 0.8, 1] } },
    { color: parseColorToRGBA('#e2e8f0') },
    card,
  );

  return card;
}
