import "server-only";
import { getEditorOptions } from "@/server/services";

export async function editorProps(businessId: string) {
  const { categories, staff, business } = await getEditorOptions(businessId);
  return {
    categories: categories.map((c) => ({ id: c.id, name: c.name })),
    staff: staff.map((m) => ({ id: m.id, name: m.name, title: m.title, color: m.color })),
    defaults: {
      minLeadMinutes: business.minLeadMinutes,
      maxAdvanceDays: business.maxAdvanceDays,
      cancelUntilHours: business.cancelUntilHours,
      vatRate: business.vatRate,
    },
  };
}
