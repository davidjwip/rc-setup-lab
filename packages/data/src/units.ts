import { GRAVITY_MPS2 } from '@setuplab/physics';

export function millimetresToMetres(millimetres: number): number {
  return millimetres / 1000;
}

export function metresToMillimetres(metres: number): number {
  return metres * 1000;
}

export function gramsToKilograms(grams: number): number {
  return grams / 1000;
}

export function kilogramsToGrams(kilograms: number): number {
  return kilograms * 1000;
}

export function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function radiansToDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

export function newtonsPerMillimetreToNewtonsPerMetre(value: number): number {
  return value * 1000;
}

export function percentToFraction(value: number): number {
  return value / 100;
}

export function gravitiesToMetresPerSecondSquared(value: number): number {
  return value * GRAVITY_MPS2;
}
