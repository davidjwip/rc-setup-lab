import { useRef } from 'react';
import {
  ANALYSIS_MODES,
  ANALYSIS_MODE_LABELS,
  nextRadioIndex,
  type AnalysisMode,
} from './viewMode.js';

export interface ViewModeControlProps {
  readonly value: AnalysisMode;
  readonly onChange: (mode: AnalysisMode) => void;
}

const RADIO_COUNT = ANALYSIS_MODES.length;

export function ViewModeControl({ value, onChange }: ViewModeControlProps) {
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);

  const selectIndex = (index: number) => {
    const mode = ANALYSIS_MODES[index];
    if (mode === undefined) return;
    onChange(mode);
    buttons.current[index]?.focus();
  };

  return (
    <div className="view-control" role="radiogroup" aria-label="View">
      {ANALYSIS_MODES.map((mode, index) => (
        <button
          key={mode}
          ref={(element) => {
            buttons.current[index] = element;
          }}
          type="button"
          role="radio"
          aria-checked={value === mode}
          tabIndex={value === mode ? 0 : -1}
          data-mode={mode}
          className={value === mode ? 'is-selected' : undefined}
          onClick={() => onChange(mode)}
          onKeyDown={(event) => {
            const next = nextRadioIndex(index, event.key, RADIO_COUNT);
            if (next === index) return;
            event.preventDefault();
            selectIndex(next);
          }}
        >
          {ANALYSIS_MODE_LABELS[mode]}
        </button>
      ))}
    </div>
  );
}
