export interface Vec2 {
  readonly y: number;
  readonly z: number;
}

export function vec2(y: number, z: number): Vec2 {
  return { y, z };
}

export function add(a: Vec2, b: Vec2): Vec2 {
  return { y: a.y + b.y, z: a.z + b.z };
}

export function sub(a: Vec2, b: Vec2): Vec2 {
  return { y: a.y - b.y, z: a.z - b.z };
}

export function scale(a: Vec2, factor: number): Vec2 {
  return { y: a.y * factor, z: a.z * factor };
}

export function dot(a: Vec2, b: Vec2): number {
  return a.y * b.y + a.z * b.z;
}

export function length(a: Vec2): number {
  return Math.hypot(a.y, a.z);
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.y - b.y, a.z - b.z);
}

export function normalize(a: Vec2): Vec2 {
  const magnitude = length(a);
  return { y: a.y / magnitude, z: a.z / magnitude };
}

export function perpendicular(a: Vec2): Vec2 {
  return { y: -a.z, z: a.y };
}
