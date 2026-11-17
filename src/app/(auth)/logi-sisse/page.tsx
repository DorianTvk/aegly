import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import { LoginForm } from "../AuthForms";

export const metadata: Metadata = { title: "Logi sisse" };

async function Form({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  // juba sisse logitud (kehtiv sessioon) → otse töölauale
  if (await readSession()) redirect("/toolaud");
  const { next } = await searchParams;
  return <LoginForm next={next} />;
}

export default function LoginPage(props: PageProps<"/logi-sisse">) {
  return (
    <>
      <h1 className="text-[26px] font-bold tracking-[-0.4px]">Tere tulemast tagasi</h1>
      <p className="mt-1 mb-8 text-sm text-muted">Logi sisse, et hallata broneeringuid.</p>
      <Suspense fallback={<LoginForm />}>
        <Form searchParams={props.searchParams as Promise<{ next?: string }>} />
      </Suspense>
    </>
  );
}
