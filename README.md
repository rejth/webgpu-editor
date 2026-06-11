# WebGPU Editor

WebGPU Editor is an experiment for building an interactive canvas editor on top of WebGPU. It starts from a small renderer that can upload indexed geometry, draw scene graph nodes, move an orbit camera, and pick meshes from pointer input.

The editor model is built around explicit rendering primitives:

- a scene graph for parented transforms
- GPU vertex and index buffers for drawable mesh instances
- per-instance uniforms for color and model-view-projection matrices
- WGSL shaders for the draw pipeline
- camera-owned pointer and wheel interactions
- triangle-level picking that maps pointer coordinates back through clip space

## Project layout

```
src/
  app/           Vue shell — components, composables, styles
  engine/        WebGPU renderer — math, scene, render, camera, picking
  scenes/        Sample scene content (demo card)
```

The core renderer lives in `src/engine`:

- `render/RenderManager.ts` — WebGPU init, pipeline, drawing, mesh picking
- `scene/SceneGraph.ts` — local and world transforms
- `camera/OrbitCamera.ts` — canvas pointer tracking and wheel dolly
- `math/` — `Matrix4`, `Vector2D`, `Vector3D`
- `render/shaders/` — WGSL vertex and fragment shaders
- `shapes/` — unit quad used by the demo scene

Sample content lives in `src/scenes/demoCard.ts`.

## Scripts

Use pnpm:

```sh
pnpm install
pnpm dev
pnpm check
pnpm build
```

`pnpm check` runs formatting verification, Oxlint, Biome linting, and TypeScript checking.
