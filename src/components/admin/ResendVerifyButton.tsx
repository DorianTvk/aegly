"use client";

import { useState, useTransition } from "react";
import { resendVerification } from "./account-actions";

export function ResendVerifyButton() {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return msg ? (
    <span className="text-[13px]">{msg}</span>
  ) : (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(async () => setMsg((await resendVerification()).message))}
      className="h-8 rounded-lg border border-[#fec84b] bg-white px-3 text-[13px] font-semibold disabled:opacity-50"
    >
      {pending ? "Saadan…" : "Saada uuesti"}
    </button>
  );
}
