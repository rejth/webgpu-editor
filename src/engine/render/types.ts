import type { Vector3D } from '../math/Vector3D';
import type { Mesh } from '../scene/Mesh';
import type { Transformations } from '../scene/NodeTransformation';

export interface InstanceInfo {
  uniformBuffer: GPUBuffer;
  uniformValues: Float32Array;
  matrixValue: Float32Array;
  colorValue: Float32Array;
  bindGroup: GPUBindGroup;
}

export interface IntersectingMesh {
  mesh: Mesh;
  position: Vector3D;
}

export type GPUInitialized = {
  device: GPUDevice;
  ctx: GPUCanvasContext;
  presentationFormat: GPUTextureFormat;
};

export interface MeshGeometryData {
  vertexData: Float32Array;
  indexData: Uint16Array;
  source: Transformations;
}

export interface PerInstanceData {
  color: Float32Array;
}
