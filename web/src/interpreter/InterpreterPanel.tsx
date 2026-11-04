import {
  ROLL_SENSITIVITY_UNIT,
  formatRollSensitivity,
  formatRollSensitivityBand,
} from '../format/format.js';
import type { Interpretation } from './interpreter.js';

export interface InterpreterPanelProps {
  readonly interpretation: Interpretation;
}

function signed(value: number, digits = 2): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(digits)} ${ROLL_SENSITIVITY_UNIT}`;
}

export function InterpreterPanel({ interpretation }: InterpreterPanelProps) {
  const { headline, lines } = interpretation;

  return (
    <article className="card result-card interpreter-card">
      <div className="card-heading">
        <div>
          <h2>What this change does</h2>
          <p className="hint">
            Baseline is the model as loaded. Each line names the phase, the mechanism and how far
            the physics supports the reading.
          </p>
        </div>
        <span className="pill">interpreter · model numbers</span>
      </div>

      <div className="interpreter-headline">
        <span className="value">
          {headline.value === null
            ? 'not computable'
            : formatRollSensitivity(headline.value)}
        </span>
        <span className="band">
          roll sensitivity ·{' '}
          {headline.delta === null ? 'no delta' : `${signed(headline.delta)} from baseline`} ·{' '}
          {headline.band === null
            ? 'no band'
            : formatRollSensitivityBand(headline.band)}
        </span>
      </div>

      <p className="hint interpreter-disclaimer">{interpretation.disclaimer}</p>

      {lines.length === 0 ? (
        <p className="no-answer">{interpretation.emptyMessage}</p>
      ) : (
        <ol className="interpreter-lines">
          {lines.map((line) => (
            <li
              key={`${line.ruleId}:${line.phase}`}
              className={`interpreter-line interpreter-line-${line.confidence}`}
            >
              <div className="interpreter-tags">
                <span className="phase-tag">{line.phase}</span>
                <span className="confidence-tag">{line.confidence}</span>
              </div>
              <p className="interpreter-mechanism">{line.mechanism}</p>
              <p className="interpreter-says">{line.says}</p>
              <p className="interpreter-effect">{line.effect}</p>
            </li>
          ))}
        </ol>
      )}

      <p className="footnote">{interpretation.gripFootnote}</p>
    </article>
  );
}
