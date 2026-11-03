import type { Band } from '@setuplab/physics';

export const LENGTH_UNIT = 'mm';
export const CAMBER_GAIN_UNIT = '°/mm';
export const WHEEL_RATE_UNIT = 'N/mm';
export const RIDE_FREQUENCY_UNIT = 'Hz';
export const ROLL_STIFFNESS_UNIT = 'N·m/deg';
export const FRONT_SHARE_UNIT = '%';

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
