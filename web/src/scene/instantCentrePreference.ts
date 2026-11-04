export const INSTANT_CENTRE_STORAGE_KEY = 'setuplab.scene.instantCentre';

export interface PreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function browserStorage(): PreferenceStorage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function readInstantCentrePreference(
  storage: PreferenceStorage | null = browserStorage(),
): boolean {
  if (storage === null) return false;
  try {
    return storage.getItem(INSTANT_CENTRE_STORAGE_KEY) === 'on';
  } catch {
    return false;
  }
}

export function writeInstantCentrePreference(
  value: boolean,
  storage: PreferenceStorage | null = browserStorage(),
): void {
  if (storage === null) return;
  try {
    storage.setItem(INSTANT_CENTRE_STORAGE_KEY, value ? 'on' : 'off');
  } catch {
    return;
  }
}

export function toggleInstantCentre(value: boolean): boolean {
  return !value;
}
