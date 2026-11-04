import type { CornerKey, CornerPointKey } from '@setuplab/data';
import type { SetupStore } from '../state/setupStore.js';
import { checkHardpointMm } from './hardpoints.js';

export interface HardpointCommitTarget {
  readonly cornerKey: CornerKey;
  readonly pointKey: CornerPointKey;
  readonly axis: 1 | 2;
  readonly baseMm: number;
  readonly shim: boolean;
}

export function commitHardpointText(
  store: SetupStore,
  target: HardpointCommitTarget,
  text: string,
): string | null {
  const checked = checkHardpointMm(text);
  if (!checked.ok) return checked.message;
  const valueMm = target.shim ? target.baseMm + checked.value : checked.value;
  return store.commitHardpoint(target.cornerKey, target.pointKey, target.axis, valueMm);
}
