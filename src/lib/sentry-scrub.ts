/**
 * Sentryle ei saadeta isikuandmeid ega salajasi linke.
 * Kliendi broneeringu link /b/<token> annab õiguse broneeringut muuta – asendame tokeni.
 */
const TOKEN_PATH = /\/b\/[A-Za-z0-9_-]{10,}/g;
const scrub = (s: string | undefined) => s?.replace(TOKEN_PATH, "/b/[token]");

export function scrubEvent<T>(e: T): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const event = e as any;
  if (event.request?.url) event.request.url = scrub(event.request.url);
  if (event.transaction) event.transaction = scrub(event.transaction);
  for (const b of event.breadcrumbs ?? []) {
    if (b.message) b.message = scrub(b.message);
    if (b.data?.url) b.data.url = scrub(b.data.url);
    if (b.data?.to) b.data.to = scrub(b.data.to);
    if (b.data?.from) b.data.from = scrub(b.data.from);
  }
  return e;
}

/** Mida SDK kogub: mitte küpsiseid, päiseid, päringu kehasid ega automaatseid kasutajaandmeid */
export const DATA_COLLECTION = { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false } as const;
