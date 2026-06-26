import { Matrix4 } from '../math/Matrix.js';
import { NodeTransformation } from './NodeTransformation.js';

export class SceneGraphNode {
  id: string;
  /**
   * The children of this node.
   * */
  children: SceneGraphNode[];
  /**
   * The local matrix representing the position, orientation, and scale of this node relative to its parent.
   * Local matrices only depend on the parent, not on the camera (view projection matrix).
   * */
  localMatrix: Matrix4;
  /**
   * The world matrix representing the position, orientation, and scale of this node relative to the root of the scene.
   * World matricex only depends on the scene graph root, not on the camera (view projection matrix).
   *
   * */
  worldMatrix: Matrix4;
  /**
   * The parent of this node.
   * */
  parent: SceneGraphNode | null;
  /**
   * The transformation (translation, rotation, scale) of this node.
   * */
  #source: NodeTransformation | null;

  constructor(id: string, source: NodeTransformation | null = null) {
    this.id = id;
    this.children = [];
    this.localMatrix = new Matrix4();
    this.worldMatrix = new Matrix4();
    this.parent = null;
    this.#source = source;
  }

  /**
   * Lazily initialized to an identity transformation if not set
   * */
  get source(): NodeTransformation {
    if (!this.#source) {
      this.#source = new NodeTransformation({});
    }

    return this.#source;
  }

  addChild(child: SceneGraphNode) {
    child.setParent(this);
  }

  removeChild(child: SceneGraphNode) {
    child.setParent(null);
  }

  setParent(parent: SceneGraphNode | null) {
    if (this.parent) {
      /**
       * If the node already has a parent, remove it from the parent's children
       */
      const nodeIndex = this.parent.children.indexOf(this);
      if (nodeIndex >= 0) {
        this.parent.children.splice(nodeIndex, 1);
      }
    }

    /**
     * If the node has a new parent, add it to the new parent's children
     */
    if (parent) {
      parent.children.push(this);
    }

    this.parent = parent;
  }

  updateWorldMatrix() {
    /**
     * Update the local matrix from the node's transformation.
     */
    this.localMatrix.identity();
    this.source.apply(this.localMatrix);

    if (this.parent) {
      /**
       * If the node has a parent, update the world matrix
       * This allows the node to inherit the parent's world matrix and apply its own local matrix to position it relative to the parent.
       */
      this.worldMatrix.set(this.parent.worldMatrix.elements);
      this.worldMatrix.multiply(this.localMatrix);
    } else {
      /**
       * If the node has no parent (root node), just copy the local matrix to the world matrix
       * This allows the node to be positioned at the origin of the scene.
       */
      this.worldMatrix.set(this.localMatrix.elements);
    }

    /**
     * Update the world matrix of all the node's children
     */
    for (const child of this.children) {
      child.updateWorldMatrix();
    }
  }
}
