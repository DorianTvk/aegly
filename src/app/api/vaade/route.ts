import { NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { isSuperadmin } from "@/lib/plans";
import { VIEW_COOKIE } from "@/lib/platform-mode";

/** Platvormi halduri vaate vahetus: ?m=salon (oma demosalong) või ?m=platvorm */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const session = await readSession();
  if (!session || !isSuperadmin(session.user.email)) return NextResponse.redirect(new URL("/toolaud", url));
  const salon = url.searchParams.get("m") === "salon";
  const res = NextResponse.redirect(new URL(salon ? "/toolaud" : "/platvorm", url));
  res.cookies.set(VIEW_COOKIE, salon ? "salon" : "platform", { path: "/", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 365 });
  return res;
}
