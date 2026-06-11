<script setup lang="ts">
import { ref } from 'vue';
import { useCanvasInputGuard } from '@/app/composables/useCanvasInputGuard.js';
import { useWebGpuEditor } from '@/app/composables/useWebGpuEditor.js';

const canvasRef = ref<HTMLCanvasElement | null>(null);

useCanvasInputGuard();

const {
  setupError,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onLostPointerCapture,
  onWheel,
} = useWebGpuEditor(canvasRef);
</script>

<template>
  <div class="app-container">
    <div v-if="setupError" class="status-panel" role="alert">
      <strong>WebGPU unavailable</strong>
      <span>{{ setupError }}</span>
    </div>
    <canvas
      ref="canvasRef"
      id="canvas"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerCancel"
      @lostpointercapture="onLostPointerCapture"
      @wheel="onWheel"
    />
  </div>
</template>
