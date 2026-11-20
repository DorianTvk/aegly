import Link from "next/link";
import { readSession } from "@/lib/session";
import { billingEnabled } from "@/server/billing";

/** Riba halduspaneeli ülaosas, kui Aegly tellimus pole aktiivne */
export async function PlanBanner() {
  const session = await readSession();
  if (!session || !billingEnabled()) return null;
  const st = session.business.planStatus;
  if (st === "ACTIVE") return null;
  const owner = session.user.role === "OWNER";
  const text =
    st === "PAST_DUE"
      ? "Aegly tellimuse makse ebaõnnestus. Uuenda makseviisi, et vidin töötaks katkestusteta."
      : st === "SUSPENDED"
        ? "Aegly tellimus on lõppenud – broneerimisvidin ei võta broneeringuid vastu."
        : "Pakett on aktiveerimata – broneerimisvidin hakkab broneeringuid vastu võtma pärast esimest makset.";
  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-3 border-b border-[#fedf89] bg-[#fffaeb] px-4 py-2.5 text-sm text-[#93370d] lg:px-8">
      <span>{text}</span>
      {owner ? (
        <Link href="/seaded/pakett" className="rounded-lg bg-[#93370d] px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-[#7a2e0e]">
          {st === "PAST_DUE" ? "Uuenda makseviisi" : "Vali pakett"}
        </Link>
      ) : (
        <span className="text-[13px]">Palu konto omanikul pakett aktiveerida.</span>
      )}
    </div>
  );
}
