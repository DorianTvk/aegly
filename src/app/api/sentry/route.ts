/**
 * Sentry tunnel: brauseri veateated käivad meie domeeni kaudu (reklaamiblokeerijad ei peata).
 * Edastame ainult meie enda Sentry projekti.
 */
export async function POST(req: Request) {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return new Response(null, { status: 204 });
  const body = await req.text();
  if (body.length > 1_000_000) return new Response(null, { status: 413 });
  let header: { dsn?: string };
  try {
    header = JSON.parse(body.split("\n")[0]);
  } catch {
    return new Response(null, { status: 400 });
  }
  const want = new URL(dsn);
  const got = header.dsn ? new URL(header.dsn) : null;
  if (!got || got.host !== want.host || got.pathname !== want.pathname) return new Response(null, { status: 400 });
  const projectId = want.pathname.replace(/\//g, "");
  const res = await fetch(`${want.protocol}//${want.host}/api/${projectId}/envelope/`, { method: "POST", body, headers: { "Content-Type": "application/x-sentry-envelope" } });
  return new Response(null, { status: res.status });
}
