import * as Sentry from "@sentry/nextjs";
import { DATA_COLLECTION, scrubEvent } from "@/lib/sentry-scrub";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
    dataCollection: { ...DATA_COLLECTION, httpBodies: [] },
    beforeSend: (e) => scrubEvent(e),
    beforeSendTransaction: (e) => scrubEvent(e),
    tracesSampleRate: 0.05,
    // kuvasalvestust (replay) ei kasuta – klientide andmed jäävad ekraanile
    integrations: [],
    // reklaamiblokeerijatest mööda oma domeeni kaudu
    tunnel: "/api/sentry",
    ignoreErrors: [
      "NEXT_REDIRECT",
      // brauseri laienduste ja võrgukatkestuste müra
      "ResizeObserver loop",
      "Failed to fetch",
      "Load failed",
      "NetworkError when attempting to fetch resource",
    ],
    denyUrls: [/extensions\//i, /^chrome:\/\//i, /^moz-extension:\/\//i],
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
