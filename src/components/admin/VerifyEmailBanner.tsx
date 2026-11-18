import { readSession } from "@/lib/session";
import { ResendVerifyButton } from "./ResendVerifyButton";

/** Riba halduspaneeli ülaosas, kuni kasutaja e-post on kinnitamata */
export async function VerifyEmailBanner() {
  const session = await readSession();
  if (!session || session.user.emailVerifiedAt) return null;
  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-3 border-b border-[#fedf89] bg-[#fffaeb] px-8 py-2.5 text-sm text-[#93370d]">
      <span>
        Kinnita oma e-post: saatsime lingi aadressile <b>{session.user.email}</b>. Kinnitamata kontole ei saa parooli taastada.
      </span>
      <ResendVerifyButton />
    </div>
  );
}
