import type { Response } from "express";

let _counter = 0;

/** Generate a short, monotonically increasing request ID for tracing. */
export function makeRequestId(): string {
  return `req_${Date.now().toString(36)}_${(++_counter).toString(36)}`;
}

/**
 * Standard error shape as defined in docs/API.md.
 *
 * All non-2xx responses use:
 * ```json
 * { "error": { "code": "...", "message": "...", "requestId": "..." } }
 * ```
 */
export function sendError(
  res: Response,
  status: number,
  code: string,
  message: string,
): void {
  res.status(status).json({
    error: {
      code,
      message,
      requestId: makeRequestId(),
    },
  });
}
