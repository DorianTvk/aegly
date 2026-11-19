import * as Sentry from "@sentry/nextjs";
import { DATA_COLLECTION, scrubEvent } from "@/lib/sentry-scrub";

/**
 * Vigade jälgimine (Sentry). Töötab ainult, kui NEXT_PUBLIC_SENTRY_DSN on seadistatud.
 * Isikuandmeid (küpsised, IP, päringu keha) ei saadeta.
 */
export function register() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    dataCollection: { ...DATA_COLLECTION, httpBodies: [] },
    beforeSend: (e) => scrubEvent(e),
    beforeSendTransaction: (e) => scrubEvent(e),
    tracesSampleRate: 0.05,
    // Next'i suunamised ja "ei leitud" pole vead
    ignoreErrors: ["NEXT_REDIRECT", "NEXT_NOT_FOUND", "NEXT_HTTP_ERROR_FALLBACK"],
  });
}

export const onRequestError = Sentry.captureRequestError;
