import type { Confidence } from '@setuplab/physics';

export type CornerKey = 'LF' | 'RF' | 'LR' | 'RR';
export type SourceType = Confidence;

export interface SourceRecord {
  readonly type: SourceType;
  readonly method?: string;
  /** Free-text provenance note, e.g. why a modelled value was placed where it is. */
  readonly note?: string;
  readonly by?: string;
}

export interface Frame {
  readonly standard: string;
  readonly axes: string;
  readonly origin: string;
}

export interface MeasuredValue<T> {
  readonly value: T;
  readonly source: string;
  readonly confidence: Confidence;
}

export type Point3Mm = readonly [number, number, number];
export type MeasuredPoint = MeasuredValue<Point3Mm>;

export type CornerPointKey =
  | 'lca_in_a'
  | 'lca_in_b'
  | 'lca_out'
  | 'uca_in'
  | 'uca_in_a'
  | 'uca_in_b'
  | 'uca_out'
  | 'wc'
  | 'tie_in'
  | 'tie_out'
  | 'damper_lo'
  | 'damper_up'
  | 'arb_drop';

export interface ArmTypeDocument {
  readonly lower: 'hinge' | 'wishbone';
  readonly upper: 'single_link' | 'wishbone';
}

/**
 * The damping coefficient this slice edits. It lives at the canonical
 * `corners.<corner>.damper.c_post` path; the wheel-level damping ratio consumes
 * it directly (D-13, physics/07 (7.2)).
 */
export interface CornerDamperDocument {
  readonly cPost: MeasuredValue<number> | null;
}

export interface CornerDocument {
  readonly armType: ArmTypeDocument;
  /** Per-wheel static toe, positive = toe-in (D-17); never negated on mirror. */
  readonly toe: MeasuredValue<number> | null;
  readonly points: Partial<Record<CornerPointKey, MeasuredPoint>>;
  readonly damper: CornerDamperDocument | null;
}

export type AxleDerivedFrom = 'front';

export type SpringLocation = 'coilover_at_damper' | 'separate_seat' | 'inboard_rocker';

export type ArbTypeDocument = 'torsion_bar' | 'blade' | 'fixed' | 'none';

export interface ArbDocument {
  readonly type: ArbTypeDocument;
  readonly rateAtLink: MeasuredValue<number> | null;
  readonly blades: MeasuredValue<number> | null;
  readonly barDiameter: MeasuredValue<number> | null;
  readonly span: MeasuredValue<number> | null;
  readonly armLength: MeasuredValue<number> | null;
  readonly shearModulus: MeasuredValue<number> | null;
}

export interface AxleDocument {
  /** Present only when this axle's corner geometry is declared derived from another axle. */
  readonly derivedFrom: AxleDerivedFrom | null;
  readonly track: MeasuredValue<number>;
  readonly tyreRadius: MeasuredValue<number> | null;
  readonly bumpLimit: MeasuredValue<number> | null;
  readonly droopLimit: MeasuredValue<number> | null;
  /** Coaxial spring is the default because only `damper_lo`/`damper_up` are stored. */
  readonly springLocation: SpringLocation | null;
  readonly springRate: MeasuredValue<number> | null;
  readonly arb: ArbDocument | null;
}

export type FrontAxleDocument = AxleDocument;

export interface MassDocument {
  readonly total: MeasuredValue<number> | null;
  readonly sprungFront: MeasuredValue<number> | null;
  readonly sprungRear: MeasuredValue<number> | null;
  readonly unsprungFront: MeasuredValue<number> | null;
  readonly unsprungRear: MeasuredValue<number> | null;
}

/**
 * One row of the `body.cg.components[]` table. `mass` is grams and `height` is
 * the stored `z` in millimetres; the builder converts both to SI.
 */
export interface CgComponentDocument {
  readonly component: string;
  readonly mass: MeasuredValue<number>;
  readonly height: MeasuredValue<number>;
}

export interface CgDocument {
  readonly height: MeasuredValue<number> | null;
  readonly frontMassShare: MeasuredValue<number> | null;
  readonly unsprungHeight: MeasuredValue<number> | null;
  readonly components: readonly CgComponentDocument[] | null;
}

export interface CarModelDocument {
  readonly schemaVersion: string;
  readonly kind: 'car_model';
  readonly id: string;
  readonly name: string;
  readonly frame: Frame;
  readonly units: Readonly<Record<string, string>>;
  readonly symmetry: boolean;
  readonly sources: Readonly<Record<string, SourceRecord>>;
  readonly wheelbase: MeasuredValue<number> | null;
  /** Ground clearance under the bottom of the plate. Not the datum. */
  readonly referenceRideHeight: MeasuredValue<number> | null;
  /** Plate thickness; with ride height it locates the derived ground plane. */
  readonly chassisThickness: MeasuredValue<number> | null;
  readonly corners: Partial<Record<CornerKey, CornerDocument>>;
  readonly axles: {
    readonly front: AxleDocument;
    readonly rear: AxleDocument | null;
  };
  readonly mass: MassDocument;
  readonly cg: CgDocument;
  readonly raw: unknown;
}
