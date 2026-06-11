import { onMounted, onUnmounted, type Ref, ref, shallowRef } from 'vue';
import {
  OrbitCamera,
  RenderManager,
  UNIT_RECT_INDICES,
  UNIT_RECT_VERTICES,
  Vector3D,
} from '@/engine';
import { buildDemoCard } from '@/scenes/demoCard.js';
import { createRenderDebugGui } from './createRenderDebugGui.js';

export function useWebGpuEditor(canvasRef: Ref<HTMLCanvasElement | null>) {
  const setupError = ref<string | null>(null);
  const renderManagerRef = shallowRef<RenderManager | null>(null);
  const orbitCameraRef = shallowRef<OrbitCamera | null>(null);

  let disposed = false;
  let destroyGui: (() => void) | null = null;

  onMounted(() => {
    disposed = false;

    (async () => {
      try {
        const canvas = canvasRef.value;
        if (!canvas) return;

        const renderManager = new RenderManager(canvas);
        await renderManager.init();

        if (disposed) return;

        destroyGui = createRenderDebugGui(renderManager);

        const orbitCamera = new OrbitCamera(canvas);
        orbitCamera.setParent(renderManager.root);
        orbitCamera.target = new Vector3D(0, 0, 0);
        orbitCamera.tilt = Math.PI;
        orbitCamera.radius = 300;

        renderManager.setPipeline();
        renderManager.setCamera(orbitCamera);
        buildDemoCard(renderManager, UNIT_RECT_VERTICES, UNIT_RECT_INDICES);
        renderManager.redraw();

        renderManagerRef.value = renderManager;
        orbitCameraRef.value = orbitCamera;
      } catch (error) {
        setupError.value = error instanceof Error ? error.message : 'Failed to initialize WebGPU.';
      }
    })();
  });

  onUnmounted(() => {
    disposed = true;
    destroyGui?.();
  });

  const onPointerDown = (event: PointerEvent) => {
    orbitCameraRef.value?.handleDown(event);
    renderManagerRef.value?.pickMesh(event);
  };

  const onPointerMove = (event: PointerEvent) => {
    orbitCameraRef.value?.handleMove(event);
    renderManagerRef.value?.redraw();
  };

  const onPointerUp = (event: PointerEvent) => {
    orbitCameraRef.value?.handleUp(event);
  };

  const onPointerCancel = (event: PointerEvent) => {
    orbitCameraRef.value?.handleUp(event);
  };

  const onLostPointerCapture = (event: PointerEvent) => {
    orbitCameraRef.value?.handleUp(event);
  };

  const onWheel = (event: WheelEvent) => {
    const renderManager = renderManagerRef.value;
    const orbitCamera = orbitCameraRef.value;
    if (!renderManager) return;

    if (renderManager.settings.useOrthographic) {
      const nextZoom = renderManager.settings.zoom + event.deltaY * 0.01;
      renderManager.settings.zoom = Math.max(0.1, Math.min(10, nextZoom));
    } else {
      orbitCamera?.handleDolly(event);
    }

    renderManager.redraw();
  };

  return {
    setupError,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onLostPointerCapture,
    onWheel,
  };
}
