import type { Band } from '@setuplab/physics';

export const LENGTH_UNIT = 'mm';
export const CAMBER_GAIN_UNIT = '°/mm';

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
