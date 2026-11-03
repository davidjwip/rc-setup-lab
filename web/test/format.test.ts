import { describe, expect, it } from 'vitest';
import {
  formatBandFromMetres,
  formatCamberGain,
  formatCriticalDamping,
  formatInstallationRatio,
  formatLengthFromMetres,
  formatRideFrequency,
  formatRollCentreHeight,
  formatSpringRateFromNpm,
  formatWheelRateFromNpm,
} from '../src/format/format.js';

describe('display formatting', () => {
  it('converts SI roll-centre height to millimetres for display', () => {
    expect(formatRollCentreHeight(0.0099749)).toBe('9.97 mm');
    expect(formatLengthFromMetres(-0.435691, 3)).toBe('-435.691 mm');
  });

  it('prints the band as a half width in display units', () => {
    expect(formatBandFromMetres({ low: 0.0089749, high: 0.0109749 })).toBe('±1.0 mm');
  });

  it('converts rad/m to degrees per millimetre', () => {
    expect(formatCamberGain((-0.109816 * Math.PI) / 180 * 1000)).toBe('-0.11 °/mm');
  });

  it('converts SI wheel rate and frequency to display units', () => {
    expect(formatWheelRateFromNpm(1118.51)).toBe('1.12 N/mm');
    expect(formatSpringRateFromNpm(3500)).toBe('3.50 N/mm');
    expect(formatRideFrequency(10.781)).toBe('10.8 Hz');
    expect(formatInstallationRatio(0.565308)).toBe('0.57');
    expect(formatCriticalDamping(33.023)).toBe('33.02 N·s/m');
  });
});
