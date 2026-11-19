import * as Sentry from "@sentry/nextjs";

/**
 * Käsitletud viga (kasutaja sai sõbraliku teate), mida peame siiski nägema:
 * logi + Sentry (kui seadistatud). Ilma isikuandmeteta – ainult silt ja lisainfo id-d.
 */
export function reportError(where: string, error: unknown, extra?: Record<string, string | number | null | undefined>) {
  console.error(`[${where}]`, error);
  Sentry.captureException(error, { tags: { where }, extra });
}
