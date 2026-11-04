export const ANALYSIS_MODES = ['front', 'rear', 'both'] as const;

export type AnalysisMode = (typeof ANALYSIS_MODES)[number];

export const ANALYSIS_MODE_LABELS: Readonly<Record<AnalysisMode, string>> = {
  front: 'Front',
  rear: 'Rear',
  both: 'Both',
};

export function isAnalysisMode(value: string): value is AnalysisMode {
  return (ANALYSIS_MODES as readonly string[]).includes(value);
}

export function hashForAnalysisMode(mode: AnalysisMode): string {
  return `#${mode}`;
}

export function nextRadioIndex(current: number, key: string, count: number): number {
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return (current + 1) % count;
    case 'ArrowLeft':
    case 'ArrowUp':
      return (current - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return current;
  }
}

interface HashEnvironment {
  readonly history?:
    | {
        replaceState(data: unknown, unused: string, url?: string | null): void;
      }
    | undefined;
  readonly location?: { hash: string } | undefined;
}

export function writeAnalysisModeHash(
  mode: AnalysisMode,
  environment: HashEnvironment = globalThis as HashEnvironment,
): void {
  const hash = hashForAnalysisMode(mode);
  try {
    if (typeof environment.history?.replaceState === 'function') {
      environment.history.replaceState(null, '', hash);
      return;
    }
  } catch {}

  try {
    if (environment.location !== undefined) environment.location.hash = hash;
  } catch {}
}
