import { describe, expect, it } from 'vitest';
import {
  parseCarModel,
  updateAxleArbValue,
  updateAxleDamperCoefficient,
  updateAxleSpringRate,
  updateChassisValue,
  updateCornerPointMm,
  type CarModelDocument,
  type CornerKey,
} from '@setuplab/data';
import rawModel from '../../assets/models/reference-touring-car.json';
import {
  interpret,
  type InterpreterLine,
  type Interpretation,
} from '../src/interpreter/interpreter.js';

function referenceModel(): CarModelDocument {
  const parsed = parseCarModel(rawModel);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  return parsed.value;
}

function mustEdit(
  result: ReturnType<typeof updateCornerPointMm> | ReturnType<typeof updateAxleSpringRate>,
): CarModelDocument {
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}

function withToe(model: CarModelDocument, corner: CornerKey, value: number): CarModelDocument {
  const raw = JSON.parse(JSON.stringify(model.raw)) as {
    corners: Record<string, { toe: { value: number } }>;
  };
  const target = raw.corners[corner];
  if (target === undefined) throw new Error(`missing corner ${corner}`);
  target.toe.value = value;
  const parsed = parseCarModel(raw);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  return parsed.value;
}

function signatures(lines: readonly InterpreterLine[]): readonly string[] {
  return lines.map((line) => `${line.phase}|${line.mechanism}|${line.confidence}`);
}

function resultOf(
  edit: (base: CarModelDocument) => CarModelDocument,
): Interpretation {
  const base = referenceModel();
  return interpret(base, edit(base));
}

function allText(result: Interpretation): string {
  return [
    result.emptyMessage,
    result.disclaimer,
    result.gripFootnote,
    ...result.lines.flatMap((line) => [line.mechanism, line.says, line.effect]),
  ].join('\n');
}

describe('change interpreter', () => {
  it('is silent when the loaded model is unedited', () => {
    const base = referenceModel();
    const result = interpret(base, base);
    expect(result.lines).toHaveLength(0);
    expect(result.emptyMessage).toMatch(/unchanged/i);
  });

  it('ignores a hardpoint wobble below the dead-band and reports a real move', () => {
    const base = referenceModel();
    const pointZ = base.corners.LF?.points.damper_up?.value[2] ?? 0;

    const wobble = mustEdit(
      updateCornerPointMm(base, 'LF', 'damper_up', 2, pointZ + 0.01),
    );
    expect(interpret(base, wobble).lines).toHaveLength(0);

    const moved = mustEdit(updateCornerPointMm(base, 'LF', 'damper_up', 2, pointZ + 1));
    expect(signatures(interpret(base, moved).lines)).toEqual([
      'mid|front wheel rate and damping ratio|direction',
    ]);
  });

  it('fires one mid-corner line for each spring rate change', () => {
    const front = resultOf((base) => mustEdit(updateAxleSpringRate(base, 'front', 4.0)));
    expect(signatures(front.lines)).toEqual(['mid|front share of roll resistance|mechanism']);

    const rear = resultOf((base) => mustEdit(updateAxleSpringRate(base, 'rear', 3.0)));
    expect(signatures(rear.lines)).toEqual(['mid|rear share of roll resistance|mechanism']);
  });

  it('fires the roll-share line for an anti-roll bar change', () => {
    const front = resultOf((base) =>
      mustEdit(updateAxleArbValue(base, 'front', 'bar_diameter', 1.6)),
    );
    expect(signatures(front.lines)).toEqual(['mid|front share of roll resistance|mechanism']);

    const rear = resultOf((base) =>
      mustEdit(updateAxleArbValue(base, 'rear', 'bar_diameter', 1.3)),
    );
    expect(signatures(rear.lines)).toEqual(['mid|rear share of roll resistance|mechanism']);
  });

  it('puts the rear ARB roll-share and motion-ratio lines next to each other', () => {
    const base = referenceModel();
    const dropZ = base.corners.LR?.points.arb_drop?.value[2] ?? 0;
    const edited = mustEdit(updateCornerPointMm(base, 'LR', 'arb_drop', 2, dropZ - 27.5));
    const result = interpret(base, edited);

    expect(signatures(result.lines)).toEqual([
      'mid|rear share of roll resistance|mechanism',
      'mid|rear ARB motion ratio|direction',
    ]);
    expect(result.lines[0]?.says).toMatch(/rear ARB/i);
    expect(result.lines[1]?.says).toMatch(/motion ratio/i);
  });

  it('reports a damper coefficient at entry and exit but never the amount', () => {
    const result = resultOf((base) =>
      mustEdit(updateAxleDamperCoefficient(base, 'front', 14.0)),
    );
    expect(signatures(result.lines)).toEqual([
      'entry|rate at which load transfer arrives|illustrative',
      'exit|rate at which load transfer arrives|illustrative',
    ]);
    expect(result.lines[0]?.effect).toMatch(/amount/i);
  });

  it('reports the roll-centre height and the roll-moment arm', () => {
    const result = resultOf((base) =>
      mustEdit(updateCornerPointMm(base, 'LF', 'uca_in', 2, 39)),
    );
    expect(signatures(result.lines)).toEqual([
      'mid|front roll-centre height and the roll-moment arm|mechanism',
      'mid|front wheel rate and damping ratio|direction',
    ]);
  });

  it('reports anti-dive at entry and anti-squat at exit', () => {
    const front = resultOf((base) =>
      mustEdit(updateCornerPointMm(base, 'LF', 'lca_in_a', 2, 6)),
    );
    expect(signatures(front.lines)).toEqual([
      'mid|front roll-centre height and the roll-moment arm|mechanism',
      'mid|front wheel rate and damping ratio|direction',
      'entry|front transfer path through the links|direction',
    ]);

    const rear = resultOf((base) =>
      mustEdit(updateCornerPointMm(base, 'LR', 'lca_in_a', 2, 10)),
    );
    expect(signatures(rear.lines)).toEqual([
      'mid|rear share of roll resistance|mechanism',
      'mid|rear ARB motion ratio|direction',
      'mid|rear roll-centre height and the roll-moment arm|mechanism',
      'mid|rear wheel rate and damping ratio|direction',
      'exit|rear transfer path through the links|direction',
    ]);
  });

  it('reports caster at entry and mid-corner', () => {
    const result = resultOf((base) =>
      mustEdit(updateCornerPointMm(base, 'LF', 'uca_out', 2, 13)),
    );
    expect(signatures(result.lines)).toEqual([
      'mid|front roll-centre height and the roll-moment arm|mechanism',
      'mid|front wheel rate and damping ratio|direction',
      'entry|steer-axis camber gain and steering weight|direction',
      'mid|steer-axis camber gain and steering weight|direction',
    ]);
  });

  it('emits both front-toe phases because the signs oppose', () => {
    const base = referenceModel();
    const result = interpret(base, withToe(base, 'LF', -0.5));
    expect(signatures(result.lines)).toEqual([
      'entry|front standing slip angle|direction',
      'exit|front standing slip angle|direction',
    ]);
  });

  it('reports rear toe at every phase and a rear toe-gain change in compression', () => {
    const base = referenceModel();
    const toe = interpret(base, withToe(base, 'LR', 1.0));
    expect(signatures(toe.lines)).toEqual([
      'entry|rear standing slip angle|direction',
      'mid|rear standing slip angle|direction',
      'exit|rear standing slip angle|direction',
    ]);

    const gain = resultOf((baseModel) =>
      mustEdit(updateCornerPointMm(baseModel, 'LR', 'tie_out', 1, -12)),
    );
    expect(signatures(gain.lines)).toEqual([
      'exit|rear toe gain in compression|direction',
    ]);
  });

  it('attributes a ride-height change to CG, both roll centres and the roll-moment arm', () => {
    const result = resultOf((base) => {
      const edited = updateChassisValue(base, 'ride_height', 6.0);
      if (!edited.ok) throw new Error(JSON.stringify(edited.errors));
      return edited.value;
    });
    expect(signatures(result.lines)).toEqual([
      'entry|CG height and both roll-centre heights, hence the roll-moment arm|mechanism',
      'mid|CG height and both roll-centre heights, hence the roll-moment arm|mechanism',
      'exit|CG height and both roll-centre heights, hence the roll-moment arm|mechanism',
    ]);
  });

  it('never uses verdict vocabulary in a rendered string', () => {
    const base = referenceModel();
    const result = interpret(
      base,
      withToe(
        mustEdit(updateAxleSpringRate(base, 'front', 4.0)),
        'LF',
        -0.5,
      ),
    );
    expect(result.lines.length).toBeGreaterThan(0);
    expect(allText(result)).not.toMatch(/better|worse|faster|should|recommend/i);
  });

  it('agrees with the cards for every rule that names a number', () => {
    const spring = resultOf((base) => mustEdit(updateAxleSpringRate(base, 'front', 4.0)));
    expect(spring.after.front.springRate_Nmm).toBeGreaterThan(
      spring.before.front.springRate_Nmm ?? 0,
    );
    expect(spring.after.front.rollShare).toBeGreaterThan(
      spring.before.front.rollShare ?? 0,
    );
    expect(spring.lines[0]?.says).toContain('4.00');
    expect(spring.lines[0]?.effect).toContain('front share');
    expect(spring.lines[0]?.effect).toContain(
      (spring.after.front.rollStiffness_NmPerDeg ?? 0).toFixed(2),
    );

    const base = referenceModel();
    const dropZ = base.corners.LR?.points.arb_drop?.value[2] ?? 0;
    const arb = interpret(
      base,
      mustEdit(updateCornerPointMm(base, 'LR', 'arb_drop', 2, dropZ - 27.5)),
    );
    expect(arb.after.rear.rollShare).not.toBe(arb.before.rear.rollShare);
    expect(arb.after.rear.arbMotionRatio).not.toBe(arb.before.rear.arbMotionRatio);
    expect(arb.lines[0]?.effect).toMatch(/rear share/i);
  });

  it('worked example: a front spring change prints its exact line', () => {
    const result = resultOf((base) => mustEdit(updateAxleSpringRate(base, 'front', 4.0)));
    expect(signatures(result.lines)).toEqual(['mid|front share of roll resistance|mechanism']);
    expect(result.lines[0]?.says).toBe(
      'front spring rate 0.50 N/mm stiffer (3.50 → 4.00 N/mm)',
    );
    expect(result.lines[0]?.effect).toContain('front roll stiffness 0.65 → 0.69 N·m/deg');
  });

  it('leads with roll sensitivity, its delta and its band', () => {
    const result = resultOf((base) => {
      const edited = updateChassisValue(base, 'ride_height', 6.0);
      if (!edited.ok) throw new Error(JSON.stringify(edited.errors));
      return edited.value;
    });
    expect(result.headline.value).not.toBeNull();
    expect(result.headline.delta).not.toBeNull();
    expect(result.headline.band).not.toBeNull();
    expect(result.headline.delta).not.toBe(0);
    if (result.headline.value !== null && result.headline.delta !== null) {
      expect(result.headline.value - (result.before.rollSensitivity_degPerG ?? 0)).toBeCloseTo(
        result.headline.delta,
        10,
      );
    }
  });
});
