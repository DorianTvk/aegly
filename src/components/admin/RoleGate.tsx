import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import { readSession } from "@/lib/session";
import type { Role } from "@/lib/permissions";

async function Gate({ allow, children }: { allow: Role[]; children: ReactNode }) {
  const session = await readSession();
  if (session && allow.includes(session.user.role)) return <>{children}</>;
  return (
    <div className="mx-auto mt-16 max-w-[440px] rounded-[14px] border border-line bg-white p-8 text-center">
      <span className="mx-auto grid size-11 place-items-center rounded-full bg-line-soft text-muted">
        <Lock size={20} aria-hidden />
      </span>
      <h1 className="mt-4 text-[18px] font-semibold">Sul pole sellele lehele ligipääsu</h1>
      <p className="mt-1.5 text-sm text-muted">Selle osa haldamiseks küsi konto omanikult või administraatorilt.</p>
      <Link href="/toolaud" className="mt-5 inline-flex h-10 items-center rounded-[10px] bg-ink px-4 text-sm font-semibold text-white">
        Tagasi töölauale
      </Link>
    </div>
  );
}

/** Lehe sisu ainult lubatud rollidele (kasuta segmendi layout.tsx-is) */
export function RoleGate({ allow, children }: { allow: Role[]; children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <Gate allow={allow}>{children}</Gate>
    </Suspense>
  );
}
