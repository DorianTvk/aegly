import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

/** Kustutab kehtetu sessiooniküpsise ja suunab sisselogimisele */
export async function GET(req: Request) {
  const res = NextResponse.redirect(new URL("/logi-sisse", req.url));
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
