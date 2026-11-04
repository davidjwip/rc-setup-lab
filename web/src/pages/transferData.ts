import {
  buildAntiDiveInput,
  buildLoadTransferInput,
  buildRollStiffnessInput,
  gravitiesToMetresPerSecondSquared,
  type CarModelDocument,
} from '@setuplab/data';
import {
  solveAntiDive,
  solveAntiDiveCurve,
  solveLoadTransfer,
  solveRollStiffness,
  type Band,
  type LoadTransferResult,
  type Solved,
} from '@setuplab/physics';
import {
  formatAngleBand,
  formatAngleRadiansValue,
  formatBandFromMetres,
  formatCgRoute,
  formatFixedNumber,
  formatForce,
  formatForceBand,
  formatFrontShareValue,
  formatLengthFromMetresValue,
  formatLateralG,
  formatMomentBand,
  formatPercent,
  formatPercentagePointBand,
  formatRollSensitivityBand,
  formatSignedNumber,
} from '../format/format.js';
import type { LoadDiagramAxle, LoadDiagramView } from '../scene/TransferLoadDiagram.js';
import { buildAntiDiveChart, type AntiDiveChartView } from '../scene/presenter.js';
import type { ValueProvenance } from '../view/Value.js';
import { provenanceForSolved } from '../view/provenance.js';
import {
  missingAdvice,
  missingCopy,
  missingRefusal,
  undefinedRefusal,
} from '../view/refusal.js';

export type TransferValueSize = 'hero' | 'large' | 'medium';

export interface TransferValue {
  readonly id: string;
  readonly label: string;
  readonly value: string | null;
  readonly unit: string;
  readonly provenance: ValueProvenance;
  readonly band: string | null;
  readonly bandReason?: string;
  readonly reason?: string;
  readonly accessibleName: string;
  readonly size: TransferValueSize;
  readonly delta?: string | null;
}

export interface TransferPageData {
  readonly lateralG: number;
  readonly lateralGValue: TransferValue;
  readonly hero: TransferValue;
  readonly diagram: LoadDiagramView;
  readonly loads: readonly TransferValue[];
  readonly roll: readonly TransferValue[];
  readonly longitudinal: {
    readonly antiDive: TransferValue;
    readonly antiSquat: TransferValue;
    readonly chart: AntiDiveChartView | null;
    readonly chartRefusal: string | null;
    readonly brakingLabel: string;
    readonly accelerationLabel: string;
  };
  readonly cg: {
    readonly height: TransferValue;
    readonly route: string;
    readonly routeDetail: string;
  };
  readonly rollShare: TransferValue;
  readonly sharesNote: string;
}

function missingValue(
  id: string,
  label: string,
  unit: string,
  accessibleName: string,
  reason: string,
  size: TransferValueSize = 'medium',
): TransferValue {
  return {
    id,
    label,
    value: null,
    unit,
    provenance: 'missing',
    band: null,
    bandReason: 'there is no number to compare',
    reason,
    accessibleName,
    size,
  };
}

function undefinedValue(
  id: string,
  label: string,
  unit: string,
  accessibleName: string,
  reason: string,
  size: TransferValueSize = 'medium',
): TransferValue {
  return {
    id,
    label,
    value: null,
    unit,
    provenance: 'undefined',
    band: null,
    bandReason: 'there is no number to compare',
    reason,
    accessibleName,
    size,
  };
}

function solvedValue({
  id,
  label,
  unit,
  accessibleName,
  solved,
  format,
  band,
  bandReason,
  size = 'medium',
}: {
  readonly id: string;
  readonly label: string;
  readonly unit: string;
  readonly accessibleName: string;
  readonly solved: Solved<number>;
  readonly format: (value: number) => string;
  readonly band: ((band: Band) => string) | null;
  readonly bandReason: string;
  readonly size?: TransferValueSize;
}): TransferValue {
  if (solved.kind === 'notMeasured') {
    return missingValue(
      id,
      label,
      unit,
      accessibleName,
      missingRefusal(label, solved.missing),
      size,
    );
  }
  if (solved.kind === 'undefined') {
    if (solved.reason === 'incompleteModel') {
      return missingValue(
        id,
        label,
        unit,
        accessibleName,
        missingRefusal(label, solved.inputs),
        size,
      );
    }
    return undefinedValue(
      id,
      label,
      unit,
      accessibleName,
      undefinedRefusal(label, solved.reason),
      size,
    );
  }

  const bandText =
    band === null || solved.band === null ? null : band(solved.band);
  return {
    id,
    label,
    value: format(solved.value),
    unit,
    provenance: provenanceForSolved(solved),
    band: bandText,
    bandReason,
    accessibleName,
    size,
  };
}

function forceText(solved: Solved<number>): string {
  return solved.kind === 'defined' ? formatForce(solved.value, 2) : 'not computable';
}

function percentText(solved: Solved<number>): string {
  return solved.kind === 'defined' ? formatPercent(solved.value, 1) : 'not computable';
}

function absentDiagram(lateralG: number, reason: string): LoadDiagramView {
  const gLabel = formatLateralG(lateralG, 1);
  const wheel = (
    key: LoadDiagramAxle['wheels'][number]['key'],
    label: string,
    position: 'left' | 'right',
    role: 'inner' | 'outer',
  ): LoadDiagramAxle['wheels'][number] => ({
    key,
    label,
    position,
    role,
    loadText: 'not computable',
    shareText: reason,
  });
  const axle = (
    kind: 'front' | 'rear',
    label: string,
  ): LoadDiagramAxle => ({
    axle: kind,
    label,
    wheels:
      kind === 'front'
        ? [
            wheel('LF', 'Front left', 'left', 'inner'),
            wheel('RF', 'Front right', 'right', 'outer'),
          ]
        : [
            wheel('LR', 'Rear left', 'left', 'inner'),
            wheel('RR', 'Rear right', 'right', 'outer'),
          ],
  });
  return {
    gLabel,
    axles: [axle('front', 'Front'), axle('rear', 'Rear')],
    note: reason,
    description: `${reason} Per-wheel loads at ${gLabel}.`,
  };
}

function absentPage(
  lateralG: number,
  longitudinalG: number,
  reason: string,
): TransferPageData {
  const gLabel = formatLateralG(lateralG, 1);
  const brakingLabel = formatLateralG(longitudinalG, 1);
  return {
    lateralG,
    lateralGValue: {
      id: 'lateral-g',
      label: 'Lateral acceleration',
      value: formatFixedNumber(lateralG, 1),
      unit: 'g',
      provenance: 'computed',
      band: null,
      bandReason: 'an analysis input, not a car measurement',
      accessibleName: 'Lateral acceleration',
      size: 'medium',
    },
    hero: missingValue(
      'front-load-transfer-share',
      'Front load-transfer share',
      '%',
      'Front load-transfer share',
      reason,
      'hero',
    ),
    diagram: absentDiagram(lateralG, reason),
    loads: [
      missingValue('front-axle-transfer', 'Front axle transfer', 'N', 'Front axle transfer', reason),
      missingValue('rear-axle-transfer', 'Rear axle transfer', 'N', 'Rear axle transfer', reason),
      missingValue(
        'total-load-transfer',
        'Total load transfer (TLLT)',
        'N',
        'Total load transfer (TLLT)',
        reason,
      ),
    ],
    roll: [
      missingValue('roll-moment-arm', 'Roll moment arm', 'mm', 'Roll moment arm', reason),
      missingValue('roll-moment', `Roll moment at ${gLabel}`, 'N·m', 'Roll moment at the current lateral g', reason),
      missingValue('roll-angle', `Roll angle at ${gLabel}`, '°', 'Roll angle at the current lateral g', reason),
      missingValue('roll-sensitivity', 'Chassis roll sensitivity', '°/g', 'Chassis roll sensitivity', reason),
    ],
    longitudinal: {
      antiDive: missingValue('anti-dive', 'Anti-dive · front', '%', 'Front anti-dive', reason),
      antiSquat: missingValue('anti-squat', 'Anti-squat · rear', '%', 'Rear anti-squat', reason),
      chart: null,
      chartRefusal: reason,
      brakingLabel,
      accelerationLabel: brakingLabel,
    },
    cg: {
      height: missingValue('cg-height', 'CG height above ground', 'mm', 'CG height above ground', reason),
      route: 'not established',
      routeDetail: reason,
    },
    rollShare: missingValue(
      'front-roll-stiffness-share',
      'Front roll-stiffness share',
      '%',
      'Front roll-stiffness share',
      reason,
    ),
    sharesNote:
      'The load-transfer share and the roll-stiffness share are different quantities; they are not interchangeable.',
  };
}

function buildDiagram(result: LoadTransferResult, lateralG: number): LoadDiagramView {
  const front: LoadDiagramAxle = {
    axle: 'front',
    label: 'Front',
    wheels: [
      {
        key: 'LF',
        label: 'Front left',
        position: 'left',
        role: 'inner',
        loadText: forceText(result.frontWheel.inner),
        shareText: percentText(result.frontWheel.innerShareOfStatic),
      },
      {
        key: 'RF',
        label: 'Front right',
        position: 'right',
        role: 'outer',
        loadText: forceText(result.frontWheel.outer),
        shareText: percentText(result.frontWheel.outerShareOfStatic),
      },
    ],
  };
  const rear: LoadDiagramAxle = {
    axle: 'rear',
    label: 'Rear',
    wheels: [
      {
        key: 'LR',
        label: 'Rear left',
        position: 'left',
        role: 'inner',
        loadText: forceText(result.rearWheel.inner),
        shareText: percentText(result.rearWheel.innerShareOfStatic),
      },
      {
        key: 'RR',
        label: 'Rear right',
        position: 'right',
        role: 'outer',
        loadText: forceText(result.rearWheel.outer),
        shareText: percentText(result.rearWheel.outerShareOfStatic),
      },
    ],
  };
  const gLabel = formatLateralG(lateralG, 1);
  const description = [
    `Per-wheel loads at ${gLabel}.`,
    `Front left ${front.wheels[0].loadText}, ${front.wheels[0].shareText}.`,
    `Front right ${front.wheels[1].loadText}, ${front.wheels[1].shareText}.`,
    `Rear left ${rear.wheels[0].loadText}, ${rear.wheels[0].shareText}.`,
    `Rear right ${rear.wheels[1].loadText}, ${rear.wheels[1].shareText}.`,
    'ISO 8855: +y is left; at positive lateral g the load moves to the right wheels.',
  ].join(' ');
  return {
    gLabel,
    axles: [front, rear],
    note: 'ISO 8855: +y is left. At positive lateral g the loaded (outer) wheel is on the right.',
    description,
  };
}

function wheelValues(result: LoadTransferResult): readonly TransferValue[] {
  const wheels = [
    {
      id: 'wheel-lf',
      label: 'Front left wheel · inner',
      name: 'Front left wheel load',
      load: result.frontWheel.inner,
      share: result.frontWheel.innerShareOfStatic,
    },
    {
      id: 'wheel-rf',
      label: 'Front right wheel · outer',
      name: 'Front right wheel load',
      load: result.frontWheel.outer,
      share: result.frontWheel.outerShareOfStatic,
    },
    {
      id: 'wheel-lr',
      label: 'Rear left wheel · inner',
      name: 'Rear left wheel load',
      load: result.rearWheel.inner,
      share: result.rearWheel.innerShareOfStatic,
    },
    {
      id: 'wheel-rr',
      label: 'Rear right wheel · outer',
      name: 'Rear right wheel load',
      load: result.rearWheel.outer,
      share: result.rearWheel.outerShareOfStatic,
    },
  ] as const;

  const rows: TransferValue[] = [];
  for (const wheel of wheels) {
    rows.push(
      solvedValue({
        id: `${wheel.id}-load`,
        label: `${wheel.label} load`,
        unit: 'N',
        accessibleName: wheel.name,
        solved: wheel.load,
        format: (value) => formatFixedNumber(value, 2),
        band: (band) => formatForceBand(band, 2),
        bandReason: 'the CG-height range moves every wheel load',
      }),
    );
    rows.push(
      solvedValue({
        id: `${wheel.id}-share`,
        label: `${wheel.label} share of static`,
        unit: '%',
        accessibleName: `${wheel.name} share of static`,
        solved: wheel.share,
        format: (value) => formatFixedNumber(value * 100, 1),
        band: (band) => formatPercentagePointBand(band, 1),
        bandReason: 'the CG-height range moves the wheel-load share',
      }),
    );
  }
  return rows;
}

function buildRollValues(
  model: CarModelDocument,
  result: LoadTransferResult,
  lateralG: number,
): { readonly values: readonly TransferValue[]; readonly frontShare: TransferValue } {
  const gLabel = formatLateralG(lateralG, 1);
  const values: TransferValue[] = [
    solvedValue({
      id: 'roll-moment-arm',
      label: 'Roll moment arm',
      unit: 'mm',
      accessibleName: 'Roll moment arm',
      solved: result.rollMomentArm,
      format: (value) => formatLengthFromMetresValue(value, 3),
      band: (band) => formatBandFromMetres(band),
      bandReason: 'the CG-height range moves the arm',
    }),
    solvedValue({
      id: 'roll-moment',
      label: `Roll moment at ${gLabel}`,
      unit: 'N·m',
      accessibleName: 'Roll moment at the current lateral g',
      solved: result.rollMoment,
      format: (value) => formatFixedNumber(value, 3),
      band: (band) => formatMomentBand(band, 3),
      bandReason: 'the CG-height range moves the roll moment',
    }),
    solvedValue({
      id: 'roll-angle',
      label: `Roll angle at ${gLabel}`,
      unit: '°',
      accessibleName: 'Roll angle at the current lateral g',
      solved: result.rollAngle,
      format: (value) => formatAngleRadiansValue(value, 3),
      band: (band) => formatAngleBand(band, 2),
      bandReason: 'the CG-height range moves the roll angle',
    }),
    solvedValue({
      id: 'roll-sensitivity',
      label: 'Chassis roll sensitivity',
      unit: '°/g',
      accessibleName: 'Chassis roll sensitivity',
      solved: result.rollSensitivity_degPerG,
      format: (value) => formatFixedNumber(value, 1),
      band: (band) => formatRollSensitivityBand(band, 1),
      bandReason: 'the CG-height range moves the sensitivity',
    }),
  ];

  const rollInput = buildRollStiffnessInput(model);
  const roll = rollInput.ok ? solveRollStiffness(rollInput.value) : null;
  const frontShare =
    roll === null
      ? missingValue(
          'front-roll-stiffness-share',
          'Front roll-stiffness share',
          '%',
          'Front roll-stiffness share',
          missingRefusal(
            'The roll-stiffness share',
            rollInput.ok ? [] : rollInput.errors.map((error) => error.path),
          ),
        )
      : solvedValue({
          id: 'front-roll-stiffness-share',
          label: 'Front roll-stiffness share',
          unit: '%',
          accessibleName: 'Front roll-stiffness share',
          solved: roll.frontShare,
          format: (value) => formatFrontShareValue(value, 1),
          band: null,
          bandReason: 'the roll solve stores no share tolerance',
        });

  return { values, frontShare };
}

function buildLongitudinal(
  model: CarModelDocument,
  longitudinalG: number,
): TransferPageData['longitudinal'] {
  const acceleration = gravitiesToMetresPerSecondSquared(longitudinalG);
  const brakingLabel = formatLateralG(longitudinalG, 1);
  const antiDiveInput = buildAntiDiveInput(model, -acceleration);
  const antiDive =
    antiDiveInput.ok
      ? solvedValue({
          id: 'anti-dive',
          label: 'Anti-dive · front',
          unit: '%',
          accessibleName: 'Front anti-dive',
          solved: solveAntiDive(antiDiveInput.value).front.percent,
          format: (value) => formatSignedNumber(value, 2),
          band: (band) => formatPercentagePointBand(band, 2),
          bandReason: `evaluated at the traction limit, ${brakingLabel} braking`,
        })
      : missingValue(
          'anti-dive',
          'Anti-dive · front',
          '%',
          'Front anti-dive',
          missingRefusal(
            'Anti-dive',
            antiDiveInput.errors.map((error) => error.path),
          ),
        );

  const antiSquatInput = buildAntiDiveInput(model, acceleration);
  const antiSquat =
    antiSquatInput.ok
      ? solvedValue({
          id: 'anti-squat',
          label: 'Anti-squat · rear',
          unit: '%',
          accessibleName: 'Rear anti-squat',
          solved: solveAntiDive(antiSquatInput.value).rear.percent,
          format: (value) => formatSignedNumber(value, 2),
          band: (band) => formatPercentagePointBand(band, 2),
          bandReason: `evaluated at the traction limit, ${brakingLabel} acceleration`,
        })
      : missingValue(
          'anti-squat',
          'Anti-squat · rear',
          '%',
          'Rear anti-squat',
          missingRefusal(
            'Anti-squat',
            antiSquatInput.errors.map((error) => error.path),
          ),
        );

  const curveInput = buildAntiDiveInput(model, 0);
  const chart = curveInput.ok ? buildAntiDiveChart(solveAntiDiveCurve(curveInput.value)) : null;
  const chartRefusal = curveInput.ok
    ? null
    : (() => {
        const refs = curveInput.errors.map((error) => error.path);
        return `The curve needs ${missingCopy(refs)}. ${missingAdvice(refs)}`;
      })();

  return {
    antiDive,
    antiSquat,
    chart,
    chartRefusal,
    brakingLabel,
    accelerationLabel: brakingLabel,
  };
}

export function buildTransferPage(
  model: CarModelDocument,
  lateralG: number,
  longitudinalG: number,
): TransferPageData {
  const acceleration = gravitiesToMetresPerSecondSquared(lateralG);
  const loadInput = buildLoadTransferInput(model, acceleration);
  if (!loadInput.ok) {
    return absentPage(
      lateralG,
      longitudinalG,
      missingRefusal(
        'Load transfer',
        loadInput.errors.map((error) => error.path),
      ),
    );
  }

  const result = solveLoadTransfer(loadInput.value);
  const hero = solvedValue({
    id: 'front-load-transfer-share',
    label: 'Front load-transfer share',
    unit: '%',
    accessibleName: 'Front load-transfer share',
    solved: result.balance,
    format: (value) => formatFixedNumber(value * 100, 2),
    band: (band) => formatPercentagePointBand(band, 2),
    bandReason: 'the CG-height range moves the share by ±0.13 percentage points',
    size: 'hero',
  });

  const axleLoads: TransferValue[] = [
    solvedValue({
      id: 'front-axle-transfer',
      label: 'Front axle transfer',
      unit: 'N',
      accessibleName: 'Front axle transfer',
      solved: result.front.total,
      format: (value) => formatFixedNumber(value, 2),
      band: null,
      bandReason: 'the axle total carries no separate tolerance',
    }),
    solvedValue({
      id: 'rear-axle-transfer',
      label: 'Rear axle transfer',
      unit: 'N',
      accessibleName: 'Rear axle transfer',
      solved: result.rear.total,
      format: (value) => formatFixedNumber(value, 2),
      band: null,
      bandReason: 'the axle total carries no separate tolerance',
    }),
    solvedValue({
      id: 'total-load-transfer',
      label: 'Total load transfer (TLLT)',
      unit: 'N',
      accessibleName: 'Total load transfer (TLLT)',
      solved: result.totalLateralLoadTransfer,
      format: (value) => formatFixedNumber(value, 2),
      band: (band) => formatForceBand(band, 2),
      bandReason: 'the CG-height range moves the whole-car transfer',
    }),
  ];

  const roll = buildRollValues(model, result, lateralG);
  const longitudinal = buildLongitudinal(model, longitudinalG);
  const cgHeight = solvedValue({
    id: 'cg-height',
    label: 'CG height above ground',
    unit: 'mm',
    accessibleName: 'CG height above ground',
    solved: result.cgHeight,
    format: (value) => formatLengthFromMetresValue(value, 1),
    band: (band) => formatBandFromMetres(band),
    bandReason: 'the route states this range',
  });

  const route = formatCgRoute(result.cgRoute);
  const routeDetail =
    result.cgRoute === 'raise_and_weigh'
      ? 'Measured with the raised-axle, two-scale procedure.'
      : result.cgRoute === 'component_mass_moment'
        ? 'Estimated from the component masses and heights.'
        : 'No measurement or component table is stored, so the stated default is used.';

  return {
    lateralG,
    lateralGValue: {
      id: 'lateral-g',
      label: 'Lateral acceleration',
      value: formatFixedNumber(lateralG, 1),
      unit: 'g',
      provenance: 'computed',
      band: null,
      bandReason: 'an analysis input, not a car measurement',
      accessibleName: 'Lateral acceleration',
      size: 'medium',
    },
    hero,
    diagram: buildDiagram(result, lateralG),
    loads: [...axleLoads, ...wheelValues(result)],
    roll: roll.values,
    longitudinal,
    cg: {
      height: cgHeight,
      route,
      routeDetail,
    },
    rollShare: roll.frontShare,
    sharesNote:
      'The front load-transfer share is the share of the whole-car transfer on the front axle. The front roll-stiffness share is the front axle’s share of the elastic roll stiffness. They are different quantities; do not compare them as if they were the same number.',
  };
}
