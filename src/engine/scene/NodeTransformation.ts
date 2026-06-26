import type { Matrix4, Vector3 } from '../math/Matrix';

export type Transformations = Partial<{
  translation: Vector3;
  rotation: Vector3;
  scale: Vector3;
}>;

/**
 * A class that represents a translation, rotation, and scale transformations for a scene graph node.
 */
export class NodeTransformation {
  translation: Float32Array;
  rotation: Float32Array;
  scale: Float32Array;

  constructor({ translation = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1] }: Transformations) {
    this.translation = new Float32Array(translation);
    this.rotation = new Float32Array(rotation);
    this.scale = new Float32Array(scale);
  }

  apply(dst: Matrix4) {
    return dst.translate(this.translation).rotateZ(this.rotation[2]).scale(this.scale);
  }
}
