import type { OrbitCamera } from '../camera/OrbitCamera.js';
import { Matrix4 } from '../math/Matrix.js';
import { Vector3D } from '../math/Vector3D.js';
import { Mesh } from '../scene/Mesh.js';
import { NodeTransformation, SceneGraphNode, type Transformations } from '../scene/SceneGraph.js';
import type { Settings } from '../scene/types.js';
import { ScreenGeometry } from '../screen/ScreenGeometry.js';
import { resizeCanvasToDisplaySize } from '../utils/utils.js';
import fragmentShaderSource from './shaders/fragment.wgsl';
import vertexShaderSource from './shaders/vertex.wgsl';

const BYTES_PER_FLOAT = 4;
const FLOATS_PER_VERTEX = 3; // x, y, z
const COLOR_FLOATS = 4; // r, g, b, a
const MATRIX_FLOATS = 16; // 4x4 matrix

/**
 * The stride of the vertex buffer.
 * This is for a position-only vertex layout: 3 floats (x, y, z) 4 bytes each = 12 bytes per vertex
 */
const VERTEX_STRIDE = FLOATS_PER_VERTEX * BYTES_PER_FLOAT;

/**
 * The layout of the vertex buffer.
 * This is for a position-only vertex layout: 3 floats (x, y, z) 4 bytes each = 12 bytes per vertex
 */
const VERTEX_BUFFER_LAYOUT: GPUVertexBufferLayout = {
  arrayStride: VERTEX_STRIDE,
  attributes: [
    {
      shaderLocation: 0,
      offset: 0,
      format: 'float32x3',
    },
  ],
};

/**
 * The size of the uniform buffer.
 * This is for a color and a matrix: 4 floats (r, g, b, a) 4 bytes each + 16 floats (4x4 matrix) 4 bytes each = 80 bytes
 */
const UNIFORM_BUFFER_SIZE = (COLOR_FLOATS + MATRIX_FLOATS) * BYTES_PER_FLOAT;

interface InstanceInfo {
  uniformBuffer: GPUBuffer;
  uniformValues: Float32Array;
  matrixValue: Float32Array;
  colorValue: Float32Array;
  bindGroup: GPUBindGroup;
}

interface IntersectingMesh {
  mesh: Mesh;
  position: Vector3D;
}

type GPUInitialized = {
  device: GPUDevice;
  ctx: GPUCanvasContext;
  presentationFormat: GPUTextureFormat;
};

interface MeshGeometryData {
  vertexData: Float32Array;
  indexData: Uint16Array;
  source: Transformations;
}

interface PerInstanceData {
  color: Float32Array;
}

export class RenderManager {
  readonly canvas: HTMLCanvasElement;
  readonly screen: ScreenGeometry;
  readonly settings: Settings;
  readonly meshes: Mesh[] = [];
  readonly transformMatrix: Matrix4;
  readonly root: SceneGraphNode;

  #camera: OrbitCamera | null = null;
  #scratchMatrix = new Matrix4();

  #gpu: GPUInitialized | null = null;
  #instanceInfos: InstanceInfo[] = [];

  #vertexShader: GPUShaderModule | null = null;
  #fragmentShader: GPUShaderModule | null = null;

  #bindGroupLayout: GPUBindGroupLayout | null = null;
  #pipelineLayout: GPUPipelineLayout | null = null;
  #renderPipeline: GPURenderPipeline | null = null;

  constructor(canvas: HTMLCanvasElement) {
    if (!navigator.gpu) {
      throw new Error('WebGPU not supported on this browser.');
    }

    this.canvas = canvas;
    this.root = new SceneGraphNode('root');
    this.screen = new ScreenGeometry();
    this.transformMatrix = new Matrix4();

    this.settings = {
      useOrthographic: false,
      fieldOfView: 2 * Math.atan(1000 / (2 * 300)),
      zoom: 1,
      orthographicHeight: 1000,
      orthographicTranslation: new Float32Array([0, 0, 0]),
      translation: new Float32Array([0, 0, 0]),
      scale: new Float32Array([1, 1, 1]),
      rotation: this.screen.degreesToRadians(0),
    };

    this.redraw = this.redraw.bind(this);
  }

  #assertGPU(): GPUInitialized {
    if (!this.#gpu) {
      throw new Error('GPU not initialized. Call init() first.');
    }
    return this.#gpu;
  }

  async init() {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw new Error('No appropriate GPUAdapter found.');
    }

    const device = await adapter.requestDevice();
    if (!device) {
      throw new Error('No appropriate GPUDevice found.');
    }

    const ctx = this.canvas.getContext('webgpu');
    if (!ctx) {
      throw new Error('Failed to get WebGPU context.');
    }

    const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
    ctx.configure({
      device,
      format: presentationFormat,
      /**
       * Enables transparency in the WebGPU canvas so the CSS background is visible instead of being fully covered.
       */
      alphaMode: 'premultiplied',
    });

    this.#gpu = { device, ctx, presentationFormat };

    resizeCanvasToDisplaySize(this.canvas);
  }

  setPipeline() {
    this.#createBindGroupLayout();
    this.#createShaders();
    this.#createPipeline();
  }

  /** Workaround for TS lib ArrayBufferLike vs WebGPU GPUAllowSharedBufferSource */
  #toBufferSource(data: Float32Array | Uint16Array): BufferSource {
    return data as BufferSource;
  }

  /** Upload vertex and index data to the GPU and store the buffers on the mesh. */
  #uploadGeometry(mesh: Mesh) {
    const { device } = this.#assertGPU();

    mesh.gpuVertexBuffer = device.createBuffer({
      label: `${mesh.node.id} Vertex Buffer`,
      size: mesh.vertexData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    device.queue.writeBuffer(mesh.gpuVertexBuffer, 0, this.#toBufferSource(mesh.vertexData));

    mesh.gpuIndexBuffer = device.createBuffer({
      label: `${mesh.node.id} Index Buffer`,
      size: mesh.indexData.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });

    device.queue.writeBuffer(mesh.gpuIndexBuffer, 0, this.#toBufferSource(mesh.indexData));
  }

  /** Create the uniform buffer and bind group for a single geometry instance. */
  // TODO: rename to createUniforms
  #createInstanceInfo(): InstanceInfo {
    const { device } = this.#assertGPU();
    const bindGroupLayout = this.#bindGroupLayout;

    if (!bindGroupLayout) {
      throw new Error('Bind group layout not created.');
    }

    const uniformBuffer = device.createBuffer({
      label: 'Instance Uniform Buffer',
      size: UNIFORM_BUFFER_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const uniformValues = new Float32Array(UNIFORM_BUFFER_SIZE / BYTES_PER_FLOAT);
    const colorValue = uniformValues.subarray(0, COLOR_FLOATS);
    const matrixValue = uniformValues.subarray(COLOR_FLOATS, COLOR_FLOATS + MATRIX_FLOATS);

    const bindGroup = device.createBindGroup({
      label: 'Instance Bind Group',
      layout: bindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: { buffer: uniformBuffer },
        },
      ],
    });

    return {
      uniformBuffer,
      uniformValues,
      matrixValue,
      colorValue,
      bindGroup,
    };
  }

  #getOrCreateInstanceInfo(index: number): InstanceInfo {
    while (this.#instanceInfos.length <= index) {
      this.#instanceInfos.push(this.#createInstanceInfo());
    }
    return this.#instanceInfos[index];
  }

  #createShaders() {
    const { device } = this.#assertGPU();

    this.#vertexShader = device.createShaderModule({
      label: 'Vertex Shader',
      code: vertexShaderSource,
    });
    this.#fragmentShader = device.createShaderModule({
      label: 'Fragment Shader',
      code: fragmentShaderSource,
    });
  }

  #createBindGroupLayout() {
    const { device } = this.#assertGPU();

    this.#bindGroupLayout = device.createBindGroupLayout({
      label: 'Bind Group Layout',
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: {},
        },
      ],
    });
  }

  #createPipeline() {
    const { device, presentationFormat } = this.#assertGPU();

    if (!this.#vertexShader || !this.#fragmentShader) {
      throw new Error('Pipeline dependencies not created.');
    }

    this.#pipelineLayout = device.createPipelineLayout({
      label: 'Pipeline Layout',
      bindGroupLayouts: [this.#bindGroupLayout],
    });

    this.#renderPipeline = device.createRenderPipeline({
      label: 'Render Pipeline',
      layout: this.#pipelineLayout,
      vertex: {
        module: this.#vertexShader,
        entryPoint: 'main',
        buffers: [VERTEX_BUFFER_LAYOUT],
      },
      fragment: {
        module: this.#fragmentShader,
        entryPoint: 'main',
        targets: [{ format: presentationFormat }],
      },
    });
  }

  #applyPerspectiveProjection(aspect: number) {
    this.transformMatrix
      .perspective(this.settings.fieldOfView, aspect, 1, 2000)
      .translate(this.settings.translation)
      .rotateZ(this.settings.rotation)
      .scale(this.settings.scale);
  }

  #applyOrthographicProjection(aspect: number, near = -1, far = 1) {
    const halfHeight = (this.settings.orthographicHeight * 0.5) / this.settings.zoom;
    const halfWidth = halfHeight * aspect;
    this.transformMatrix
      .orthographic(-halfWidth, halfWidth, -halfHeight, halfHeight, near, far)
      .translate(this.settings.translation)
      .rotateZ(this.settings.rotation)
      .scale(this.settings.scale);
  }

  #computeViewProjectionMatrix() {
    const aspect = this.canvas.width / this.canvas.height;
    const orthoNear = this.#camera ? 1 : -1;
    const orthoFar = this.#camera ? 2000 : 1;

    if (this.#camera) {
      /**
       * Copy the OrbitCamera's matrix to the temporary matrix to keep the original Camera matrix unchanged.
       */
      this.#scratchMatrix.set(this.#camera.getMatrix().elements);
      /**
       * Make a view matrix from the camera's matrix.
       */
      this.#scratchMatrix.inverse();
      /**
       * Apply the perspective projection to the view matrix.
       */
      if (this.settings.useOrthographic) {
        this.#applyOrthographicProjection(aspect, orthoNear, orthoFar);
      } else {
        this.#applyPerspectiveProjection(aspect);
      }

      this.transformMatrix.multiply(this.#scratchMatrix);
      return;
    }

    if (this.settings.useOrthographic) {
      this.#applyOrthographicProjection(aspect, orthoNear, orthoFar);
    } else {
      this.#applyPerspectiveProjection(aspect);
    }
  }

  #drawMesh(device: GPUDevice, pass: GPURenderPassEncoder, instanceNdx: number) {
    const mesh = this.meshes[instanceNdx];
    const instanceInfo = this.#getOrCreateInstanceInfo(instanceNdx);

    /**
     * Copy the view-projection matrix to the temporary scratch matrix to keep the original matrix unchanged.
     */
    this.#scratchMatrix.set(this.transformMatrix.elements);
    /**
     * The vertex shader expects model-view-projection (MVP):
     * clip_position = view_projection_matrix × world_matrix × local_vertex_position
     */
    this.#scratchMatrix.multiply(mesh.node.worldMatrix);

    instanceInfo.matrixValue.set(this.#scratchMatrix.elements);
    instanceInfo.colorValue.set(mesh.data.color);
    device.queue.writeBuffer(instanceInfo.uniformBuffer, 0, this.#toBufferSource(instanceInfo.uniformValues));

    if (!mesh.gpuVertexBuffer || !mesh.gpuIndexBuffer) {
      throw new Error(`GPU buffers not uploaded for ${mesh.node.id}.`);
    }

    pass.setBindGroup(0, instanceInfo.bindGroup);
    pass.setVertexBuffer(0, mesh.gpuVertexBuffer);
    pass.setIndexBuffer(mesh.gpuIndexBuffer, 'uint16');
    pass.drawIndexed(mesh.numIndices, 1, 0);
  }

  pickMesh(e: PointerEvent): SceneGraphNode | null {
    const target = e.target as Element;
    const rect = target.getBoundingClientRect();
    const clipX = ((e.clientX - rect.left) / target.clientWidth) * 2 - 1;
    const clipY = ((e.clientY - rect.top) / target.clientHeight) * -2 + 1;

    const intersectingMeshes = this.#getIntersectingMeshes(clipX, clipY);

    if (intersectingMeshes.length === 0) {
      return null;
    }

    // Sort the meshes by their z position to get the closest mesh
    intersectingMeshes.sort((a, b) => a.position.z - b.position.z);

    // Pick the the closest mesh (the first one)
    let node: SceneGraphNode | null = intersectingMeshes[0].mesh.node;
    while (node?.id.includes('mesh')) {
      node = node.parent;
    }

    return node;
  }

  #getIntersectingMeshes(clipX: number, clipY: number): IntersectingMesh[] {
    const clipNear = new Vector3D(clipX, clipY, 0);
    const clipFar = new Vector3D(clipX, clipY, 1);

    const worldViewProjection = new Matrix4();
    const scratchMatrix = new Matrix4();
    const near = new Vector3D();
    const far = new Vector3D();
    const vertices = [new Vector3D(), new Vector3D(), new Vector3D()];

    this.#computeViewProjectionMatrix();

    const intersectingMeshes: IntersectingMesh[] = [];
    for (const mesh of this.meshes) {
      /**
       * Put the view-projection matrix in model space (the space of the vertex data).
       */
      worldViewProjection.set(this.transformMatrix.elements).multiply(mesh.node.worldMatrix);

      /**
       * Invert it to be able to transform clip space coordinates to model space.
       */
      scratchMatrix.set(worldViewProjection.elements);
      scratchMatrix.inverse();

      /**
       * Now transform the clip space coordinates to model space so we can compare them to the model vertices and AABB.
       */
      near.transformByMatrix4(scratchMatrix, clipNear);
      far.transformByMatrix4(scratchMatrix, clipFar);

      const { vertexData, indexData, numIndices } = mesh;
      const numTriangles = numIndices / 3;

      let closest: Vector3D | undefined;

      /**
       * Iterate over each triangle in the mesh to find the closest intersection.
       */
      for (let t = 0; t < numTriangles; ++t) {
        /**
         * Get the 3 positions for the triangle using the index buffer.
         */
        for (let i = 0; i < vertices.length; i++) {
          const offset = indexData[t * 3 + i] * FLOATS_PER_VERTEX;
          vertices[i].x = vertexData[offset + 0];
          vertices[i].y = vertexData[offset + 1];
          vertices[i].z = vertexData[offset + 2];
        }

        const result = this.screen.intersectLineSegmentAndTriangle(near, far, vertices[0], vertices[1], vertices[2]);
        if (result) {
          /**
           * Convert model space back to clip space so we can check Z to keep the closest hit.
           */
          result.transformByMatrix4(worldViewProjection);

          if (closest === undefined || result.z < closest.z) {
            closest = result;
          }
        }
      }

      if (closest !== undefined) {
        intersectingMeshes.push({ position: closest, mesh });
      }
    }

    return intersectingMeshes;
  }

  #render(device: GPUDevice, ctx: GPUCanvasContext) {
    if (!this.#renderPipeline) {
      throw new Error('Render pipeline not created.');
    }

    this.root.updateWorldMatrix();
    this.#computeViewProjectionMatrix();

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      label: 'Render Pass',
      colorAttachments: [
        {
          view: ctx.getCurrentTexture().createView(),
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });
    pass.setPipeline(this.#renderPipeline);

    for (let i = 0; i < this.meshes.length; i++) {
      this.#drawMesh(device, pass, i);
    }

    pass.end();
    device.queue.submit([encoder.finish()]);
  }

  redraw() {
    const gpu = this.#gpu;
    if (gpu && this.#renderPipeline) {
      this.#render(gpu.device, gpu.ctx);
    }
  }

  setCamera(camera: OrbitCamera) {
    this.#camera = camera;
  }

  addNode(id: string, source: Transformations, parent: SceneGraphNode = this.root): SceneGraphNode {
    const node = new SceneGraphNode(id, new NodeTransformation(source));
    parent.addChild(node);
    return node;
  }

  addRect(id: string, geometry: MeshGeometryData, data: PerInstanceData, parent: SceneGraphNode): Mesh {
    const { vertexData, indexData, source } = geometry;
    const node = this.addNode(id, source, parent);
    const mesh = new Mesh(node, vertexData, indexData, data);

    this.#uploadGeometry(mesh);
    this.meshes.push(mesh);

    return mesh;
  }
}
