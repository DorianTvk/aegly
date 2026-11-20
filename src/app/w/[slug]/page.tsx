import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { loadWidget } from "@/server/widget";
import { detectLang, parseLang } from "../i18n";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { Widget } from "./Widget";

export async function generateMetadata(props: PageProps<"/w/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  return { title: { absolute: `Broneeri aeg · ${slug}` }, robots: { index: false } };
}

async function Load({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  // keel: ?lang= (vidina skript annab kodulehe keele) → brauseri keel → eesti
  const lang = parseLang(sp.lang) ?? detectLang((await headers()).get("accept-language"));
  const data = await loadWidget(slug);
  if (!data) {
    const exists = await db.query.businesses.findFirst({ where: eq(s.businesses.slug, slug), columns: { name: true } });
    if (!exists) notFound();
    return (
      <main className="grid min-h-dvh place-items-center bg-white p-6 text-center">
        <div>
          <p className="text-[17px] font-semibold">{exists.name}</p>
          <p className="mt-2 text-[14px] text-[#6b7280]">{lang === "en" ? "Online booking is not available right now. Please contact the business directly." : lang === "ru" ? "Онлайн-запись сейчас недоступна. Пожалуйста, свяжитесь с салоном напрямую." : "Online broneerimine pole hetkel saadaval. Palun võta teenusepakkujaga otse ühendust."}</p>
        </div>
      </main>
    );
  }
  return <Widget data={data} embed={sp.embed === "1"} lang={lang} />;
}

export default function WidgetPage(props: PageProps<"/w/[slug]">) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-white" />}>
      <Load params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}
