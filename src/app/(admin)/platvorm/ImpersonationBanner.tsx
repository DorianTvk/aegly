import { Eye } from "lucide-react";
import { isImpersonating, stopImpersonation } from "./manage-actions";

/** Riba lehe ülaosas, kui superadmin on salongi kontole sisenenud */
export async function ImpersonationBanner() {
  const imp = await isImpersonating();
  if (!imp) return null;
  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-3 bg-[#7a2e0e] px-4 py-2.5 lg:px-8 text-sm text-white">
      <span className="flex items-center gap-2">
        <Eye size={16} aria-hidden /> Oled kliendi <b>{imp.businessName}</b> kontol platvormi haldurina. Muudatused salvestuvad päriselt.
      </span>
      <form action={stopImpersonation}>
        <button type="submit" className="h-8 rounded-lg bg-white px-3 text-[13px] font-semibold text-[#7a2e0e]">
          Lõpeta ja naase platvormile
        </button>
      </form>
    </div>
  );
}
