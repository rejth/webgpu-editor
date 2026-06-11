# WebGPU Editor

WebGPU Editor is a TypeScript-first experiment for building an interactive canvas editor on top of WebGPU. It starts from a small renderer that can upload indexed geometry, draw scene graph nodes, move an orbit camera, and pick meshes from pointer input.

The goal is to turn the browser canvas into an editor surface that behaves more like a native graphics tool than a DOM-heavy layout app. WebGPU gives the project direct control over geometry, transforms, shaders, buffers, and redraw timing, while Vue stays focused on mounting the canvas and wiring input.

## Motivation

Most editor prototypes begin with DOM nodes, SVG, or Canvas 2D. Those are productive, but they tend to make the rendering model implicit: hit testing, transforms, zoom behavior, and draw order all become scattered across UI code.

This repo takes the opposite route. The editor model is built around explicit rendering primitives:

- a scene graph for parented transforms
- GPU vertex and index buffers for drawable mesh instances
- per-instance uniforms for color and model-view-projection matrices
- WGSL shaders for the draw pipeline
- camera-owned pointer and wheel interactions
- triangle-level picking that maps pointer coordinates back through clip space

That foundation is useful for an editor where objects may eventually become cards, nodes, handles, guides, selections, and higher-density scenes. The current app renders a simple two-layer card over a grid, but the code is organized around the pieces needed for richer editing: geometry creation, object transforms, camera movement, redraws, and selection.

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

`pnpm check` runs formatting verification, Oxlint, Biome linting, and TypeScript checking. Lefthook installs a pre-commit hook that runs the same core quality gates.
