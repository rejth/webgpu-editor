import type { Vector3D } from '../math/Vector3D';

export class ScreenGeometry {
  // https://en.wikipedia.org/wiki/M%C3%B6ller%E2%80%93Trumbore_intersection_algorithm
  intersectLineSegmentAndTriangle(
    p0: Vector3D,
    p1: Vector3D,
    v0: Vector3D,
    v1: Vector3D,
    v2: Vector3D,
  ): Vector3D | null {
    const edge1 = v1.sub(v0);
    const edge2 = v2.sub(v0);
    const direction = p1.sub(p0); // Line segment direction

    const h = direction.cross(edge2);
    const a = edge1.dot(h);

    /**
     * If "a" is near zero, the line is parallel to the triangle's plane so there is no intersection.
     */
    if (Math.abs(a) < 0.00001) {
      return null;
    }

    const f = 1 / a;
    const s = p0.sub(v0);
    const u = f * s.dot(h);

    /**
     * Check if the intersection point is outside the triangle's U parameter range [0, 1].
     */
    if (u < 0.0 || u > 1.0) {
      return null;
    }

    const q = s.cross(edge1);
    const v = f * direction.dot(q);

    /**
     * Check if the intersection point is outside the triangle's V parameter range [0, 1] or S+T range [0, 1].
     */
    if (v < 0.0 || u + v > 1.0) {
      return null;
    }

    /**
     * At this stage, the intersection point lies on the infinite line and within the triangle.
     */
    const t = f * edge2.dot(q);

    /**
     * Check if the intersection point lies within the line segment's T parameter range [0, 1].
     */
    if (t < 0.0 || t > 1.0) {
      return null;
    }

    /**
     * Return the intersection point.
     */
    return p0.add(direction.scale(t));
  }

  degreesToRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }

  radiansToDegrees(radians: number): number {
    return (radians * 180) / Math.PI;
  }
}
