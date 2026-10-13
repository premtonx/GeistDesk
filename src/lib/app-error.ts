/**
 * Typed application error carrying an HTTP status and a stable error code.
 * Thrown by route handlers / domain services and mapped to responses by the
 * global error middleware, so clients never see raw stack traces.
 */

export type AppErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION_FAILED'
  | 'RATE_LIMITED'
  | 'UNPROCESSABLE_ENTITY'
  | 'INTERNAL';

const STATUS_TO_CODE: Record<number, AppErrorCode> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'VALIDATION_FAILED',
  429: 'RATE_LIMITED',
};

export class AppError extends Error {
  readonly status: number;
  readonly code: AppErrorCode;
  readonly details?: unknown;
  readonly expose: boolean;

  constructor(
    message: string,
    options: {
      status?: number;
      code?: AppErrorCode;
      details?: unknown;
      /** When false the message is only logged; the client gets a generic message. Default true for 4xx, false for 5xx. */
      expose?: boolean;
    } = {},
  ) {
    super(message);
    this.name = 'AppError';
    this.status = options.status ?? 500;
    this.code = options.code ?? STATUS_TO_CODE[this.status] ?? 'INTERNAL';
    this.details = options.details;
    this.expose = options.expose ?? this.status < 500;
  }
}

/** True when the error is an {@link AppError}. */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Normalize an arbitrary thrown value into a safe, client-visible payload.
 * Never leaks internal message text for 5xx errors.
 */
export function toPublicError(error: unknown): {
  status: number;
  body: { error: string; code?: string; details?: unknown };
} {
  if (isAppError(error)) {
    return {
      status: error.status,
      body: {
        error: error.expose ? error.message : 'Internal server error',
        code: error.code,
        ...(error.details !== undefined ? { details: error.details } : {}),
      },
    };
  }
  return { status: 500, body: { error: 'Internal server error', code: 'INTERNAL' } };
}
