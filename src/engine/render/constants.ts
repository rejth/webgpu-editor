export const BYTES_PER_FLOAT = 4;
export const FLOATS_PER_VERTEX = 3; // x, y, z
export const COLOR_FLOATS = 4; // r, g, b, a
export const MATRIX_FLOATS = 16; // 4x4 matrix

/**
 * The stride of the vertex buffer.
 * This is for a position-only vertex layout: 3 floats (x, y, z) 4 bytes each = 12 bytes per vertex
 */
export const VERTEX_STRIDE = FLOATS_PER_VERTEX * BYTES_PER_FLOAT;

/**
 * The layout of the vertex buffer.
 * This is for a position-only vertex layout: 3 floats (x, y, z) 4 bytes each = 12 bytes per vertex
 */
export const VERTEX_BUFFER_LAYOUT: GPUVertexBufferLayout = {
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
export const UNIFORM_BUFFER_SIZE = (COLOR_FLOATS + MATRIX_FLOATS) * BYTES_PER_FLOAT;
