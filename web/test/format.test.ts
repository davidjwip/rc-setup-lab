import { describe, expect, it } from 'vitest';
import {
  formatBandFromMetres,
  formatCamberGain,
  formatLengthFromMetres,
  formatRollCentreHeight,
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
});
