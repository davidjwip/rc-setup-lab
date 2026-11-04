export type ValueProvenance =
  | 'computed'
  | 'measured'
  | 'modelled'
  | 'estimated'
  | 'inferred'
  | 'missing'
  | 'undefined';

export type ValueValidation = 'unvalidated' | 'validated' | 'not_validatable';

export type ValueSize = 'small' | 'medium' | 'large';

export interface ValueProps {
  /** Already formatted by `web/src/format/`; never a number string with a unit in it. */
  readonly value: string | null;
  readonly unit: string;
  readonly provenance: ValueProvenance;
  /** A formatted `±x` band, or null when the source stores no tolerance. */
  readonly band: string | null;
  readonly bandReason?: string;
  readonly validation?: ValueValidation;
  readonly accessibleName: string;
  readonly size?: ValueSize;
  /** Human copy for a missing or undefined value; never a solver code. */
  readonly reason?: string;
}

const CLAIM: Readonly<Record<'missing' | 'undefined', string>> = {
  missing: 'Not computable yet',
  undefined: 'Undefined for this geometry',
};

function validationWords(validation: ValueValidation): string {
  switch (validation) {
    case 'unvalidated':
      return 'unvalidated';
    case 'validated':
      return 'validated';
    case 'not_validatable':
      return 'not validatable';
  }
}

export function Value({
  value,
  unit,
  provenance,
  band,
  bandReason,
  validation = 'unvalidated',
  accessibleName,
  size = 'medium',
  reason,
}: ValueProps) {
  const noNumeral = provenance === 'missing' || provenance === 'undefined';
  const numeral = value ?? (provenance === 'missing' ? CLAIM.missing : CLAIM.undefined);
  const bandText = band === null ? `no band${bandReason === undefined ? '' : ` · ${bandReason}`}` : band;
  const spoken = noNumeral
    ? `${accessibleName}, ${numeral}${reason === undefined ? '' : `, ${reason}`}, ${provenance}, ${validationWords(validation)}`
    : `${accessibleName}, ${numeral} ${unit}, ${bandText}, ${provenance}, ${validationWords(validation)}`;

  return (
    <span
      className={`value-block value-block--${size}`}
      role="group"
      aria-label={spoken}
      data-value
      data-provenance={provenance}
      data-badge={provenance}
      data-has-band={band === null ? 'false' : 'true'}
      data-band={bandText}
      data-validation={validation}
      data-accessible-name={accessibleName}
      data-size={size}
    >
      <span
        className={noNumeral ? 'value-number value-number--claim' : 'value-number'}
        aria-hidden="true"
      >
        {numeral}
      </span>
      {noNumeral ? null : (
        <span className="value-unit" aria-hidden="true">
          {unit}
        </span>
      )}
      <span
        className={`value-provenance value-provenance--${provenance}`}
        aria-hidden="true"
      >
        {provenance}
      </span>
      <span className="value-band" aria-hidden="true">
        {bandText}
      </span>
      <span
        className={`value-ring value-ring--${validation}`}
        aria-hidden="true"
        title={validationWords(validation)}
      />
    </span>
  );
}
