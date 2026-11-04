import { describe, expect, it } from 'vitest';
import {
  solveRates,
  type Confidence,
  type FrontViewInput,
  type RatesInput,
  type Sourced,
  type Vec2,
} from '../src/index.js';

const MM = 1 / 1000;
const mm = (v: number) => v * MM;

interface Point {
  y: number;
  z: number;
}

const sub = (a: Point, b: Point): Point => ({ y: a.y - b.y, z: a.z - b.z });
const add = (a: Point, b: Point): Point => ({ y: a.y + b.y, z: a.z + b.z });
const mul = (a: Point, s: number): Point => ({ y: a.y * s, z: a.z * s });
const dot = (a: Point, b: Point) => a.y * b.y + a.z * b.z;
const len = (a: Point) => Math.hypot(a.y, a.z);
const dist = (a: Point, b: Point) => len(sub(a, b));
const rot = (p: Point, hinge: Point, ang: number): Point => {
  const d = sub(p, hinge);
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  return { y: hinge.y + d.y * c - d.z * s, z: hinge.z + d.y * s + d.z * c };
};

interface Geometry {
  Li: Point;
  Lo: Point;
  Ui: Point;
  Uo: Point;
  W: Point;
  DamperLo: Point;
  DamperUp: Point;
}

function staticGeometry(g: Geometry) {
  const a = dist(g.Lo, g.Li);
  const b = dist(g.Uo, g.Ui);
  const d = dist(g.Uo, g.Lo);
  const theta0 = Math.atan2(g.Lo.z - g.Li.z, g.Lo.y - g.Li.y);
  const upper = (lowerOuter: Point, branch: 1 | -1): Point => {
    const delta = sub(lowerOuter, g.Ui);
    const D = len(delta);
    const along = (b * b - d * d + D * D) / (2 * D);
    const hc = Math.sqrt(b * b - along * along);
    const e = mul(delta, 1 / D);
    const p = { y: -e.z, z: e.y };
    return add(g.Ui, add(mul(e, along), mul(p, branch * hc)));
  };
  const plus = upper(g.Lo, 1);
  const minus = upper(g.Lo, -1);
  const branch: 1 | -1 = dist(plus, g.Uo) <= dist(minus, g.Uo) ? 1 : -1;
  const e1 = mul(sub(g.Uo, g.Lo), 1 / d);
  const e2 = { y: -e1.z, z: e1.y };
  const toW = sub(g.W, g.Lo);
  const u = dot(toW, e1);
  const v = dot(toW, e2);
  return { a, b, d, theta0, branch, u, v };
}

function state(g: Geometry, s: ReturnType<typeof staticGeometry>, theta: number) {
  const lowerOuter = add(g.Li, mul({ y: Math.cos(theta), z: Math.sin(theta) }, s.a));
  const delta = sub(lowerOuter, g.Ui);
  const D = len(delta);
  const along = (s.b * s.b - s.d * s.d + D * D) / (2 * D);
  const hc = Math.sqrt(s.b * s.b - along * along);
  const e = mul(delta, 1 / D);
  const p = { y: -e.z, z: e.y };
  const upperOuter = add(g.Ui, add(mul(e, along), mul(p, s.branch * hc)));
  const e1 = mul(sub(upperOuter, lowerOuter), 1 / s.d);
  const e2 = { y: -e1.z, z: e1.y };
  const wheel = add(lowerOuter, add(mul(e1, s.u), mul(e2, s.v)));
  const damperLo = rot(g.DamperLo, g.Li, theta - s.theta0);
  return { wheel, damperLength: dist(g.DamperUp, damperLo) };
}

/**
 * The independent hand check: a four-bar solved from scratch here, with the
 * ratio taken as the limit of a small crank-angle step. It shares no code with
 * the production finite difference, so agreement is evidence, not tautology.
 */
function independentRatio(g: Geometry, hTheta: number) {
  const s = staticGeometry(g);
  const hi = state(g, s, s.theta0 + hTheta);
  const lo = state(g, s, s.theta0 - hTheta);
  const dL = hi.damperLength - lo.damperLength;
  const dz = hi.wheel.z - lo.wheel.z;
  return -dL / dz;
}

const front: Geometry = {
  Li: { y: mm(30), z: mm(12) },
  Lo: { y: mm(78), z: mm(7) },
  Ui: { y: mm(42), z: mm(45) },
  Uo: { y: mm(72.8), z: mm(44) },
  W: { y: mm(86), z: mm(32) },
  DamperLo: { y: mm(60), z: mm(8.875) },
  DamperUp: { y: mm(44), z: mm(58) },
};

const rear: Geometry = {
  Li: { y: mm(30), z: mm(16) },
  Lo: { y: mm(80), z: mm(7) },
  Ui: { y: mm(44), z: mm(52) },
  Uo: { y: mm(73.5), z: mm(53) },
  W: { y: mm(87), z: mm(32) },
  DamperLo: { y: mm(68), z: mm(9) },
  DamperUp: { y: mm(56), z: mm(63) },
};

function sourced(ref: string, point: Point, confidence: Confidence = 'measured'): Sourced<Vec2> {
  return { ref, value: point, confidence };
}

function ratesInput(
  geometry: Geometry,
  corner: 'LF' | 'LR',
  springRate_Npm: number,
  sprungMass_kg: number,
): RatesInput {
  const frontView: FrontViewInput = {
    corner,
    side: 1,
    lowerArmType: 'hinge',
    upperArmType: 'single_link',
    lcaIn_m: sourced('lca_in_a', geometry.Li),
    lcaOut_m: sourced('lca_out', geometry.Lo),
    ucaIn_m: sourced('uca_in', geometry.Ui),
    ucaOut_m: sourced('uca_out', geometry.Uo),
    wheelCentre_m: sourced('wc', geometry.W),
    bumpLimit_m: mm(6),
    droopLimit_m: mm(6),
  };
  return {
    corner,
    frontView,
    damperLo_m: sourced('damper_lo', geometry.DamperLo),
    damperUp_m: sourced('damper_up', geometry.DamperUp),
    springRate_Npm: {
      value: springRate_Npm,
      ref: `axles.${corner === 'LF' ? 'front' : 'rear'}.spring.rate`,
      confidence: 'measured',
    },
    sprungMass_kg: {
      value: sprungMass_kg,
      ref: `body.mass.sprung_${corner === 'LF' ? 'front' : 'rear'}`,
      confidence: 'derived',
    },
  };
}

describe('installation ratio: independent hand check and step convergence', () => {
  const cases = [
    {
      name: 'front',
      geometry: front,
      corner: 'LF' as const,
      springRate_Npm: 3500,
      sprungMass_kg: 0.24375,
      expected: 0.565308,
    },
    {
      name: 'rear',
      geometry: rear,
      corner: 'LR' as const,
      springRate_Npm: 2600,
      sprungMass_kg: 0.311245,
      expected: 0.689205,
    },
  ];

  for (const testCase of cases) {
    it(`${testCase.name}: the ±0.5 mm step matches the small-rotation limit within 1e-5`, () => {
      const limit = independentRatio(testCase.geometry, 1e-7);
      const coarseLimit = independentRatio(testCase.geometry, 1e-3);

      // The hand calculation is stable as its own step shrinks.
      expect(Math.abs(limit - coarseLimit)).toBeLessThanOrEqual(1e-7);
      expect(limit).toBeCloseTo(testCase.expected, 5);

      const result = solveRates(
        ratesInput(
          testCase.geometry,
          testCase.corner,
          testCase.springRate_Npm,
          testCase.sprungMass_kg,
        ),
      );
      expect(result.installationRatio.kind).toBe('defined');
      if (result.installationRatio.kind !== 'defined') return;

      // The shipped ±0.5 mm wheel step has converged to the independent limit.
      expect(Math.abs(result.installationRatio.value - limit)).toBeLessThanOrEqual(1e-5);
    });
  }
});
