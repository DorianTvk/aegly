import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { loadWidget } from "@/server/widget";
import { Widget } from "./Widget";

export async function generateMetadata(props: PageProps<"/w/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  return { title: { absolute: `Broneeri aeg · ${slug}` }, robots: { index: false } };
}

async function Load({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const data = await loadWidget(slug);
  if (!data) notFound();
  return <Widget data={data} embed={sp.embed === "1"} />;
}

export default function WidgetPage(props: PageProps<"/w/[slug]">) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-white" />}>
      <Load params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}
