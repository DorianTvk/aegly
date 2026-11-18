import type { Metadata } from "next";
import { Suspense } from "react";
import { parsePeriod, parsePlan } from "@/lib/plans";
import { RegisterForm } from "../AuthForms";

export const metadata: Metadata = { title: "Loo konto" };

/** Müügilehelt tullakse kujul /registreeru?pakett=solo&periood=year */
async function Form({ searchParams }: { searchParams: Promise<{ pakett?: string; periood?: string }> }) {
  const { pakett, periood } = await searchParams;
  return <RegisterForm defaultPlan={parsePlan(pakett)} defaultPeriod={parsePeriod(periood)} siteKey={process.env.TURNSTILE_SITE_KEY || null} />;
}

export default function RegisterPage(props: PageProps<"/registreeru">) {
  return (
    <>
      <h1 className="text-[26px] font-bold tracking-[-0.4px]">Loo Aegly konto</h1>
      <p className="mt-1 mb-8 text-sm text-muted">Seadista oma salong ja võta broneeringuid vastu oma kodulehel.</p>
      <Suspense fallback={<RegisterForm />}>
        <Form searchParams={props.searchParams as Promise<{ pakett?: string; periood?: string }>} />
      </Suspense>
    </>
  );
}
