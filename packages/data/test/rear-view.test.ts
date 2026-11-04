import { describe, expect, it } from 'vitest';
import {
  buildFrontViewScene,
  solveFrontView,
  solveLoadTransfer,
  solveRollStiffness,
} from '@setuplab/physics';
import rawModel from '../../../assets/models/reference-touring-car.json';
import {
  buildFrontViewInput,
  buildLoadTransferInput,
  buildRollStiffnessInput,
  buildToeInput,
  parseCarModel,
  type CarModelDocument,
} from '../src/index.js';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function parseReference(): CarModelDocument {
  const parsed = parseCarModel(rawModel);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  return parsed.value;
}

function rearInput() {
  const input = buildFrontViewInput(parseReference(), 'LR');
  if (!input.ok) throw new Error(JSON.stringify(input.errors));
  return input.value;
}

describe('rear corner modelled geometry', () => {
  it('stores every rear hardpoint with s_modelled, not a measured source', () => {
    const model = parseReference();

    const source = model.sources['s_modelled'];
    expect(source?.type).toBe('modelled');
    expect(source?.method).toBe('modelled rear geometry — not measured');

    expect(model.axles.rear?.derivedFrom).toBeNull();
    expect(rawModel.axles.rear).not.toHaveProperty('derived_from');

    for (const key of ['LR', 'RR'] as const) {
      const corner = model.corners[key];
      expect(corner).toBeDefined();
      if (corner === undefined) continue;

      const points = Object.values(corner.points);
      expect(points.length).toBeGreaterThan(0);
      for (const point of points) {
        expect(point?.source).toBe('s_modelled');
        expect(point?.confidence).toBe('modelled');
      }

      expect(corner.points.tie_in?.source).toBe('s_modelled');
      expect(corner.points.tie_out?.source).toBe('s_modelled');
      expect(corner.toe?.value).toBeCloseTo(0.5, 12);
      expect(corner.toe?.source).toBe('s_modelled');
    }

    expect(model.corners.LR?.points.tie_in?.value).toEqual([-22, 32, 22]);
    expect(model.corners.LR?.points.tie_out?.value).toEqual([25, 73, 23]);
    expect(model.corners.RR?.points.tie_in?.value).toEqual([-22, -32, 22]);
    expect(model.corners.RR?.points.tie_out?.value).toEqual([25, -73, 23]);
    expect(model.corners.LR?.points.uca_in?.value).toEqual([-4, 44, 45]);
    expect(model.corners.LR?.points.arb_drop?.value).toEqual([1, 57, 2.5]);
    expect(model.corners.RR?.points.wc?.value).toEqual([0, -87, 25]);

    expect(model.axles.rear?.bumpLimit?.value).toBeCloseTo(6.0, 12);
    expect(model.axles.rear?.droopLimit?.value).toBeCloseTo(6.0, 12);
  });

  it('solves the modelled rear as inferred and flagged modelled, never derived', () => {
    const result = solveFrontView(rearInput());
    const outputs = [
      result.instantCentre,
      result.rollCentreHeight,
      result.rollCentreLateral,
      result.camberGain,
      result.camberGainGlobal,
      result.staticState,
    ];

    for (const output of outputs) {
      expect(output.kind).toBe('defined');
      if (output.kind !== 'defined') continue;
      expect(output.tier).toBe('inferred');
      expect(output.flags.has('derivedGeometry')).toBe(false);
      expect(output.flags.has('modelledGeometry')).toBe(true);
      expect(output.provenance.has('LR.points.uca_in')).toBe(true);
      expect(output.provenance.has('s_modelled')).toBe(true);
    }
  });

  it('computes rear roll centre, instant centre and camber gain from the rear geometry', () => {
    const frontInput = buildFrontViewInput(parseReference(), 'LF');
    expect(frontInput.ok).toBe(true);
    if (!frontInput.ok) return;

    const front = solveFrontView(frontInput.value);
    const rear = solveFrontView(rearInput());

    expect(front.rollCentreHeight.kind).toBe('defined');
    expect(rear.rollCentreHeight.kind).toBe('defined');
    expect(front.instantCentre.kind).toBe('defined');
    expect(rear.instantCentre.kind).toBe('defined');
    expect(front.camberGain.kind).toBe('defined');
    expect(rear.camberGain.kind).toBe('defined');
    if (
      front.rollCentreHeight.kind !== 'defined' ||
      rear.rollCentreHeight.kind !== 'defined' ||
      front.instantCentre.kind !== 'defined' ||
      rear.instantCentre.kind !== 'defined' ||
      front.camberGain.kind !== 'defined' ||
      rear.camberGain.kind !== 'defined'
    ) {
      return;
    }

    expect(rear.rollCentreHeight.value).not.toBeCloseTo(front.rollCentreHeight.value, 6);
    expect(rear.instantCentre.value.y).not.toBeCloseTo(front.instantCentre.value.y, 6);
    expect(rear.camberGain.value).not.toBeCloseTo(front.camberGain.value, 6);

    const scene = buildFrontViewScene(rearInput(), rear);
    expect(scene.rollCentre.kind).toBe('defined');
    if (scene.rollCentre.kind === 'defined') {
      expect(scene.rollCentre.y).toBe(rear.rollCentreHeight.value);
    }
  });

  it('draws the rear from rear hardpoints, not the mirrored front ones', () => {
    const input = rearInput();
    const scene = buildFrontViewScene(input, solveFrontView(input));

    const upperInner = scene.hardpoints.find((point) => point.id === 'uca_in');
    const lowerInner = scene.hardpoints.find((point) => point.id === 'lca_in');
    expect(upperInner?.point.y).toBeCloseTo(0.052, 12);
    expect(lowerInner?.point.y).toBeCloseTo(0.016, 12);
    expect(upperInner?.point.y).not.toBeCloseTo(0.045, 12);
  });

  it('draws the rear toe link from its modelled points', () => {
    const input = rearInput();
    expect(input.upperArmType).toBe('single_link');

    const result = solveFrontView(input);
    expect(result.staticState.kind).toBe('defined');

    const scene = buildFrontViewScene(input, result);
    expect(scene.hardpoints.some((point) => point.id === 'tie_in')).toBe(true);
    expect(scene.hardpoints.some((point) => point.id === 'tie_out')).toBe(true);
    expect(scene.tieRod).not.toBeNull();
    expect(scene.tieRod?.role).toBe('tie');
    expect(scene.lowerArm.id).not.toContain('tie');
    expect(scene.upperLink.id).not.toContain('tie');
  });

  it('builds the rear toe input with its modelled points and stored toe', () => {
    const model = parseReference();
    const rear = buildToeInput(model, 'LR');
    const front = buildToeInput(model, 'LF');
    expect(rear.ok).toBe(true);
    expect(front.ok).toBe(true);
    if (!rear.ok || !front.ok) return;

    expect(rear.value.tieIn_m.value).toEqual({
      x: -22 / 1000,
      y: 32 / 1000,
      z: 29 / 1000,
    });
    expect(rear.value.tieOut_m.value).toEqual({
      x: 25 / 1000,
      y: 73 / 1000,
      z: 30 / 1000,
    });
    expect(rear.value.staticToe_rad.value).toBeCloseTo((0.5 * Math.PI) / 180, 12);
    expect(rear.value.staticToe_rad.ref).toBe('LR.toe');
    expect(front.value.staticToe_rad.value).toBeCloseTo((0.5 * Math.PI) / 180, 12);
    expect(front.value.staticToe_rad.ref).toBe('LF.toe');
  });

  it('does not silently mirror the front corner into a rear corner when one is absent', () => {
    const withoutRear = clone(rawModel) as { corners: Record<string, unknown> };
    delete withoutRear.corners['LR'];
    delete withoutRear.corners['RR'];
    const parsed = parseCarModel(withoutRear);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const input = buildFrontViewInput(parsed.value, 'LR');
    expect(input.ok).toBe(false);
    if (input.ok) return;
    expect(input.errors.some((error) => error.path === 'corners.LR')).toBe(true);
  });

  it('changes rear roll stiffness and front share when a rear hardpoint moves', () => {
    const base = parseReference();
    const movedRaw = clone(rawModel) as {
      corners: { LR: { points: { arb_drop: { value: number[] } } } };
    };
    movedRaw.corners.LR.points.arb_drop.value[1] = 62;
    const moved = parseCarModel(movedRaw);
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;

    const baseInput = buildRollStiffnessInput(base);
    const movedInput = buildRollStiffnessInput(moved.value);
    expect(baseInput.ok).toBe(true);
    expect(movedInput.ok).toBe(true);
    if (!baseInput.ok || !movedInput.ok) return;

    const baseRoll = solveRollStiffness(baseInput.value);
    const movedRoll = solveRollStiffness(movedInput.value);

    expect(baseRoll.front.rollStiffness.kind).toBe('defined');
    expect(movedRoll.front.rollStiffness.kind).toBe('defined');
    expect(baseRoll.rear.rollStiffness.kind).toBe('defined');
    expect(movedRoll.rear.rollStiffness.kind).toBe('defined');
    expect(baseRoll.frontShare.kind).toBe('defined');
    expect(movedRoll.frontShare.kind).toBe('defined');
    if (
      baseRoll.front.rollStiffness.kind !== 'defined' ||
      movedRoll.front.rollStiffness.kind !== 'defined' ||
      baseRoll.rear.rollStiffness.kind !== 'defined' ||
      movedRoll.rear.rollStiffness.kind !== 'defined' ||
      baseRoll.frontShare.kind !== 'defined' ||
      movedRoll.frontShare.kind !== 'defined'
    ) {
      return;
    }

    expect(movedRoll.front.rollStiffness.value).toBeCloseTo(
      baseRoll.front.rollStiffness.value,
      9,
    );
    expect(baseRoll.rear.working.antiRollBar.motionRatio).not.toBeCloseTo(
      movedRoll.rear.working.antiRollBar.motionRatio ?? 0,
      9,
    );
    expect(movedRoll.rear.rollStiffness.value).not.toBeCloseTo(
      baseRoll.rear.rollStiffness.value,
      6,
    );
    expect(movedRoll.frontShare.value).not.toBeCloseTo(baseRoll.frontShare.value, 6);

    const baseTransfer = buildLoadTransferInput(base, 9.81);
    const movedTransfer = buildLoadTransferInput(moved.value, 9.81);
    expect(baseTransfer.ok).toBe(true);
    expect(movedTransfer.ok).toBe(true);
    if (!baseTransfer.ok || !movedTransfer.ok) return;

    const baseBalance = solveLoadTransfer(baseTransfer.value).balance;
    const movedBalance = solveLoadTransfer(movedTransfer.value).balance;
    expect(baseBalance.kind).toBe('defined');
    expect(movedBalance.kind).toBe('defined');
    if (baseBalance.kind !== 'defined' || movedBalance.kind !== 'defined') return;
    expect(movedBalance.value).not.toBeCloseTo(baseBalance.value, 6);
  });

  it('does not leave balance unchanged when the rear corners are absent', () => {
    const withRearCorners = parseReference();

    const withoutRear = clone(rawModel) as { corners: Record<string, unknown> };
    delete withoutRear.corners['LR'];
    delete withoutRear.corners['RR'];
    const withoutRearCorners = parseCarModel(withoutRear);
    expect(withoutRearCorners.ok).toBe(true);
    if (!withoutRearCorners.ok) return;

    const rollWith = buildRollStiffnessInput(withRearCorners);
    const rollWithout = buildRollStiffnessInput(withoutRearCorners.value);
    expect(rollWith.ok).toBe(true);
    expect(rollWithout.ok).toBe(true);
    if (!rollWith.ok || !rollWithout.ok) return;

    const withShare = solveRollStiffness(rollWith.value).frontShare;
    const withoutShare = solveRollStiffness(rollWithout.value).frontShare;
    expect(withShare.kind).toBe('defined');
    expect(withoutShare.kind).toBe('defined');
    if (withShare.kind !== 'defined' || withoutShare.kind !== 'defined') return;
    expect(withShare.value).not.toBeCloseTo(withoutShare.value, 6);

    const transferWith = buildLoadTransferInput(withRearCorners, 9.81);
    const transferWithout = buildLoadTransferInput(withoutRearCorners.value, 9.81);
    expect(transferWith.ok).toBe(true);
    expect(transferWithout.ok).toBe(true);
    if (!transferWith.ok || !transferWithout.ok) return;

    const balanceWith = solveLoadTransfer(transferWith.value).balance;
    const balanceWithout = solveLoadTransfer(transferWithout.value).balance;
    expect(balanceWith.kind).toBe('defined');
    expect(balanceWithout.kind).toBe('defined');
    if (balanceWith.kind !== 'defined' || balanceWithout.kind !== 'defined') return;
    expect(balanceWith.value).not.toBeCloseTo(balanceWithout.value, 6);
  });
});
