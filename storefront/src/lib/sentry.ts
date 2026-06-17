import * as Sentry from '@sentry/nextjs';

export function initSentryClient() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.05,
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0.0,
    integrations: [
      Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
    ],
  });
}

export function captureError(error: unknown, context?: Record<string, unknown>) {
  if (context) {
    Sentry.withScope(scope => {
      scope.setExtras(context);
      Sentry.captureException(error);
    });
  } else {
    Sentry.captureException(error);
  }
}
