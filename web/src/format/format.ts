import type { Band } from '@setuplab/physics';

export const LENGTH_UNIT = 'mm';
export const CAMBER_GAIN_UNIT = '°/mm';
export const TOE_GAIN_UNIT = '°/mm';
export const WHEEL_RATE_UNIT = 'N/mm';
export const RIDE_FREQUENCY_UNIT = 'Hz';
export const ROLL_STIFFNESS_UNIT = 'N·m/deg';
export const FRONT_SHARE_UNIT = '%';
export const FORCE_UNIT = 'N';
export const MOMENT_UNIT = 'N·m';
export const LATERAL_G_UNIT = 'g';
export const ANGLE_UNIT = '°';
export const ROLL_SENSITIVITY_UNIT = '°/g';

const RADIANS_PER_DEGREE = Math.PI / 180;

export function formatNumber(value: number, digits = 2): string {
  return value.toFixed(digits);
}

export function formatLengthMm(millimetres: number, digits = 2): string {
  return `${millimetres.toFixed(digits)} ${LENGTH_UNIT}`;
}

export function formatLengthFromMetres(metres: number, digits = 2): string {
  return formatLengthMm(metres * 1000, digits);
}

export function formatRollCentreHeight(metres: number): string {
  return formatLengthFromMetres(metres, 2);
}

export function formatBandFromMetres(band: Band): string {
  const halfWidthMm = ((band.high - band.low) / 2) * 1000;
  return `±${halfWidthMm.toFixed(1)} ${LENGTH_UNIT}`;
}

export function formatCamberGain(radiansPerMetre: number): string {
  const degreesPerMillimetre = (radiansPerMetre * 180) / Math.PI / 1000;
  return `${degreesPerMillimetre.toFixed(2)} ${CAMBER_GAIN_UNIT}`;
}

/** Per-wheel toe, radians in the solver, degrees on screen. Positive = toe-in. */
export function formatToe(radians: number, digits = 2): string {
  return formatAngleDegrees(radians, digits);
}

/** Toe gain: rad/m in the solver, °/mm on screen. */
export function formatToeGain(radiansPerMetre: number, digits = 3): string {
  const degreesPerMillimetre = (radiansPerMetre * 180) / Math.PI / 1000;
  const sign = degreesPerMillimetre > 0 ? '+' : '';
  return `${sign}${degreesPerMillimetre.toFixed(digits)} ${TOE_GAIN_UNIT}`;
}

/** Total toe change across the drawing's ±5 mm, in degrees. */
export function formatToeChange(radians: number, digits = 3): string {
  return formatAngleDegrees(radians, digits);
}

export function formatSlope(value: number): string {
  return value.toFixed(6);
}

export function formatWheelRateFromNpm(newtonsPerMetre: number, digits = 2): string {
  return `${(newtonsPerMetre / 1000).toFixed(digits)} ${WHEEL_RATE_UNIT}`;
}

export function formatSpringRateFromNpm(newtonsPerMetre: number, digits = 2): string {
  return `${(newtonsPerMetre / 1000).toFixed(digits)} ${WHEEL_RATE_UNIT}`;
}

export function formatBandFromNpm(band: Band): string {
  const halfWidthNmm = (band.high - band.low) / 2 / 1000;
  return `±${halfWidthNmm.toFixed(2)} ${WHEEL_RATE_UNIT}`;
}

export function formatRideFrequency(hertz: number, digits = 1): string {
  return `${hertz.toFixed(digits)} ${RIDE_FREQUENCY_UNIT}`;
}

export function formatInstallationRatio(value: number, digits = 2): string {
  return value.toFixed(digits);
}

export function formatCriticalDamping(newtonSecondsPerMetre: number, digits = 2): string {
  return `${newtonSecondsPerMetre.toFixed(digits)} N·s/m`;
}

/** fields.yaml `roll_stiffness`: the solver's N·m/rad displayed as N·m/deg. */
export function formatRollStiffness(newtonMetresPerRadian: number, digits = 2): string {
  const newtonMetresPerDegree = newtonMetresPerRadian * RADIANS_PER_DEGREE;
  return `${newtonMetresPerDegree.toFixed(digits)} ${ROLL_STIFFNESS_UNIT}`;
}

/** The solver unit, for the "Show the maths" chain. */
export function formatRollStiffnessSi(newtonMetresPerRadian: number, digits = 2): string {
  return `${newtonMetresPerRadian.toFixed(digits)} N·m/rad`;
}

/** The torsion bar's k_θ in the solver unit, N·m/rad. */
export function formatTorsionalStiffness(newtonMetresPerRadian: number, digits = 3): string {
  return `${newtonMetresPerRadian.toFixed(digits)} N·m/rad`;
}

export function formatFrontShare(fraction: number, digits = 1): string {
  return `${(fraction * 100).toFixed(digits)} ${FRONT_SHARE_UNIT}`;
}

export function formatForce(newtons: number, digits = 3): string {
  return `${newtons.toFixed(digits)} ${FORCE_UNIT}`;
}

export function formatForceBand(band: Band, digits = 2): string {
  const halfWidth = (band.high - band.low) / 2;
  return `±${halfWidth.toFixed(digits)} ${FORCE_UNIT}`;
}

export function formatMoment(newtonMetres: number, digits = 3): string {
  return `${newtonMetres.toFixed(digits)} ${MOMENT_UNIT}`;
}

export function formatMomentBand(band: Band, digits = 3): string {
  const halfWidth = (band.high - band.low) / 2;
  return `±${halfWidth.toFixed(digits)} ${MOMENT_UNIT}`;
}

export function formatRollSensitivity(degreesPerG: number, digits = 2): string {
  return `${degreesPerG.toFixed(digits)} ${ROLL_SENSITIVITY_UNIT}`;
}

export function formatRollSensitivityBand(band: Band, digits = 2): string {
  const halfWidth = (band.high - band.low) / 2;
  return `±${halfWidth.toFixed(digits)} ${ROLL_SENSITIVITY_UNIT}`;
}

export function formatPercent(fraction: number, digits = 1): string {
  return `${(fraction * 100).toFixed(digits)} ${FRONT_SHARE_UNIT}`;
}

export function formatPercentagePointBand(band: Band, digits = 2): string {
  const halfWidth = ((band.high - band.low) / 2) * 100;
  return `±${halfWidth.toFixed(digits)} pp`;
}

/** The solver stores the roll angle in radians; the UI reads degrees. */
export function formatAngleDegrees(radians: number, digits = 2): string {
  return `${((radians * 180) / Math.PI).toFixed(digits)} ${ANGLE_UNIT}`;
}

export function formatLateralG(value: number, digits = 1): string {
  return `${value.toFixed(digits)} ${LATERAL_G_UNIT}`;
}

export function formatCgRoute(
  route: 'raise_and_weigh' | 'component_mass_moment' | 'stated_default',
): string {
  switch (route) {
    case 'raise_and_weigh':
      return 'measured · raise-and-weigh';
    case 'component_mass_moment':
      return 'estimated · component-mass';
    case 'stated_default':
      return 'stated default (D-18)';
  }
}
