import { NextResponse, type NextRequest } from "next/server";

// Optimistlik kontroll: ilma sessiooniküpsiseta suuname sisselogimisele.
// Päris kontroll (kehtivus, ettevõte) toimub serveris requireSession() kaudu.
const PUBLIC = ["/logi-sisse", "/registreeru"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = req.cookies.has("aegly_session");
  const isPublic = PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (!hasSession && !isPublic) {
    const url = new URL("/logi-sisse", req.url);
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (hasSession && isPublic) return NextResponse.redirect(new URL("/toolaud", req.url));
  return NextResponse.next();
}

export const config = {
  // vidin, API ja staatilised failid ei vaja halduspaneeli sessiooni
  matcher: ["/((?!api|w/|_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|jpg|jpeg|webp|ico|css|js|woff2?)$).*)"],
};
