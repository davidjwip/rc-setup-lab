/**
 * The words used when a number cannot be produced. Every refusal names what is
 * missing and the place the user can supply it; solver codes never reach the
 * screen.
 */

export const UNDEFINED_REASON_COPY: Readonly<Record<string, string>> = {
  parallelLinks: 'the upper and lower links are parallel in this view',
  degenerateGeometry: 'two points coincide or a link has no length',
  coincidentPoints: 'two points coincide',
  outOfTravel: 'the wheel is outside the travel this model covers',
  incompleteModel: 'a required measurement is missing',
  noIntersection: 'the links do not meet in a usable instant centre',
  outOfDomain: 'the geometry has no finite answer',
  noBumpSteerSolution: 'the toe link has no usable answer at this travel',
  noSteeringAxis: 'the corner has no steering axis',
  zeroLateral: 'there is no lateral load to solve',
  noRollStiffness: 'the roll stiffness is not available',
  noAntiGeometry: 'the anti-dive geometry is not available',
  noSideViewConstruction: 'the side-view construction is not available',
  noMotionRatio: 'the motion ratio is not available',
  ambiguousBranch: 'the linkage has more than one assembly position',
  outOfRackTravel: 'the rack is outside its travel',
};

export const UNDEFINED_REASON_ADVICE: Readonly<Record<string, string>> = {
  parallelLinks: 'Check the two link heights on Geometry.',
  degenerateGeometry: 'Check the two hardpoints on Geometry.',
  coincidentPoints: 'Check the two hardpoints on Geometry.',
  outOfTravel: 'Measure the travel on Geometry and stay inside it.',
  incompleteModel: 'Measure the missing part on Home or Geometry.',
  noIntersection: 'Check the two link heights on Geometry.',
  outOfDomain: 'Check the hardpoints on Geometry.',
  noBumpSteerSolution: 'Check the tie-rod points on Geometry.',
  noSteeringAxis: 'Add the upper and lower pivot heights on Geometry.',
  zeroLateral: 'Set a positive lateral acceleration on Transfer; the car data stays on Home and Geometry.',
  noRollStiffness: 'Measure the spring on Geometry, then set its rate on Shock.',
  noAntiGeometry: 'Check the lower-arm inner screws on Geometry.',
  noSideViewConstruction: 'Check the lower-arm inner screws on Geometry.',
  noMotionRatio: 'Check the damper eye positions on Geometry.',
  ambiguousBranch: 'Check the hardpoint signs on Geometry.',
  outOfRackTravel: 'Measure the rack travel on Geometry, then stay inside it.',
};

const DEFAULT_REASON = 'the geometry has no answer';
const DEFAULT_ADVICE = 'Check the inputs on Home and Geometry.';

export function undefinedReasonCopy(reason: string): string {
  return UNDEFINED_REASON_COPY[reason] ?? DEFAULT_REASON;
}

export function undefinedAdvice(reason: string): string {
  return UNDEFINED_REASON_ADVICE[reason] ?? DEFAULT_ADVICE;
}

/** A full sentence for an undefined value, in the user's words. */
export function undefinedRefusal(label: string, reason: string): string {
  const copy = undefinedReasonCopy(reason);
  return `${label}: ${copy}. ${undefinedAdvice(reason)}`;
}

function missingNoun(ref: string): string {
  if (ref.includes('cg.height')) return 'CG height';
  if (ref.includes('mass.total') || ref.includes('mass_total')) return 'car mass';
  if (ref.includes('sprung_')) return 'sprung mass';
  if (ref.includes('unsprung_')) return 'unsprung mass';
  if (ref.includes('lca_in')) return 'lower-arm inner screw height';
  if (ref.includes('lca_out')) return 'lower ball joint';
  if (ref.includes('uca_out')) return 'upper ball stud';
  if (ref.includes('uca_in')) return 'upper link inner point';
  if (ref.includes('tie_')) return 'tie rod';
  if (ref.includes('damper_lo') || ref.includes('damper_up')) return 'damper mount point';
  if (ref.includes('spring.rate')) return 'spring rate';
  if (ref.includes('rate_at_link')) return "blade's rate at the link";
  if (ref.includes('arb.blades')) return 'blade count';
  if (ref.includes('bar_diameter')) return 'bar diameter';
  if (ref.includes('arb.span')) return 'bar span';
  if (ref.includes('arm_length')) return 'bar arm length';
  if (ref.includes('arb.')) return 'anti-roll bar geometry';
  if (ref.includes('bump_limit')) return 'bump limit';
  if (ref.includes('droop_limit')) return 'droop limit';
  if (ref.includes('thickness')) return 'chassis plate thickness';
  if (ref.includes('ride_height')) return 'ride height';
  if (ref.includes('wheelbase')) return 'wheelbase';
  if (ref.includes('tyre_radius')) return 'tyre radius';
  return 'a required measurement';
}

function missingAdviceFor(ref: string): string {
  if (ref.includes('cg.height')) {
    return 'Measure it on Home with the raise-and-weigh method, or accept the stated 28 mm default.';
  }
  if (ref.includes('mass') || ref.includes('sprung_')) return 'Measure it on Home.';
  if (ref.includes('ride_height') || ref.includes('thickness')) return 'Measure it on Home.';
  if (ref.includes('wheelbase') || ref.includes('tyre_radius')) return 'Measure it on Home.';
  if (ref.includes('bump_limit') || ref.includes('droop_limit')) return 'Measure it on Home.';
  if (ref.includes('spring.rate') || ref.includes('arb.') || ref.includes('rate_at_link')) {
    return 'Measure the corner on Geometry, then set the rate on Shock.';
  }
  return 'Measure it on Geometry.';
}

export function missingCopy(refs: readonly string[]): string {
  const nouns = [...new Set(refs.map(missingNoun))];
  if (nouns.length === 0) return 'a required measurement';
  if (nouns.length === 1) return `the ${nouns[0] ?? 'required measurement'}`;
  return `the ${nouns.slice(0, -1).join(', ')} and the ${nouns[nouns.length - 1]}`;
}

export function missingAdvice(refs: readonly string[]): string {
  return [...new Set(refs.map(missingAdviceFor))].join(' ');
}

/** A full sentence for a missing value, in the user's words. */
export function missingRefusal(label: string, refs: readonly string[]): string {
  const advice = missingAdvice(refs);
  return `${label} is not computable yet. Missing: ${missingCopy(refs)}. ${advice}`;
}

/** Every branch of the missing-input copy, for the refusal test. */
export const MISSING_REF_SAMPLES: readonly (readonly string[])[] = [
  ['body.cg.height'],
  ['body.mass.total'],
  ['body.mass.sprung_front'],
  ['body.mass.unsprung_front'],
  ['body.reference_ride_height'],
  ['body.chassis.thickness'],
  ['body.wheelbase'],
  ['axles.front.tyre_radius'],
  ['axles.front.spring.rate'],
  ['corners.LF.points.lca_in_a'],
  ['corners.LF.points.lca_out'],
  ['corners.LF.points.uca_out'],
  ['corners.LF.points.uca_in'],
  ['corners.LF.points.tie_in'],
  ['corners.LF.points.damper_lo'],
  ['axles.front.arb.rate_at_link'],
  ['axles.front.arb.blades'],
  ['axles.front.arb.bar_diameter'],
  ['axles.front.arb.span'],
  ['axles.front.arb.arm_length'],
  ['axles.front.arb.type'],
  ['corners.LF.bump_limit'],
  ['corners.LF.droop_limit'],
  ['corners.LF.unknown_field'],
];
