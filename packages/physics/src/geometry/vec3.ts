export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export function add3(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function sub3(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function scale3(a: Vec3, factor: number): Vec3 {
  return { x: a.x * factor, y: a.y * factor, z: a.z * factor };
}

export function dot3(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function cross3(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function length3(a: Vec3): number {
  return Math.sqrt(dot3(a, a));
}

export function normalize3(a: Vec3): Vec3 {
  const magnitude = length3(a);
  return magnitude === 0 ? { x: 0, y: 0, z: 0 } : scale3(a, 1 / magnitude);
}

/** Rotate `point` about the line through `origin` with direction `axis` by `angle` radians. */
export function rotateAboutAxis(point: Vec3, origin: Vec3, axis: Vec3, angle: number): Vec3 {
  const direction = normalize3(axis);
  const relative = sub3(point, origin);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const parallel = scale3(direction, dot3(direction, relative) * (1 - cos));
  const perpendicular = add3(scale3(relative, cos), scale3(cross3(direction, relative), sin));
  return add3(origin, add3(perpendicular, parallel));
}

export function rotateAboutX(point: Vec3, origin: Vec3, angle: number): Vec3 {
  const relative = sub3(point, origin);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return add3(origin, {
    x: relative.x,
    y: relative.y * cos - relative.z * sin,
    z: relative.y * sin + relative.z * cos,
  });
}
