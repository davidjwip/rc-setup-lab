export type DataErrorCode =
  | 'invalidJson'
  | 'invalidDocument'
  | 'missingField'
  | 'invalidValue'
  | 'missingSource'
  | 'unresolvedSource'
  | 'unitMismatch'
  | 'frameMismatch'
  | 'unsupportedSchemaVersion'
  | 'unsupportedArmType';

export interface DataError {
  readonly code: DataErrorCode;
  readonly path: string;
  readonly message: string;
}

export type DataResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly errors: readonly DataError[] };

export function ok<T>(value: T): DataResult<T> {
  return { ok: true, value };
}

export function fail<T>(errors: readonly DataError[]): DataResult<T> {
  return { ok: false, errors };
}

export function dataError(code: DataErrorCode, path: string, message: string): DataError {
  return { code, path, message };
}
