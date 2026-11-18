"use client";

import { useEffect, useRef, useState } from "react";

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT}"]`);
  return new Promise((resolve, reject) => {
    const s = existing ?? Object.assign(document.createElement("script"), { src: SCRIPT, async: true, defer: true });
    s.addEventListener("load", () => resolve());
    s.addEventListener("error", () => reject(new Error("turnstile")));
    if (!existing) document.head.appendChild(s);
  });
}

/**
 * Robotikaitse vormis: peidetud lõksuväli + Cloudflare Turnstile (kui siteKey on olemas).
 * `resetKey` muutumisel (nt pärast ebaõnnestunud saatmist) küsitakse uus token – token on ühekordne.
 */
export function BotProtection({ siteKey, resetKey }: { siteKey?: string | null; resetKey?: unknown }) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!siteKey) return;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !box.current || !window.turnstile) return;
        widget.current = window.turnstile.render(box.current, {
          sitekey: siteKey,
          language: "et",
          theme: "light",
          size: "flexible",
          "response-field-name": "cf-turnstile-response",
        });
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (widget.current && window.turnstile) window.turnstile.remove(widget.current);
      widget.current = null;
    };
  }, [siteKey]);

  useEffect(() => {
    if (resetKey && widget.current && window.turnstile) window.turnstile.reset(widget.current);
  }, [resetKey]);

  return (
    <>
      {/* lõksuväli: ekraanilugejad ja klaviatuur jätavad vahele, robotid täidavad */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
        <label>
          Veebileht
          <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>
      {siteKey && <div ref={box} className="min-h-[65px]" />}
      {failed && <p className="text-[13px] text-bad">Turvakontrolli ei õnnestunud laadida. Kontrolli internetiühendust või lülita reklaamiblokeerija sellel lehel välja.</p>}
    </>
  );
}
