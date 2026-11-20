/** Puhtad abifunktsioonid väljuvate teavituste jaoks (testitavad) */

/** "+372 5123 4567", "5123 4567", "003725123..." → "+37251234567"; vigane → null */
export function normalizePhone(raw: string | null | undefined, defaultCc = "372"): string | null {
  if (!raw) return null;
  let p = raw.replace(/[\s\-().]/g, "");
  if (p.startsWith("00")) p = "+" + p.slice(2);
  if (!p.startsWith("+")) p = `+${defaultCc}${p.replace(/^0+/, "")}`;
  return /^\+\d{7,15}$/.test(p) ? p : null;
}

/** SMS-i saatja nimi: kuni 11 tähte/numbrit (operaatorite nõue), muidu "Aegly" */
export function smsSenderName(name: string | null | undefined): string {
  const s = (name ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]/g, "").slice(0, 11);
  return /[A-Za-z]/.test(s) ? s : "Aegly";
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Mallitekst → lihtne, kõigis postiprogrammides töötav HTML-kiri salongi värviga. Lingid muutuvad klikitavaks. */
export function emailHtml(opts: { body: string; salon: string; color: string; logoUrl?: string | null; footer?: string }): string {
  const color = /^#[0-9a-f]{3,8}$/i.test(opts.color) ? opts.color : "#1f2937";
  const paragraphs = opts.body
    .split(/\n{2,}/)
    .map((p) =>
      esc(p)
        .replace(/(https?:\/\/[^\s<]+)/g, (u) => `<a href="${u}" style="color:${color};font-weight:600">${u.length > 60 ? "Ava link" : u}</a>`)
        .replace(/\n/g, "<br>"),
    )
    .map((p) => `<p style="margin:0 0 16px">${p}</p>`)
    .join("");
  const logo = opts.logoUrl
    ? `<img src="${esc(opts.logoUrl)}" alt="${esc(opts.salon)}" height="40" style="display:block;height:40px;border-radius:8px">`
    : `<span style="font-size:18px;font-weight:700;color:#1f2937">${esc(opts.salon)}</span>`;
  return `<!doctype html><html lang="et"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;background:#f3f4f6;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2937">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="height:6px;background:${color}"></td></tr>
<tr><td style="padding:24px 28px 8px">${logo}</td></tr>
<tr><td style="padding:16px 28px 12px;font-size:15px;line-height:1.6">${paragraphs}</td></tr>
</table>
<p style="margin:16px 0 0;font-size:12px;color:#6b7280">${esc(opts.footer ?? "Broneeringusüsteem: Aegly")}</p>
</td></tr></table></body></html>`;
}

/** "Kadri Tamm" → "Kadri" */
export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/**
 * Aegly enda kontokirjad (kinnitus, parooli taastamine, kutse): pealkiri, lühike tekst,
 * suur nupp ja varulink. Tabelipõhine, et töötaks ka Outlookis ja Gmaili rakenduses.
 */
export function accountEmailHtml(opts: {
  preheader: string;
  heading: string;
  greeting: string;
  intro: string;
  cta: { label: string; url: string };
  note: string;
}): string {
  const url = esc(opts.cta.url);
  const p = (t: string) => esc(t).replace(/\n/g, "<br>");
  return `<!doctype html><html lang="et"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><title>${esc(opts.heading)}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;-webkit-font-smoothing:antialiased">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(opts.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6"><tr><td align="center" style="padding:40px 16px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px">
    <tr><td style="padding:0 4px 20px">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td width="32" height="32" align="center" valign="middle" style="width:32px;height:32px;background:#a3e635;border-radius:9px;font-size:16px;font-weight:800;color:#1f2937;line-height:32px">A</td>
        <td style="padding-left:10px;font-size:18px;font-weight:700;color:#1f2937;letter-spacing:-0.2px">Aegly</td>
      </tr></table>
    </td></tr>
    <tr><td style="background:#ffffff;border-radius:16px;border:1px solid #e5e7eb;padding:36px 32px">
      <h1 style="margin:0 0 20px;font-size:22px;line-height:1.3;font-weight:700;letter-spacing:-0.3px;color:#111827">${esc(opts.heading)}</h1>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6">${p(opts.greeting)}</p>
      <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:#374151">${p(opts.intro)}</p>
      <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:10px;background:#1f2937">
        <a href="${url}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px">${esc(opts.cta.label)}</a>
      </td></tr></table>
      <p style="margin:28px 0 0;font-size:13px;line-height:1.6;color:#6b7280">${p(opts.note)}</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 16px">
      <p style="margin:0;font-size:12px;line-height:1.6;color:#9ca3af">Kui nupp ei tööta, kopeeri see aadress brauserisse:<br>
        <a href="${url}" style="color:#6b7280;word-break:break-all">${url}</a></p>
    </td></tr>
    <tr><td align="center" style="padding:20px 4px 0;font-size:12px;line-height:1.6;color:#9ca3af">Aegly · broneerimissüsteem teenusepakkujatele</td></tr>
  </table>
</td></tr></table></body></html>`;
}

