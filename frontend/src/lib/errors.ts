// Shared error-message extraction for user-friendly toasts/alerts.
// Handles: axios network errors (server down), class-validator arrays,
// nested response messages, and plain Error objects.

interface Axiosish {
  response?: { status?: number; data?: { message?: unknown; error?: unknown } };
  request?: unknown;
  code?: string;
  message?: string;
}

/**
 * Returns a clean, human-readable message for any error shape.
 * @param err     the caught error (axios error, Error, string, unknown)
 * @param fallback message to use when nothing better can be extracted
 */
export function getErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (!err) return fallback;
  if (typeof err === 'string') return err;

  const e = err as Axiosish;

  // No response received → network / server-down / timeout
  if (e.response === undefined && (e.request !== undefined || e.code)) {
    if (e.code === 'ECONNABORTED') return 'The request timed out. Please try again.';
    return 'Cannot reach the server. Please check that it is running and try again.';
  }

  // Server responded with an error payload
  const data = e.response?.data;
  if (data) {
    const msg = data.message ?? data.error;
    if (Array.isArray(msg)) return String(msg[0] ?? fallback);   // class-validator returns string[]
    if (typeof msg === 'string' && msg.trim()) return msg;
  }

  // Map common status codes to friendly text when no message was provided
  const status = e.response?.status;
  if (status === 401) return 'Your session has expired. Please log in again.';
  if (status === 403) return 'You do not have permission to do that.';
  if (status === 404) return 'The requested item was not found.';
  if (status === 409) return 'This conflicts with existing data.';
  if (status && status >= 500) return 'The server ran into a problem. Please try again shortly.';

  if (typeof e.message === 'string' && e.message.trim()) return e.message;
  return fallback;
}

/** True when the error is a network/server-unreachable failure (no HTTP response). */
export function isNetworkError(err: unknown): boolean {
  const e = err as Axiosish;
  return !!e && e.response === undefined && (e.request !== undefined || !!e.code);
}
