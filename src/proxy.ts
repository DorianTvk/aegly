import { NextResponse, type NextRequest } from "next/server";
import { GATE_COOKIE, gateEnabled, gateToken } from "@/lib/gate";

// Optimistlik kontroll: ilma sessiooniküpsiseta suuname sisselogimisele.
// Päris kontroll (kehtivus, ettevõte) toimub serveris requireSession() kaudu.
const PUBLIC = ["/logi-sisse", "/registreeru", "/parool", "/kinnita", "/kutse", "/tingimused", "/privaatsus", "/andmetootlus"];
// vidin (/w) ja kliendi broneeringu leht (/b) ei vaja halduspaneeli sessiooni
const NO_SESSION = ["/w/", "/b/", "/ligipaas"];

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // 1. Arendusaja pääsuparool kogu lehele (SITE_PASSWORD)
  if (gateEnabled() && pathname !== "/ligipaas") {
    if (req.cookies.get(GATE_COOKIE)?.value !== (await gateToken())) {
      // vidina skript/konfig: vasta 404, et teised lehed ei saaks HTML-i
      if (pathname === "/w/aegly.js" || pathname.endsWith("/config")) return new NextResponse(null, { status: 404 });
      const url = new URL("/ligipaas", req.url);
      if (pathname !== "/") url.searchParams.set("next", pathname + search);
      const res = NextResponse.redirect(url);
      res.headers.set("X-Robots-Tag", "noindex, nofollow");
      return res;
    }
  }

  // 2. Halduspaneel: ilma sessioonita → sisselogimine
  if (NO_SESSION.some((p) => pathname.startsWith(p))) return NextResponse.next();
  const hasSession = req.cookies.has("aegly_session");
  const isPublic = PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (!hasSession && !isPublic) {
    const url = new URL("/logi-sisse", req.url);
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  // NB: sisseloginud kasutajat ei suunata siin sisselogimislehelt ära – küpsis võib olla aegunud
  // (nt pärast andmebaasi uuesti seemendamist) ja see tekitaks lõputu ümbersuunamise.
  // Seda kontrollib sisselogimisleht ise päris sessiooni järgi.
  return NextResponse.next();
}

export const config = {
  // API (cron, Stripe'i webhook) ja staatilised failid jäävad väravast välja
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|robots.txt|manifest.webmanifest|.*\\.(?:png|svg|jpg|jpeg|webp|ico|css|woff2?)$).*)"],
};
