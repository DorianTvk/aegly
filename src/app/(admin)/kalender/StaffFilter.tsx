"use client";

import { useRouter, useSearchParams } from "next/navigation";

/** Töötaja filter kalendri tööriistaribal (muudab URL-i ?staff=) */
export function StaffFilter({ staff, value }: { staff: { id: string; name: string }[]; value: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  return (
    <select
      aria-label="Töötaja"
      value={value}
      onChange={(e) => {
        const q = new URLSearchParams(sp.toString());
        if (e.target.value) q.set("staff", e.target.value);
        else q.delete("staff");
        router.push(`/kalender?${q.toString()}`);
      }}
      className="h-[34px] rounded-[10px] border border-line bg-white pl-3 text-[13px] font-semibold text-ink"
    >
      <option value="">Kõik töötajad ({staff.length})</option>
      {staff.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name}
        </option>
      ))}
    </select>
  );
}
