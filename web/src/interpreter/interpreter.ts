import {
  buildAntiDiveInput,
  buildAxleRates,
  buildCasterInput,
  buildDampingRatioInput,
  buildFrontViewInput,
  buildLoadTransferInput,
  buildRollStiffnessInput,
  buildToeInput,
  gravitiesToMetresPerSecondSquared,
  type CarModelDocument,
  type CornerKey,
  type CornerPointKey,
} from '@setuplab/data';
import {
  buildToeSeries,
  solveAntiDive,
  solveDampingRatio,
  solveFrontView,
  solveLoadTransfer,
  solveRollStiffness,
  solveSteeringAxis,
  type Band,
  type Solved,
} from '@setuplab/physics';

export type Phase = 'entry' | 'mid' | 'exit';
export type RuleConfidence = 'reliable' | 'direction';

export interface InterpreterLine {
  readonly ruleId: string;
  readonly phase: Phase;
  readonly mechanism: string;
  readonly says: string;
  readonly effect: string;
  readonly confidence: RuleConfidence;
}

export interface AxleSnapshot {
  readonly springRate_Nmm: number | null;
  readonly damperCoefficient_NsPerM: number | null;
  readonly arbType: string | null;
  readonly arbWheelRate_Nmm: number | null;
  readonly arbMotionRatio: number | null;
  readonly rollStiffness_NmPerDeg: number | null;
  readonly rollShare: number | null;
  readonly rollCentreHeight_mm: number | null;
  readonly damperMotionRatio: number | null;
  readonly dampingRatio: number | null;
  readonly antiDivePercent: number | null;
  readonly antiSquatPercent: number | null;
  readonly toe_deg: number | null;
  readonly toeGain_degPerMm: number | null;
  readonly caster_deg: number | null;
}

export interface ModelSnapshot {
  readonly front: AxleSnapshot;
  readonly rear: AxleSnapshot;
  readonly rideHeight_mm: number | null;
  readonly cgHeight_mm: number | null;
  readonly rollMomentArm_mm: number | null;
  readonly rollSensitivity_degPerG: number | null;
  readonly rollSensitivityBand: Band | null;
  readonly frontShare: number | null;
}

export interface AxleDeltas {
  readonly springRate_Nmm: number;
  readonly damperCoefficient_NsPerM: number;
  readonly arbWheelRate_Nmm: number;
  readonly arbMotionRatio: number;
  readonly rollStiffness_NmPerDeg: number;
  readonly rollShare_pp: number;
  readonly rollCentreHeight_mm: number;
  readonly damperMotionRatio: number;
  readonly antiDivePercent: number;
  readonly antiSquatPercent: number;
  readonly toe_deg: number;
  readonly toeGain_degPerMm: number;
  readonly caster_deg: number;
}

export interface InterpreterDeltas {
  readonly before: ModelSnapshot;
  readonly after: ModelSnapshot;
  readonly front: AxleDeltas;
  readonly rear: AxleDeltas;
  readonly rideHeight_mm: number;
  readonly cgHeight_mm: number;
  readonly rollMomentArm_mm: number;
  readonly rollSensitivity_degPerG: number;
  readonly hardpointDeltaMm: number;
  readonly arbTypeChanged: Readonly<Record<'front' | 'rear', boolean>>;
}

export interface Headline {
  readonly value: number | null;
  readonly delta: number | null;
  readonly band: Band | null;
}

export interface Interpretation {
  readonly lines: readonly InterpreterLine[];
  readonly emptyMessage: string;
  readonly disclaimer: string;
  readonly gripFootnote: string;
  readonly headline: Headline;
  readonly before: ModelSnapshot;
  readonly after: ModelSnapshot;
  readonly deltas: InterpreterDeltas;
}

export const DEAD_BANDS = {
  springRate_Nmm: 0.01,
  damperCoefficient_NsPerM: 0.1,
  arbWheelRate_Nmm: 0.001,
  arbMotionRatio: 0.001,
  rollCentreHeight_mm: 0.05,
  damperMotionRatio: 0.001,
  antiDivePercent: 0.1,
  caster_deg: 0.02,
  toe_deg: 0.01,
  toeGain_degPerMm: 0.0005,
  rideHeight_mm: 0.05,
  hardpoint_mm: 0.05,
} as const;

const GRAVITY_G = 1;
const RADIANS_TO_DEGREES = 180 / Math.PI;

interface Rule {
  readonly id: string;
  readonly when: (d: InterpreterDeltas) => boolean;
  readonly phases: readonly Phase[];
  readonly mechanism: string;
  readonly says: (d: InterpreterDeltas) => string;
  readonly effect: string | ((d: InterpreterDeltas, phase: Phase) => string);
  readonly confidence: RuleConfidence;
}

function definedValue(value: Solved<number> | null | undefined): number | null {
  return value !== null && value !== undefined && value.kind === 'defined' ? value.value : null;
}

function subtract(before: number | null, after: number | null): number {
  return before === null || after === null ? 0 : after - before;
}

function moved(value: number, band: number): boolean {
  return Math.abs(value) > band;
}

function number(value: number | null, digits = 2): string {
  return value === null ? 'not computable' : value.toFixed(digits);
}

function pair(before: number | null, after: number | null, digits = 2): string {
  return `${number(before, digits)} → ${number(after, digits)}`;
}

function percentPair(before: number | null, after: number | null): string {
  if (before === null || after === null) return 'not computable';
  return `${(before * 100).toFixed(1)} % → ${(after * 100).toFixed(1)} %`;
}

function rollCentreHeight_mm(model: CarModelDocument, cornerKey: CornerKey): number | null {
  const input = buildFrontViewInput(model, cornerKey);
  if (!input.ok) return null;
  const solved = solveFrontView(input.value);
  const value = definedValue(solved.rollCentreHeight);
  return value === null ? null : value * 1000;
}

function toeGain_degPerMm(model: CarModelDocument, cornerKey: CornerKey): number | null {
  const input = buildToeInput(model, cornerKey);
  if (!input.ok) return null;
  const series = buildToeSeries(input.value);
  if (series.kind !== 'series') return null;
  const value = definedValue(series.gain_radPerM);
  return value === null ? null : (value * RADIANS_TO_DEGREES) / 1000;
}

function caster_deg(model: CarModelDocument): number | null {
  const input = buildCasterInput(model, 'LF');
  if (!input.ok) return null;
  const solved = solveSteeringAxis(input.value);
  const value = definedValue(solved.caster_rad);
  return value === null ? null : value * RADIANS_TO_DEGREES;
}

function toe_deg(model: CarModelDocument, cornerKey: CornerKey): number | null {
  return model.corners[cornerKey]?.toe?.value ?? null;
}

function hardpointDeltaMm(before: CarModelDocument, after: CarModelDocument): number {
  let largest = 0;
  const corners = new Set<CornerKey>([
    ...(Object.keys(before.corners) as CornerKey[]),
    ...(Object.keys(after.corners) as CornerKey[]),
  ]);

  for (const cornerKey of corners) {
    const beforePoints = before.corners[cornerKey]?.points ?? {};
    const afterPoints = after.corners[cornerKey]?.points ?? {};
    const keys = new Set<CornerPointKey>([
      ...(Object.keys(beforePoints) as CornerPointKey[]),
      ...(Object.keys(afterPoints) as CornerPointKey[]),
    ]);

    for (const key of keys) {
      const a = beforePoints[key]?.value;
      const b = afterPoints[key]?.value;
      if (a === undefined || b === undefined) {
        largest = Number.POSITIVE_INFINITY;
        continue;
      }
      for (let axis = 0; axis < 3; axis += 1) {
        largest = Math.max(largest, Math.abs((a[axis] ?? 0) - (b[axis] ?? 0)));
      }
    }
  }

  return largest;
}

function axleSnapshot(
  model: CarModelDocument,
  axle: 'front' | 'rear',
  cornerKey: CornerKey,
  roll: ReturnType<typeof solveRollStiffness> | null,
  antiDivePercent: number | null,
  antiSquatPercent: number | null,
): AxleSnapshot {
  const ratesResult = buildAxleRates(model, axle);
  const rates = ratesResult.ok ? ratesResult.value : null;
  const dampingInput =
    rates === null ? null : buildDampingRatioInput(model, axle, rates.criticalDamping);
  const damping = dampingInput === null ? null : solveDampingRatio(dampingInput);
  const axleRoll = roll === null ? null : roll[axle];
  const arbWheelRate = definedValue(axleRoll?.antiRollBar.wheelRate);
  const arbMotionRatio = axleRoll?.working.antiRollBar.motionRatio ?? null;
  const rollStiffness = definedValue(axleRoll?.rollStiffness);
  const share =
    axle === 'front'
      ? definedValue(roll?.frontShare)
      : roll === null
        ? null
        : 1 - (definedValue(roll.frontShare) ?? 0);
  const axleDocument = model.axles[axle];

  return {
    springRate_Nmm: axleDocument?.springRate?.value ?? null,
    damperCoefficient_NsPerM: dampingInput?.wheelCoefficient_NsPerM.value ?? null,
    arbType: axleDocument?.arb?.type ?? 'none',
    arbWheelRate_Nmm: arbWheelRate === null ? null : arbWheelRate / 1000,
    arbMotionRatio,
    rollStiffness_NmPerDeg:
      rollStiffness === null ? null : rollStiffness * (Math.PI / 180),
    rollShare: roll === null || definedValue(roll.frontShare) === null ? null : share,
    rollCentreHeight_mm: rollCentreHeight_mm(model, cornerKey),
    damperMotionRatio: definedValue(rates?.installationRatio),
    dampingRatio: definedValue(damping?.dampingRatio),
    antiDivePercent,
    antiSquatPercent,
    toe_deg: toe_deg(model, cornerKey),
    toeGain_degPerMm: toeGain_degPerMm(model, cornerKey),
    caster_deg: axle === 'front' ? caster_deg(model) : null,
  };
}

export function buildSnapshot(model: CarModelDocument): ModelSnapshot {
  const gravity = gravitiesToMetresPerSecondSquared(GRAVITY_G);
  const rollInput = buildRollStiffnessInput(model);
  const roll = rollInput.ok ? solveRollStiffness(rollInput.value) : null;
  const transferInput = buildLoadTransferInput(model, gravity);
  const transfer = transferInput.ok ? solveLoadTransfer(transferInput.value) : null;
  const brakingInput = buildAntiDiveInput(model, -gravity);
  const braking = brakingInput.ok ? solveAntiDive(brakingInput.value) : null;
  const accelerationInput = buildAntiDiveInput(model, gravity);
  const acceleration =
    accelerationInput.ok ? solveAntiDive(accelerationInput.value) : null;

  return {
    front: axleSnapshot(
      model,
      'front',
      'LF',
      roll,
      definedValue(braking?.front.percent),
      definedValue(acceleration?.front.percent),
    ),
    rear: axleSnapshot(
      model,
      'rear',
      'LR',
      roll,
      definedValue(braking?.rear.percent),
      definedValue(acceleration?.rear.percent),
    ),
    rideHeight_mm: model.referenceRideHeight?.value ?? null,
    cgHeight_mm:
      transfer === null || transfer.working.cgHeight_m === null
        ? null
        : transfer.working.cgHeight_m * 1000,
    rollMomentArm_mm:
      transfer === null || transfer.working.rollMomentArm_m === null
        ? null
        : transfer.working.rollMomentArm_m * 1000,
    rollSensitivity_degPerG:
      transfer === null ? null : definedValue(transfer.rollSensitivity_degPerG),
    rollSensitivityBand:
      transfer === null || transfer.rollSensitivity_degPerG.kind !== 'defined'
        ? null
        : transfer.rollSensitivity_degPerG.band,
    frontShare: roll === null ? null : definedValue(roll.frontShare),
  };
}

function axleDeltas(before: AxleSnapshot, after: AxleSnapshot): AxleDeltas {
  return {
    springRate_Nmm: subtract(before.springRate_Nmm, after.springRate_Nmm),
    damperCoefficient_NsPerM: subtract(
      before.damperCoefficient_NsPerM,
      after.damperCoefficient_NsPerM,
    ),
    arbWheelRate_Nmm: subtract(before.arbWheelRate_Nmm, after.arbWheelRate_Nmm),
    arbMotionRatio: subtract(before.arbMotionRatio, after.arbMotionRatio),
    rollStiffness_NmPerDeg: subtract(
      before.rollStiffness_NmPerDeg,
      after.rollStiffness_NmPerDeg,
    ),
    rollShare_pp: subtract(before.rollShare, after.rollShare) * 100,
    rollCentreHeight_mm: subtract(
      before.rollCentreHeight_mm,
      after.rollCentreHeight_mm,
    ),
    damperMotionRatio: subtract(
      before.damperMotionRatio,
      after.damperMotionRatio,
    ),
    antiDivePercent: subtract(before.antiDivePercent, after.antiDivePercent),
    antiSquatPercent: subtract(before.antiSquatPercent, after.antiSquatPercent),
    toe_deg: subtract(before.toe_deg, after.toe_deg),
    toeGain_degPerMm: subtract(before.toeGain_degPerMm, after.toeGain_degPerMm),
    caster_deg: subtract(before.caster_deg, after.caster_deg),
  };
}

function buildDeltas(
  before: ModelSnapshot,
  after: ModelSnapshot,
  hardpointDelta: number,
  arbTypeChanged: Readonly<Record<'front' | 'rear', boolean>>,
): InterpreterDeltas {
  return {
    before,
    after,
    front: axleDeltas(before.front, after.front),
    rear: axleDeltas(before.rear, after.rear),
    rideHeight_mm: subtract(before.rideHeight_mm, after.rideHeight_mm),
    cgHeight_mm: subtract(before.cgHeight_mm, after.cgHeight_mm),
    rollMomentArm_mm: subtract(before.rollMomentArm_mm, after.rollMomentArm_mm),
    rollSensitivity_degPerG: subtract(
      before.rollSensitivity_degPerG,
      after.rollSensitivity_degPerG,
    ),
    hardpointDeltaMm: hardpointDelta,
    arbTypeChanged,
  };
}

function rideHeightMoved(d: InterpreterDeltas): boolean {
  return moved(d.rideHeight_mm, DEAD_BANDS.rideHeight_mm);
}

function hardpointMoved(d: InterpreterDeltas): boolean {
  return d.hardpointDeltaMm > DEAD_BANDS.hardpoint_mm;
}

const RULES: readonly Rule[] = [
  {
    id: 'front-spring',
    when: (d) => moved(d.front.springRate_Nmm, DEAD_BANDS.springRate_Nmm),
    phases: ['mid'],
    mechanism: 'front share of roll resistance',
    says: (d) =>
      `front spring rate ${Math.abs(d.front.springRate_Nmm).toFixed(2)} N/mm ${
        d.front.springRate_Nmm > 0 ? 'stiffer' : 'softer'
      } (${pair(d.before.front.springRate_Nmm, d.after.front.springRate_Nmm)} N/mm)`,
    effect: (d) =>
      `the front carries ${d.front.springRate_Nmm > 0 ? 'more' : 'less'} of the roll resistance; front roll stiffness ${pair(
        d.before.front.rollStiffness_NmPerDeg,
        d.after.front.rollStiffness_NmPerDeg,
      )} N·m/deg, front share ${percentPair(
        d.before.front.rollShare,
        d.after.front.rollShare,
      )}`,
    confidence: 'reliable',
  },
  {
    id: 'rear-spring',
    when: (d) => moved(d.rear.springRate_Nmm, DEAD_BANDS.springRate_Nmm),
    phases: ['mid'],
    mechanism: 'rear share of roll resistance',
    says: (d) =>
      `rear spring rate ${Math.abs(d.rear.springRate_Nmm).toFixed(2)} N/mm ${
        d.rear.springRate_Nmm > 0 ? 'stiffer' : 'softer'
      } (${pair(d.before.rear.springRate_Nmm, d.after.rear.springRate_Nmm)} N/mm)`,
    effect: (d) =>
      `the rear carries ${d.rear.springRate_Nmm > 0 ? 'more' : 'less'} of the roll resistance; rear roll stiffness ${pair(
        d.before.rear.rollStiffness_NmPerDeg,
        d.after.rear.rollStiffness_NmPerDeg,
      )} N·m/deg, rear share ${percentPair(
        d.before.rear.rollShare,
        d.after.rear.rollShare,
      )}`,
    confidence: 'reliable',
  },
  {
    id: 'front-arb',
    when: (d) =>
      moved(d.front.arbWheelRate_Nmm, DEAD_BANDS.arbWheelRate_Nmm) ||
      d.arbTypeChanged.front,
    phases: ['mid'],
    mechanism: 'front share of roll resistance',
    says: (d) =>
      `front ARB wheel rate ${Math.abs(d.front.arbWheelRate_Nmm).toFixed(3)} N/mm ${
        d.front.arbWheelRate_Nmm > 0 ? 'higher' : 'lower'
      } (${pair(d.before.front.arbWheelRate_Nmm, d.after.front.arbWheelRate_Nmm, 3)} N/mm)`,
    effect: (d) =>
      `the front carries ${d.front.arbWheelRate_Nmm > 0 ? 'more' : 'less'} of the roll resistance; front roll stiffness ${pair(
        d.before.front.rollStiffness_NmPerDeg,
        d.after.front.rollStiffness_NmPerDeg,
      )} N·m/deg, front share ${percentPair(
        d.before.front.rollShare,
        d.after.front.rollShare,
      )}`,
    confidence: 'reliable',
  },
  {
    id: 'front-arb-motion-ratio',
    when: (d) =>
      !rideHeightMoved(d) && moved(d.front.arbMotionRatio, DEAD_BANDS.arbMotionRatio),
    phases: ['mid'],
    mechanism: 'front ARB motion ratio',
    says: (d) =>
      `front ARB motion ratio ${Math.abs(d.front.arbMotionRatio).toFixed(3)} ${
        d.front.arbMotionRatio > 0 ? 'rises' : 'falls'
      } (${pair(d.before.front.arbMotionRatio, d.after.front.arbMotionRatio, 3)})`,
    effect: (d) =>
      `the bar's wheel rate ${d.front.arbMotionRatio > 0 ? 'rises' : 'falls'} with the square of the ratio; front share ${percentPair(
        d.before.front.rollShare,
        d.after.front.rollShare,
      )}`,
    confidence: 'direction',
  },
  {
    id: 'rear-arb',
    when: (d) =>
      moved(d.rear.arbWheelRate_Nmm, DEAD_BANDS.arbWheelRate_Nmm) ||
      d.arbTypeChanged.rear,
    phases: ['mid'],
    mechanism: 'rear share of roll resistance',
    says: (d) =>
      `rear ARB wheel rate ${Math.abs(d.rear.arbWheelRate_Nmm).toFixed(3)} N/mm ${
        d.rear.arbWheelRate_Nmm > 0 ? 'higher' : 'lower'
      } (${pair(d.before.rear.arbWheelRate_Nmm, d.after.rear.arbWheelRate_Nmm, 3)} N/mm)`,
    effect: (d) =>
      `the rear carries ${d.rear.arbWheelRate_Nmm > 0 ? 'more' : 'less'} of the roll resistance; rear roll stiffness ${pair(
        d.before.rear.rollStiffness_NmPerDeg,
        d.after.rear.rollStiffness_NmPerDeg,
      )} N·m/deg, rear share ${percentPair(
        d.before.rear.rollShare,
        d.after.rear.rollShare,
      )}`,
    confidence: 'reliable',
  },
  {
    id: 'rear-arb-motion-ratio',
    when: (d) =>
      !rideHeightMoved(d) && moved(d.rear.arbMotionRatio, DEAD_BANDS.arbMotionRatio),
    phases: ['mid'],
    mechanism: 'rear ARB motion ratio',
    says: (d) =>
      `rear ARB motion ratio ${Math.abs(d.rear.arbMotionRatio).toFixed(3)} ${
        d.rear.arbMotionRatio > 0 ? 'rises' : 'falls'
      } (${pair(d.before.rear.arbMotionRatio, d.after.rear.arbMotionRatio, 3)})`,
    effect: (d) =>
      `the bar's wheel rate ${d.rear.arbMotionRatio > 0 ? 'rises' : 'falls'} with the square of the ratio; rear share ${percentPair(
        d.before.rear.rollShare,
        d.after.rear.rollShare,
      )}`,
    confidence: 'direction',
  },
  {
    id: 'front-roll-centre',
    when: (d) =>
      !rideHeightMoved(d) &&
      moved(d.front.rollCentreHeight_mm, DEAD_BANDS.rollCentreHeight_mm),
    phases: ['mid'],
    mechanism: 'front roll-centre height and the roll-moment arm',
    says: (d) =>
      `front roll-centre height ${Math.abs(d.front.rollCentreHeight_mm).toFixed(2)} mm ${
        d.front.rollCentreHeight_mm > 0 ? 'raised' : 'lowered'
      } (${pair(d.before.front.rollCentreHeight_mm, d.after.front.rollCentreHeight_mm)} mm)`,
    effect: (d) =>
      `the roll-moment arm changes and the front takes a different share of the roll moment; front share ${percentPair(
        d.before.front.rollShare,
        d.after.front.rollShare,
      )}`,
    confidence: 'reliable',
  },
  {
    id: 'rear-roll-centre',
    when: (d) =>
      !rideHeightMoved(d) &&
      moved(d.rear.rollCentreHeight_mm, DEAD_BANDS.rollCentreHeight_mm),
    phases: ['mid'],
    mechanism: 'rear roll-centre height and the roll-moment arm',
    says: (d) =>
      `rear roll-centre height ${Math.abs(d.rear.rollCentreHeight_mm).toFixed(2)} mm ${
        d.rear.rollCentreHeight_mm > 0 ? 'raised' : 'lowered'
      } (${pair(d.before.rear.rollCentreHeight_mm, d.after.rear.rollCentreHeight_mm)} mm)`,
    effect: (d) =>
      `the roll-moment arm changes and the rear takes a different share of the roll moment; rear share ${percentPair(
        d.before.rear.rollShare,
        d.after.rear.rollShare,
      )}`,
    confidence: 'reliable',
  },
  {
    id: 'front-damper-coefficient',
    when: (d) =>
      moved(d.front.damperCoefficient_NsPerM, DEAD_BANDS.damperCoefficient_NsPerM),
    phases: ['entry', 'exit'],
    mechanism: 'rate at which load transfer arrives',
    says: (d) =>
      `front damper coefficient ${Math.abs(d.front.damperCoefficient_NsPerM).toFixed(
        1,
      )} N·s/m ${d.front.damperCoefficient_NsPerM > 0 ? 'higher' : 'lower'} (${pair(
        d.before.front.damperCoefficient_NsPerM,
        d.after.front.damperCoefficient_NsPerM,
        1,
      )} N·s/m)`,
    effect:
      'the rate at which load transfer arrives changes at entry and exit; the amount of load transfer is unchanged',
    confidence: 'direction',
  },
  {
    id: 'rear-damper-coefficient',
    when: (d) =>
      moved(d.rear.damperCoefficient_NsPerM, DEAD_BANDS.damperCoefficient_NsPerM),
    phases: ['entry', 'exit'],
    mechanism: 'rate at which load transfer arrives',
    says: (d) =>
      `rear damper coefficient ${Math.abs(d.rear.damperCoefficient_NsPerM).toFixed(
        1,
      )} N·s/m ${d.rear.damperCoefficient_NsPerM > 0 ? 'higher' : 'lower'} (${pair(
        d.before.rear.damperCoefficient_NsPerM,
        d.after.rear.damperCoefficient_NsPerM,
        1,
      )} N·s/m)`,
    effect:
      'the rate at which load transfer arrives changes at entry and exit; the amount of load transfer is unchanged',
    confidence: 'direction',
  },
  {
    id: 'front-damper-motion-ratio',
    when: (d) =>
      !rideHeightMoved(d) &&
      moved(d.front.damperMotionRatio, DEAD_BANDS.damperMotionRatio),
    phases: ['mid'],
    mechanism: 'front wheel rate and damping ratio',
    says: (d) =>
      `front damper motion ratio ${Math.abs(d.front.damperMotionRatio).toFixed(3)} ${
        d.front.damperMotionRatio > 0 ? 'rises' : 'falls'
      } (${pair(d.before.front.damperMotionRatio, d.after.front.damperMotionRatio, 3)})`,
    effect: (d) =>
      `wheel rate ${d.front.damperMotionRatio > 0 ? 'rises' : 'falls'} with the square of the ratio; the damping ratio ${
        d.front.damperMotionRatio > 0 ? 'falls' : 'rises'
      } at the same coefficient`,
    confidence: 'direction',
  },
  {
    id: 'rear-damper-motion-ratio',
    when: (d) =>
      !rideHeightMoved(d) &&
      moved(d.rear.damperMotionRatio, DEAD_BANDS.damperMotionRatio),
    phases: ['mid'],
    mechanism: 'rear wheel rate and damping ratio',
    says: (d) =>
      `rear damper motion ratio ${Math.abs(d.rear.damperMotionRatio).toFixed(3)} ${
        d.rear.damperMotionRatio > 0 ? 'rises' : 'falls'
      } (${pair(d.before.rear.damperMotionRatio, d.after.rear.damperMotionRatio, 3)})`,
    effect: (d) =>
      `wheel rate ${d.rear.damperMotionRatio > 0 ? 'rises' : 'falls'} with the square of the ratio; the damping ratio ${
        d.rear.damperMotionRatio > 0 ? 'falls' : 'rises'
      } at the same coefficient`,
    confidence: 'direction',
  },
  {
    id: 'front-anti-dive',
    when: (d) =>
      !rideHeightMoved(d) &&
      hardpointMoved(d) &&
      moved(d.front.antiDivePercent, DEAD_BANDS.antiDivePercent),
    phases: ['entry'],
    mechanism: 'front transfer path through the links',
    says: (d) =>
      `front anti-dive ${Math.abs(d.front.antiDivePercent).toFixed(1)} percentage points ${
        d.front.antiDivePercent > 0 ? 'rises' : 'falls'
      } (${pair(
        d.before.front.antiDivePercent,
        d.after.front.antiDivePercent,
        1,
      )} %)`,
    effect: (d) =>
      d.front.antiDivePercent > 0
        ? 'more of the longitudinal transfer is carried by the links, so the platform stays flatter and the front gains less camber from dive'
        : 'less of the longitudinal transfer is carried by the links, so the platform moves more and the front gains more camber from dive',
    confidence: 'direction',
  },
  {
    id: 'rear-anti-squat',
    when: (d) =>
      !rideHeightMoved(d) &&
      hardpointMoved(d) &&
      moved(d.rear.antiSquatPercent, DEAD_BANDS.antiDivePercent),
    phases: ['exit'],
    mechanism: 'rear transfer path through the links',
    says: (d) =>
      `rear anti-squat ${Math.abs(d.rear.antiSquatPercent).toFixed(1)} percentage points ${
        d.rear.antiSquatPercent > 0 ? 'rises' : 'falls'
      } (${pair(
        d.before.rear.antiSquatPercent,
        d.after.rear.antiSquatPercent,
        1,
      )} %)`,
    effect: (d) =>
      d.rear.antiSquatPercent > 0
        ? 'more of the longitudinal transfer is carried by the links, so the rear platform stays flatter under power'
        : 'less of the longitudinal transfer is carried by the links, so the rear platform moves more under power',
    confidence: 'direction',
  },
  {
    id: 'caster',
    when: (d) =>
      !rideHeightMoved(d) &&
      hardpointMoved(d) &&
      moved(d.front.caster_deg, DEAD_BANDS.caster_deg),
    phases: ['entry', 'mid'],
    mechanism: 'steer-axis camber gain and steering weight',
    says: (d) =>
      `caster ${Math.abs(d.front.caster_deg).toFixed(2)} ° ${
        d.front.caster_deg > 0 ? 'rises' : 'falls'
      } (${pair(d.before.front.caster_deg, d.after.front.caster_deg)} °)`,
    effect: (d) =>
      d.front.caster_deg > 0
        ? 'the steering axis gains camber as lock goes on and steering weight rises'
        : 'the steering axis gains less camber as lock goes on and steering weight falls',
    confidence: 'direction',
  },
  {
    id: 'front-toe',
    when: (d) => moved(d.front.toe_deg, DEAD_BANDS.toe_deg),
    phases: ['entry', 'exit'],
    mechanism: 'front standing slip angle',
    says: (d) =>
      `front toe ${Math.abs(d.front.toe_deg).toFixed(2)} ° ${
        d.front.toe_deg > 0 ? 'toward toe-in' : 'toward toe-out'
      } (${pair(d.before.front.toe_deg, d.after.front.toe_deg)} °)`,
    effect: (d, phase) => frontToeEffect(d.front.toe_deg, phase),
    confidence: 'direction',
  },
  {
    id: 'rear-toe',
    when: (d) => moved(d.rear.toe_deg, DEAD_BANDS.toe_deg),
    phases: ['entry', 'mid', 'exit'],
    mechanism: 'rear standing slip angle',
    says: (d) =>
      `rear toe ${Math.abs(d.rear.toe_deg).toFixed(2)} ° ${
        d.rear.toe_deg > 0 ? 'toward toe-in' : 'toward toe-out'
      } (${pair(d.before.rear.toe_deg, d.after.rear.toe_deg)} °)`,
    effect: (d) =>
      d.rear.toe_deg > 0
        ? 'the rear axle stands at a larger slip angle; if it gains toe in compression, the slip grows under load'
        : 'the rear axle stands at a smaller slip angle; if it loses toe in compression, the slip falls under load',
    confidence: 'direction',
  },
  {
    id: 'rear-toe-gain',
    when: (d) =>
      !rideHeightMoved(d) &&
      hardpointMoved(d) &&
      moved(d.rear.toeGain_degPerMm, DEAD_BANDS.toeGain_degPerMm),
    phases: ['exit'],
    mechanism: 'rear toe gain in compression',
    says: (d) =>
      `rear toe gain ${Math.abs(d.rear.toeGain_degPerMm).toFixed(4)} °/mm ${
        d.rear.toeGain_degPerMm > 0 ? 'more toe-in' : 'more toe-out'
      } in compression (${pair(
        d.before.rear.toeGain_degPerMm,
        d.after.rear.toeGain_degPerMm,
        4,
      )} °/mm)`,
    effect: (d) =>
      d.rear.toeGain_degPerMm > 0
        ? 'the rear gains toe under compression, adding rear slip angle under load'
        : 'the rear loses toe under compression, reducing rear slip angle under load',
    confidence: 'direction',
  },
  {
    id: 'ride-height',
    when: (d) => rideHeightMoved(d),
    phases: ['entry', 'mid', 'exit'],
    mechanism: 'CG height and both roll-centre heights, hence the roll-moment arm',
    says: (d) =>
      `ride height ${Math.abs(d.rideHeight_mm).toFixed(1)} mm ${
        d.rideHeight_mm > 0 ? 'raised' : 'lowered'
      } (${pair(d.before.rideHeight_mm, d.after.rideHeight_mm, 1)} mm)`,
    effect: (d) =>
      `CG height and both roll-centre heights ${
        d.rideHeight_mm > 0 ? 'rise' : 'fall'
      } together; the roll-moment arm ${
        d.rollMomentArm_mm > 0 ? 'grows' : 'shrinks'
      } and roll sensitivity ${d.rollSensitivity_degPerG > 0 ? 'rises' : 'falls'}`,
    confidence: 'reliable',
  },
];

function frontToeEffect(delta: number, phase: Phase): string {
  if (delta < 0) {
    return phase === 'entry'
      ? 'the front axle starts the corner at a larger slip angle; turn-in gains front slip angle'
      : 'the same standing slip angle adds front slip angle at exit, which biases the car toward understeer';
  }
  return phase === 'entry'
    ? 'the front axle starts the corner at a smaller slip angle; turn-in gains less front slip angle'
    : 'the front axle carries less standing slip angle at exit, which biases the car toward oversteer';
}

function renderEffect(
  rule: Rule,
  d: InterpreterDeltas,
  phase: Phase,
): string {
  return typeof rule.effect === 'string' ? rule.effect : rule.effect(d, phase);
}

function modelChanged(d: InterpreterDeltas): boolean {
  return (
    d.hardpointDeltaMm > 0 ||
    d.arbTypeChanged.front ||
    d.arbTypeChanged.rear ||
    moved(d.rideHeight_mm, 0) ||
    moved(d.cgHeight_mm, 0) ||
    moved(d.front.springRate_Nmm, 0) ||
    moved(d.rear.springRate_Nmm, 0) ||
    moved(d.front.damperCoefficient_NsPerM, 0) ||
    moved(d.rear.damperCoefficient_NsPerM, 0) ||
    moved(d.front.toe_deg, 0) ||
    moved(d.rear.toe_deg, 0)
  );
}

/**
 * Compare the loaded model against the current edited state. Every line is
 * generated from the solved before/after values; a rule that cannot read a
 * quantity is omitted rather than softened. The interpreter has no physics
 * path of its own: it only reads the data build and physics solve results.
 */
export function interpret(
  baseline: CarModelDocument,
  current: CarModelDocument,
): Interpretation {
  const before = buildSnapshot(baseline);
  const after = buildSnapshot(current);
  const arbTypeChanged = {
    front: before.front.arbType !== after.front.arbType,
    rear: before.rear.arbType !== after.rear.arbType,
  };
  const deltas = buildDeltas(
    before,
    after,
    hardpointDeltaMm(baseline, current),
    arbTypeChanged,
  );

  const lines: InterpreterLine[] = [];
  for (const rule of RULES) {
    if (!rule.when(deltas)) continue;
    for (const phase of rule.phases) {
      lines.push({
        ruleId: rule.id,
        phase,
        mechanism: rule.mechanism,
        says: rule.says(deltas),
        effect: renderEffect(rule, deltas, phase),
        confidence: rule.confidence,
      });
    }
  }

  const changed = modelChanged(deltas);
  const headline: Headline = {
    value: after.rollSensitivity_degPerG,
    delta:
      before.rollSensitivity_degPerG === null || after.rollSensitivity_degPerG === null
        ? null
        : after.rollSensitivity_degPerG - before.rollSensitivity_degPerG,
    band: after.rollSensitivityBand ?? before.rollSensitivityBand,
  };

  return {
    lines,
    emptyMessage: changed
      ? 'The model changed, but no rule moved beyond its dead-band.'
      : 'The model is unchanged from the loaded sheet; the interpreter has nothing to compare.',
    disclaimer:
      "The interpreter reports mechanisms and directions from the model's own numbers; it does not predict lap time or rank one setup against another.",
    gripFootnote: 'Grip is inferred; this reading is directional.',
    headline,
    before,
    after,
    deltas,
  };
}
