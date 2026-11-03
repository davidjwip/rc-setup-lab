import type { Confidence } from '@setuplab/physics';

export type CornerKey = 'LF' | 'RF' | 'LR' | 'RR';
export type SourceType = Confidence;

export interface SourceRecord {
  readonly type: SourceType;
  readonly method?: string;
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

export interface CornerDocument {
  readonly armType: ArmTypeDocument;
  readonly points: Partial<Record<CornerPointKey, MeasuredPoint>>;
}

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
  readonly track: MeasuredValue<number>;
  readonly tyreRadius: MeasuredValue<number> | null;
  readonly bumpLimit: MeasuredValue<number> | null;
  readonly droopLimit: MeasuredValue<number> | null;
  readonly springRate: MeasuredValue<number> | null;
  readonly arb: ArbDocument | null;
}

export type FrontAxleDocument = AxleDocument;

export interface MassDocument {
  readonly sprungFront: MeasuredValue<number> | null;
  readonly sprungRear: MeasuredValue<number> | null;
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
  readonly corners: Partial<Record<CornerKey, CornerDocument>>;
  readonly axles: {
    readonly front: AxleDocument;
    readonly rear: AxleDocument | null;
  };
  readonly mass: MassDocument;
  readonly raw: unknown;
}
