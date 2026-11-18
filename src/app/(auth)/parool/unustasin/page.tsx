import type { Metadata } from "next";
import { ForgotForm } from "../../AuthForms";

export const metadata: Metadata = { title: "Unustasid parooli?" };

export default function ForgotPage() {
  return (
    <>
      <h1 className="text-[26px] font-bold tracking-[-0.4px]">Unustasid parooli?</h1>
      <p className="mt-1 mb-8 text-sm text-muted">Sisesta oma e-post ja saadame lingi uue parooli määramiseks.</p>
      <ForgotForm siteKey={process.env.TURNSTILE_SITE_KEY || null} />
    </>
  );
}
