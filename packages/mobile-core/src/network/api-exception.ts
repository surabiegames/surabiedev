/**
 * api-exception.ts — kesalahan API siap tampil ke pengguna.
 * Padanan `core/network/api_exception.dart`.
 *
 * `message` dari backend SELALU bahasa Indonesia dan layak tampil langsung
 * (kontrak envelope backend) — jangan menerjemahkan ulang atau menebak sebab
 * gagal login (pesan sengaja seragam, anti user-enumeration).
 */

/** Untuk VALIDATION_ERROR (422): satu entri {path, message} per field. */
export interface FieldError {
  path: string;
  message: string;
}

/** Kode mesin yang dikembalikan backend, plus NETWORK_ERROR buatan client. */
export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'UNKNOWN'
  | (string & {});

export class ApiException extends Error {
  /** HTTP status; 0 bila kegagalan jaringan (tidak sampai ke server). */
  readonly status: number;

  /** Kode mesin: BAD_REQUEST, VALIDATION_ERROR, RATE_LIMITED, dst. */
  readonly code: ApiErrorCode;

  /** Untuk VALIDATION_ERROR (422): daftar {path, message} per field. */
  readonly details?: FieldError[];

  constructor(
    status: number,
    code: ApiErrorCode,
    message: string,
    details?: FieldError[],
  ) {
    // `message` bawaan Error dipakai apa adanya — sudah bahasa Indonesia.
    super(message);
    this.name = 'ApiException';
    this.status = status;
    this.code = code;
    this.details = details;
    // Rantai prototype supaya `instanceof ApiException` tetap benar setelah
    // transpile ke target lama (pola baku subclass Error di TS).
    Object.setPrototypeOf(this, ApiException.prototype);
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isRateLimited(): boolean {
    return this.status === 429;
  }

  get isConflict(): boolean {
    return this.status === 409;
  }

  /** Type guard nyaman dipakai di blok catch (yang bertipe `unknown`). */
  static is(err: unknown): err is ApiException {
    return err instanceof ApiException;
  }
}

/** Bangun FieldError dari satu entri `details` mentah backend. */
export function fieldErrorFromJson(json: unknown): FieldError | null {
  if (json == null || typeof json !== 'object') return null;
  const raw = json as Record<string, unknown>;
  const message = raw['message'];
  if (typeof message !== 'string') return null;
  const path = raw['path'];
  return {
    path: Array.isArray(path) ? path.join('.') : `${path ?? ''}`,
    message,
  };
}
