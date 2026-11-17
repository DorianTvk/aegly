import type { Metadata } from "next";
import { RegisterForm } from "../AuthForms";

export const metadata: Metadata = { title: "Loo konto" };

export default function RegisterPage() {
  return (
    <>
      <h1 className="text-[26px] font-bold tracking-[-0.4px]">Loo Aegly konto</h1>
      <p className="mt-1 mb-8 text-sm text-muted">Seadista oma salong ja võta broneeringuid vastu oma kodulehel.</p>
      <RegisterForm />
    </>
  );
}
