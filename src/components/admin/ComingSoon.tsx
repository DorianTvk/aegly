import { Card, PageHeader } from "@/components/ui/primitives";

/** Ajutine vaade, kuni see osa on ehitatud. */
export function ComingSoon({ title, figma }: { title: string; figma: string }) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} />
      <Card className="p-8 text-sm text-muted">
        See vaade on töös. Disain: Figma <span className="font-mono text-ink">{figma}</span>.
      </Card>
    </div>
  );
}
