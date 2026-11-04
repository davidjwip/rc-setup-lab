import type { Sourced } from '../frontView/types.js';
import {
  defined,
  undefinedResult,
  type Band,
  type Defined,
  type DefinedOptions,
  type Flag,
  type Solved,
  type Tier,
  type UndefinedReason,
} from '../result/solved.js';
import type {
  AxleTransfer,
  CgComponentInput,
  CgHeightResult,
  CgInferenceInput,
  CgRoute,
  LoadTransferInput,
  LoadTransferResult,
  LoadTransferWorking,
  WheelLoad,
} from './types.js';

// G06.10 (the flexible-chassis split) is out of scope for this slice: module 10
// does not exist yet. These equations are the rigid-chassis case only, and no
// `k_ch` is accepted or faked. TODO(spec §6.8): add the 2×2 chassis solve when
// module 10 lands; G10.4 must reproduce this module's answer as k_ch → ∞.

/** 06 §2: the physical constant, stated so a reviewer can substitute another latitude. */
export const GRAVITY_MPS2 = 9.81;

/** D-18: the stated default, never a measurement. 28.0 mm. */
export const STATED_CG_HEIGHT_M = 0.028;

/** D-18 / 06 §6.7: the stated 24–32 mm plausible range around the 28.0 mm default. */
export const STATED_CG_HEIGHT_BAND_M: Band = { low: 0.024, high: 0.032 };

/**
 * D-18 / 06 §6.7: a change of CG height over the plausible 24–32 mm range moves
 * the whole-car transfer by ±14.3 %, the roll angle by ±22.2 % and the balance
 * by ±0.13 percentage points. These are the bands attached to the values that
 * consume `h`; they are not invented constants.
 */
export const CG_TLLT_BAND_RELATIVE = 0.143;
export const CG_ROLL_ANGLE_BAND_RELATIVE = 0.222;
export const CG_BALANCE_BAND_FRACTION = 0.0013;
export const PER_WHEEL_BAND_RELATIVE = 0.143;

function isFirmSource(confidence: Sourced<unknown>['confidence']): boolean {
  return confidence === 'measured' || confidence === 'manufacturer' || confidence === 'derived';
}

function tierOf(sources: readonly Sourced<unknown>[]): Tier {
  return sources.every((source) => isFirmSource(source.confidence)) ? 'firm' : 'inferred';
}

function provenanceOf(sources: readonly Sourced<unknown>[]): Set<string> {
  return new Set(sources.map((source) => source.ref));
}

function flagsOf(sources: readonly Sourced<unknown>[]): Set<Flag> {
  const flags = new Set<Flag>();
  if (sources.some((source) => source.confidence === 'assumed')) flags.add('assumedInput');
  if (
    sources.some(
      (source) => source.confidence === 'estimated' || source.confidence === 'library',
    )
  ) {
    flags.add('lowConfidence');
  }
  return flags;
}

function optionsFromSources(sources: readonly Sourced<unknown>[]): DefinedOptions {
  return {
    tier: tierOf(sources),
    provenance: provenanceOf(sources),
    flags: flagsOf(sources),
  };
}

function optionsFromParts(
  parts: readonly Defined<number>[],
  sources: readonly Sourced<unknown>[],
): DefinedOptions {
  const provenance = new Set<string>();
  const flags = new Set<Flag>();
  let tier: Tier = sources.every((source) => isFirmSource(source.confidence))
    ? 'firm'
    : 'inferred';

  for (const part of parts) {
    if (part.tier !== 'firm') tier = 'inferred';
    part.provenance.forEach((ref) => provenance.add(ref));
    part.flags.forEach((flag) => flags.add(flag));
  }
  for (const source of sources) {
    provenance.add(source.ref);
    flagsOf([source]).forEach((flag) => flags.add(flag));
  }

  return { tier, provenance, flags };
}

/**
 * Every output that consumes `h` is `inferred` and carries `cgInferred`
 * (D-14/D-18). The band, where the spec gives one, is absolute in the output's
 * own SI unit.
 */
function withCg(options: DefinedOptions, band: Band | null = null): DefinedOptions {
  const flags = new Set<Flag>();
  if (options.flags !== undefined) {
    for (const flag of options.flags) flags.add(flag);
  }
  flags.add('cgInferred');
  return {
    tier: 'inferred',
    band: band ?? options.band ?? null,
    ...(options.provenance === undefined ? {} : { provenance: options.provenance }),
    ...(options.basis === undefined ? {} : { basis: options.basis }),
    flags,
  };
}

function cgOptions(
  parts: readonly Defined<number>[],
  sources: readonly Sourced<unknown>[],
  band: Band | null = null,
): DefinedOptions {
  return withCg(optionsFromParts(parts, sources), band);
}

function relativeBand(value: number, relative: number): Band {
  return { low: value * (1 - relative), high: value * (1 + relative) };
}

function absoluteBand(value: number, halfWidth: number): Band {
  return { low: value - halfWidth, high: value + halfWidth };
}

function finite(value: number): boolean {
  return Number.isFinite(value);
}

function addDefined(
  values: readonly Solved<number>[],
  makeOptions: (parts: readonly Defined<number>[]) => DefinedOptions,
): Solved<number> {
  const parts: Defined<number>[] = [];
  let total = 0;
  for (const value of values) {
    if (value.kind !== 'defined') return value;
    parts.push(value);
    total += value.value;
  }
  if (!finite(total)) return undefinedResult('outOfDomain');
  return defined(total, makeOptions(parts));
}

/**
 * 01 §4.5 / D-26 / D-18: resolve the whole-car CG height. Priority:
 *
 * 1. `raise_and_weigh` — the measured route (D-26), when its result is supplied;
 * 2. the component-mass first moment `(Σ m_i·z_i + m_u·h_u) / (Σ m_i + m_u)`;
 * 3. the stated 28.0 mm default (D-18), carrying its 24–32 mm band.
 *
 * The measured route is the only one that can be `firm`; the other two stay
 * `inferred` and carry `cgInferred`.
 */
export function inferCgHeight(input: CgInferenceInput): CgHeightResult {
  const total = input.totalMass_kg;
  const unsprungMass = input.unsprungMass_kg;
  const unsprungHeight = input.unsprungHeight_m;
  const components = input.components;
  const measured = input.measuredHeight_m ?? null;
  const hasComponents = components !== null && components.length > 0;
  const route: CgRoute =
    measured !== null
      ? 'raise_and_weigh'
      : hasComponents
        ? 'component_mass_moment'
        : 'stated_default';
  const baseSources: readonly Sourced<unknown>[] = [total, unsprungMass, unsprungHeight];

  if (
    !finite(total.value) ||
    total.value <= 0 ||
    !finite(unsprungMass.value) ||
    unsprungMass.value < 0 ||
    unsprungMass.value >= total.value ||
    !finite(unsprungHeight.value) ||
    unsprungHeight.value < 0
  ) {
    const refs = baseSources.map((source) => source.ref);
    return { height_m: undefinedResult('outOfDomain', refs), route };
  }

  if (measured !== null) {
    if (!finite(measured.value) || measured.value <= 0) {
      return { height_m: undefinedResult('outOfDomain', [measured.ref]), route };
    }
    return {
      height_m: defined(measured.value, {
        // The measurement needs the total mass; it does not need the unsprung
        // masses, which are subtracted later for the sprung CG.
        ...optionsFromSources([total, measured]),
        band: input.measuredBand_m ?? null,
      }),
      route,
    };
  }

  if (!hasComponents) {
    const defaultHeight = input.defaultHeight_m;
    const height = defaultHeight?.value ?? STATED_CG_HEIGHT_M;
    if (!finite(height) || height <= 0) {
      const refs =
        defaultHeight === undefined || defaultHeight === null
          ? baseSources.map((source) => source.ref)
          : [defaultHeight.ref];
      return { height_m: undefinedResult('outOfDomain', refs), route };
    }
    const sources =
      defaultHeight === undefined || defaultHeight === null
        ? baseSources
        : [...baseSources, defaultHeight];
    const statedHalfWidth =
      (STATED_CG_HEIGHT_BAND_M.high - STATED_CG_HEIGHT_BAND_M.low) / 2;
    const band =
      defaultHeight === undefined || defaultHeight === null
        ? STATED_CG_HEIGHT_BAND_M
        : absoluteBand(height, statedHalfWidth);
    return {
      height_m: defined(height, withCg(optionsFromSources(sources), band)),
      route,
    };
  }

  let componentMass = 0;
  let firstMoment = 0;
  const sources: Sourced<unknown>[] = [...baseSources];
  for (const component of components) {
    if (
      !finite(component.mass_kg.value) ||
      component.mass_kg.value < 0 ||
      !finite(component.height_m.value)
    ) {
      return {
        height_m: undefinedResult('outOfDomain', [
          component.mass_kg.ref,
          component.height_m.ref,
        ]),
        route,
      };
    }
    componentMass += component.mass_kg.value;
    firstMoment += component.mass_kg.value * component.height_m.value;
    sources.push(component.mass_kg, component.height_m);
  }

  if (!(componentMass > 0)) {
    return {
      height_m: undefinedResult('outOfDomain', components.map((c) => c.mass_kg.ref)),
      route,
    };
  }

  const denominator = componentMass + unsprungMass.value;
  const height =
    (firstMoment + unsprungMass.value * unsprungHeight.value) / denominator;
  if (!finite(height) || height <= 0) {
    return {
      height_m: undefinedResult('outOfDomain', sources.map((source) => source.ref)),
      route,
    };
  }

  return { height_m: defined(height, withCg(optionsFromSources(sources))), route };
}

function cgComponentsOf(input: LoadTransferInput): readonly CgComponentInput[] | null {
  return input.cgComponents === null || input.cgComponents.length === 0
    ? null
    : input.cgComponents;
}

function refusedWheelLoad(failure: Solved<number>): WheelLoad {
  return {
    outer: failure,
    inner: failure,
    outerShareOfStatic: failure,
    innerShareOfStatic: failure,
  };
}

function refusedAxle(failure: Solved<number>): AxleTransfer {
  return { elastic: failure, geometric: failure, unsprung: failure, total: failure };
}

function refusedResult(
  reason: UndefinedReason,
  refs: readonly string[],
  working: LoadTransferWorking,
  staticFront: Solved<number>,
  staticRear: Solved<number>,
): LoadTransferResult {
  const failure = undefinedResult(reason, refs);
  return {
    cgHeight: failure,
    cgRoute: working.cgRoute,
    cgHeightBand: null,
    staticFrontCorner: staticFront,
    staticRearCorner: staticRear,
    totalLateralLoadTransfer: failure,
    rollAxisHeight: failure,
    rollMomentArm: failure,
    rollMoment: failure,
    rollAngle: failure,
    rollSensitivity_degPerG: failure,
    front: refusedAxle(failure),
    rear: refusedAxle(failure),
    balance: failure,
    frontWheel: refusedWheelLoad(failure),
    rearWheel: refusedWheelLoad(failure),
    residual: failure,
    working,
  };
}

function wheelLoad(
  staticCorner: Solved<number>,
  transfer: Solved<number>,
): WheelLoad {
  if (staticCorner.kind !== 'defined') return refusedWheelLoad(staticCorner);
  if (transfer.kind !== 'defined') return refusedWheelLoad(transfer);

  const half = transfer.value / 2;
  const outer = staticCorner.value + half;
  const inner = staticCorner.value - half;

  if (staticCorner.value <= 0) {
    const failure = undefinedResult('outOfDomain', [
      ...staticCorner.provenance,
      ...transfer.provenance,
    ]);
    return refusedWheelLoad(failure);
  }

  const parts = [staticCorner, transfer];
  const outerOptions = cgOptions(parts, [], relativeBand(outer, PER_WHEEL_BAND_RELATIVE));
  const innerOptions = cgOptions(parts, [], relativeBand(inner, PER_WHEEL_BAND_RELATIVE));
  return {
    outer: defined(outer, outerOptions),
    inner: defined(inner, innerOptions),
    outerShareOfStatic: defined(outer / staticCorner.value, outerOptions),
    innerShareOfStatic: defined(inner / staticCorner.value, innerOptions),
  };
}

/**
 * Solve the steady-state load transfer at one lateral acceleration. All values
 * are SI inside: forces N, moments N·m, lengths m, roll angle rad, `balance` a
 * dimensionless front fraction. `lateralAcceleration_mps2` is m/s² and must be
 * non-negative; zero is a valid analysis input, not an error.
 */
export function solveLoadTransfer(input: LoadTransferInput): LoadTransferResult {
  const mass = input.totalMass_kg;
  const frontShare = input.frontMassShare;
  const unsprungFront = input.unsprungFront_kg;
  const unsprungRear = input.unsprungRear_kg;
  const unsprungHeight = input.unsprungHeight_m;
  const wheelbase = input.wheelbase_m;
  const trackFront = input.trackFront_m;
  const trackRear = input.trackRear_m;
  const rollCentreFront = input.rollCentreFront_m;
  const rollCentreRear = input.rollCentreRear_m;
  const lateralAcceleration = input.lateralAcceleration_mps2;
  const unsprungMass = unsprungFront.value + unsprungRear.value;
  const meanTrack = (trackFront.value + trackRear.value) / 2;
  const measuredCg = input.cgMeasuredHeight_m ?? null;
  const route: CgRoute =
    measuredCg !== null
      ? 'raise_and_weigh'
      : cgComponentsOf(input) === null
        ? 'stated_default'
        : 'component_mass_moment';

  type MutableWorking = { -readonly [K in keyof LoadTransferWorking]: LoadTransferWorking[K] };
  const working: MutableWorking = {
    cgRoute: route,
    cgHeight_m: null,
    totalMass_kg: mass.value,
    unsprungMass_kg: finite(unsprungMass) ? unsprungMass : null,
    sprungMass_kg: null,
    sprungCgHeight_m: null,
    frontMassShare: frontShare.value,
    wheelbase_m: finite(wheelbase.value) ? wheelbase.value : null,
    cgLongitudinal_m: null,
    trackFront_m: finite(trackFront.value) ? trackFront.value : null,
    trackRear_m: finite(trackRear.value) ? trackRear.value : null,
    meanTrack_m: finite(meanTrack) ? meanTrack : null,
    rollCentreFront_m: finite(rollCentreFront.value) ? rollCentreFront.value : null,
    rollCentreRear_m: finite(rollCentreRear.value) ? rollCentreRear.value : null,
    rollAxisHeight_m: null,
    rollMomentArm_m: null,
    rollSensitivity_degPerG: null,
    rollStiffnessFront_NmPerRad:
      input.rollStiffnessFront_NmPerRad.kind === 'defined'
        ? input.rollStiffnessFront_NmPerRad.value
        : null,
    rollStiffnessRear_NmPerRad:
      input.rollStiffnessRear_NmPerRad.kind === 'defined'
        ? input.rollStiffnessRear_NmPerRad.value
        : null,
    lateralAcceleration_mps2: lateralAcceleration,
  };

  const staticSources = [mass, frontShare];
  const staticFront =
    finite(mass.value) && mass.value > 0 && finite(frontShare.value) && frontShare.value > 0
      ? defined((mass.value * GRAVITY_MPS2 * frontShare.value) / 2, optionsFromSources(staticSources))
      : undefinedResult('outOfDomain', staticSources.map((source) => source.ref));
  const staticRear =
    finite(mass.value) && mass.value > 0 && finite(frontShare.value) && frontShare.value < 1
      ? defined(
          (mass.value * GRAVITY_MPS2 * (1 - frontShare.value)) / 2,
          optionsFromSources(staticSources),
        )
      : undefinedResult('outOfDomain', staticSources.map((source) => source.ref));

  const geometryValid =
    finite(wheelbase.value) &&
    wheelbase.value > 0 &&
    finite(trackFront.value) &&
    trackFront.value > 0 &&
    finite(trackRear.value) &&
    trackRear.value > 0 &&
    finite(rollCentreFront.value) &&
    finite(rollCentreRear.value) &&
    finite(unsprungHeight.value) &&
    unsprungHeight.value >= 0 &&
    finite(lateralAcceleration) &&
    lateralAcceleration >= 0;

  if (
    !finite(mass.value) ||
    mass.value <= 0 ||
    !finite(frontShare.value) ||
    frontShare.value <= 0 ||
    frontShare.value >= 1 ||
    !finite(unsprungFront.value) ||
    unsprungFront.value < 0 ||
    !finite(unsprungRear.value) ||
    unsprungRear.value < 0 ||
    unsprungMass >= mass.value ||
    !geometryValid
  ) {
    const refs = [
      mass.ref,
      frontShare.ref,
      unsprungFront.ref,
      unsprungRear.ref,
      unsprungHeight.ref,
      wheelbase.ref,
      trackFront.ref,
      trackRear.ref,
      rollCentreFront.ref,
      rollCentreRear.ref,
    ];
    return refusedResult('outOfDomain', refs, working, staticFront, staticRear);
  }

  const cg = inferCgHeight({
    totalMass_kg: mass,
    unsprungMass_kg: {
      value: unsprungMass,
      ref: `${unsprungFront.ref}+${unsprungRear.ref}`,
      confidence:
        unsprungFront.confidence === 'estimated' || unsprungRear.confidence === 'estimated'
          ? 'estimated'
          : 'derived',
    },
    unsprungHeight_m: unsprungHeight,
    components: cgComponentsOf(input),
    ...(input.cgDefaultHeight_m === undefined
      ? {}
      : { defaultHeight_m: input.cgDefaultHeight_m }),
    ...(input.cgMeasuredHeight_m === undefined
      ? {}
      : { measuredHeight_m: input.cgMeasuredHeight_m }),
    ...(input.cgMeasuredBand_m === undefined
      ? {}
      : { measuredBand_m: input.cgMeasuredBand_m }),
  });
  working.cgHeight_m = cg.height_m.kind === 'defined' ? cg.height_m.value : null;

  if (cg.height_m.kind !== 'defined') {
    const failure =
      cg.height_m.kind === 'undefined'
        ? { reason: cg.height_m.reason, inputs: cg.height_m.inputs }
        : { reason: 'incompleteModel' as const, inputs: cg.height_m.missing };
    return refusedResult(failure.reason, failure.inputs, {
      ...working,
      cgRoute: cg.route,
    }, staticFront, staticRear);
  }

  const h = cg.height_m;
  const sprungMass = mass.value - unsprungMass;
  if (!(sprungMass > 0)) {
    return refusedResult('outOfDomain', [mass.ref], { ...working, cgRoute: cg.route }, staticFront, staticRear);
  }
  working.sprungMass_kg = sprungMass;

  const sprungCgHeight = (mass.value * h.value - unsprungMass * unsprungHeight.value) / sprungMass;
  const cgHalfWidth = h.band === null ? null : (h.band.high - h.band.low) / 2;
  // h_s = (m·h − m_u·h_u)/m_s; only h carries a band, so its half-width scales by m/m_s.
  const hSBand =
    cgHalfWidth === null
      ? null
      : absoluteBand(sprungCgHeight, (cgHalfWidth * mass.value) / sprungMass);
  const hS = defined(sprungCgHeight, cgOptions([h], [mass, unsprungHeight], hSBand));
  working.sprungCgHeight_m = sprungCgHeight;

  const cgLongitudinal = frontShare.value * wheelbase.value;
  working.cgLongitudinal_m = cgLongitudinal;
  const rollAxisHeight =
    rollCentreRear.value + (rollCentreFront.value - rollCentreRear.value) * frontShare.value;
  working.rollAxisHeight_m = rollAxisHeight;
  const hRa = defined(
    rollAxisHeight,
    cgOptions([], [rollCentreFront, rollCentreRear, frontShare]),
  );

  const armValue = sprungCgHeight - rollAxisHeight;
  const armHalfWidth = hSBand === null ? null : (hSBand.high - hSBand.low) / 2;
  const arm = defined(
    armValue,
    cgOptions([hS, hRa], [], armHalfWidth === null ? null : absoluteBand(armValue, armHalfWidth)),
  );
  working.rollMomentArm_m = armValue;

  const tlltValue = (mass.value * lateralAcceleration * h.value) / meanTrack;
  const tllt = defined(
    tlltValue,
    cgOptions([h], [mass, trackFront, trackRear], relativeBand(tlltValue, CG_TLLT_BAND_RELATIVE)),
  );

  const rollMomentValue = sprungMass * lateralAcceleration * armValue;
  const rollOptions = cgOptions([h, hS, hRa], [mass, frontShare, unsprungHeight]);
  const rollFlags = new Set<Flag>();
  if (rollOptions.flags !== undefined) {
    for (const flag of rollOptions.flags) rollFlags.add(flag);
  }
  if (sprungCgHeight < rollAxisHeight) rollFlags.add('rollCentreAboveCg');
  const rollMoment = defined(rollMomentValue, {
    ...rollOptions,
    band:
      armHalfWidth === null
        ? null
        : absoluteBand(
            rollMomentValue,
            Math.abs(sprungMass * lateralAcceleration) * armHalfWidth,
          ),
    flags: rollFlags,
  });

  const stiffnessFront = input.rollStiffnessFront_NmPerRad;
  const stiffnessRear = input.rollStiffnessRear_NmPerRad;
  const stiffnessTotal = addDefined([stiffnessFront, stiffnessRear], (parts) =>
    optionsFromParts(parts, []),
  );

  let rollSensitivity: Solved<number>;
  if (
    stiffnessTotal.kind !== 'defined' ||
    !(stiffnessTotal.value > 0) ||
    arm.kind !== 'defined'
  ) {
    rollSensitivity =
      stiffnessTotal.kind !== 'defined'
        ? stiffnessTotal
        : stiffnessTotal.value > 0
          ? arm
          : undefinedResult('noRollStiffness');
    working.rollSensitivity_degPerG = null;
  } else {
    // At 1 g the roll moment is m_s·g·arm; dividing by the total roll stiffness
    // gives the roll angle per g, converted from radians to degrees at the boundary.
    const sensitivityValue =
      ((sprungMass * GRAVITY_MPS2 * armValue) / stiffnessTotal.value) * (180 / Math.PI);
    const sensitivityHalfWidth =
      armHalfWidth === null
        ? null
        : Math.abs(
            (sprungMass * GRAVITY_MPS2 / stiffnessTotal.value) * (180 / Math.PI) * armHalfWidth,
          );
    rollSensitivity = defined(sensitivityValue, {
      ...cgOptions([arm, stiffnessTotal], []),
      band:
        sensitivityHalfWidth === null
          ? null
          : absoluteBand(sensitivityValue, sensitivityHalfWidth),
    });
    working.rollSensitivity_degPerG = sensitivityValue;
  }

  let rollAngle: Solved<number>;
  let elasticFront: Solved<number>;
  let elasticRear: Solved<number>;
  if (stiffnessTotal.kind !== 'defined' || !(stiffnessTotal.value > 0)) {
    const failure =
      stiffnessTotal.kind !== 'defined'
        ? stiffnessTotal
        : undefinedResult('noRollStiffness', [
            ...(stiffnessFront.kind === 'defined' ? stiffnessFront.provenance : []),
            ...(stiffnessRear.kind === 'defined' ? stiffnessRear.provenance : []),
          ]);
    rollAngle = failure;
    elasticFront = failure;
    elasticRear = failure;
  } else {
    const rollAngleValue = rollMomentValue / stiffnessTotal.value;
    const rollAngleDefined = defined(
      rollAngleValue,
      cgOptions(
        [rollMoment, stiffnessTotal],
        [],
        relativeBand(rollAngleValue, CG_ROLL_ANGLE_BAND_RELATIVE),
      ),
    );
    rollAngle = rollAngleDefined;
    const elasticPart = (stiffness: Solved<number>, track: Sourced<number>): Solved<number> => {
      if (stiffness.kind !== 'defined') return stiffness;
      const value = (stiffness.value * rollAngleValue) / track.value;
      return defined(value, cgOptions([rollAngleDefined, stiffness], [track]));
    };
    elasticFront = elasticPart(stiffnessFront, trackFront);
    elasticRear = elasticPart(stiffnessRear, trackRear);
  }

  const sprungFrontMass = mass.value * frontShare.value - unsprungFront.value;
  const sprungRearMass = mass.value * (1 - frontShare.value) - unsprungRear.value;
  const geometricPart = (
    sprungAxleMass: number,
    rollCentreHeight: Sourced<number>,
    track: Sourced<number>,
  ): Solved<number> => {
    if (!(sprungAxleMass >= 0)) return undefinedResult('outOfDomain', [mass.ref]);
    const value = (sprungAxleMass * lateralAcceleration * rollCentreHeight.value) / track.value;
    return defined(
      value,
      optionsFromSources([mass, frontShare, unsprungFront, unsprungRear, rollCentreHeight, track]),
    );
  };
  const unsprungPart = (
    unsprungAxleMass: Sourced<number>,
    track: Sourced<number>,
  ): Solved<number> => {
    const value =
      (unsprungAxleMass.value * lateralAcceleration * unsprungHeight.value) / track.value;
    return defined(
      value,
      optionsFromSources([unsprungAxleMass, unsprungHeight, track]),
    );
  };

  const geometricFront = geometricPart(sprungFrontMass, rollCentreFront, trackFront);
  const geometricRear = geometricPart(sprungRearMass, rollCentreRear, trackRear);
  const unsprungFrontTransfer = unsprungPart(unsprungFront, trackFront);
  const unsprungRearTransfer = unsprungPart(unsprungRear, trackRear);

  const frontTransfer = addDefined(
    [elasticFront, geometricFront, unsprungFrontTransfer],
    (parts) => cgOptions(parts, []),
  );
  const rearTransfer = addDefined(
    [elasticRear, geometricRear, unsprungRearTransfer],
    (parts) => cgOptions(parts, []),
  );

  const frontTotal: AxleTransfer = {
    elastic: elasticFront,
    geometric: geometricFront,
    unsprung: unsprungFrontTransfer,
    total: frontTransfer,
  };
  const rearTotal: AxleTransfer = {
    elastic: elasticRear,
    geometric: geometricRear,
    unsprung: unsprungRearTransfer,
    total: rearTransfer,
  };

  let balance: Solved<number>;
  if (frontTransfer.kind !== 'defined') {
    balance = frontTransfer;
  } else if (rearTransfer.kind !== 'defined') {
    balance = rearTransfer;
  } else if (lateralAcceleration === 0) {
    balance = undefinedResult('zeroLateral', [mass.ref, trackFront.ref, trackRear.ref]);
  } else if (!(stiffnessTotal.kind === 'defined' && stiffnessTotal.value > 0)) {
    balance = undefinedResult('noRollStiffness');
  } else {
    const sum = frontTransfer.value + rearTransfer.value;
    if (!(sum > 0)) {
      balance = undefinedResult('zeroLateral', [mass.ref]);
    } else {
      const balanceValue = frontTransfer.value / sum;
      balance = defined(
        balanceValue,
        cgOptions(
          [frontTransfer, rearTransfer],
          [],
          absoluteBand(balanceValue, CG_BALANCE_BAND_FRACTION),
        ),
      );
    }
  }

  const frontWheel = wheelLoad(staticFront, frontTransfer);
  const rearWheel = wheelLoad(staticRear, rearTransfer);

  let residual: Solved<number>;
  if (tllt.kind !== 'defined') {
    residual = tllt;
  } else if (frontTransfer.kind !== 'defined') {
    residual = frontTransfer;
  } else if (rearTransfer.kind !== 'defined') {
    residual = rearTransfer;
  } else if (tllt.value === 0) {
    // G06.7: at a_y = 0 the transfer is exactly zero; the residual is defined
    // as zero by the same limit rather than 0/0.
    residual = defined(0, cgOptions([tllt], []));
  } else {
    const sum = frontTransfer.value + rearTransfer.value;
    residual = defined(
      (sum - tllt.value) / tllt.value,
      cgOptions([tllt, frontTransfer, rearTransfer], []),
    );
  }

  return {
    cgHeight: h,
    cgRoute: cg.route,
    cgHeightBand: h.band,
    staticFrontCorner: staticFront,
    staticRearCorner: staticRear,
    totalLateralLoadTransfer: tllt,
    rollAxisHeight: hRa,
    rollMomentArm: arm,
    rollMoment,
    rollAngle,
    rollSensitivity_degPerG: rollSensitivity,
    front: frontTotal,
    rear: rearTotal,
    balance,
    frontWheel,
    rearWheel,
    residual,
    working,
  };
}
