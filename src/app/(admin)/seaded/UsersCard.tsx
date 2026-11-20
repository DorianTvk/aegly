"use client";

import { useState, useTransition } from "react";
import { Mail, Trash2, UserPlus, X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, Button, Card, CardHeader } from "@/components/ui/primitives";
import { Dialog } from "@/components/ui/Dialog";
import { Flash } from "@/components/ui/Flash";
import { Field, FormMessage, Input, Select, type FormState } from "@/components/ui/form";
import { manageableRoles, type Role } from "@/lib/permissions";
import { cancelInvite, inviteUser, linkStaff, removeUser, setUserRole } from "./actions";

export type SettingsUser = { id: string; name: string; email: string; role: Role; isMe: boolean; staffId: string | null };
export type PendingInvite = { email: string; name: string; role: "ADMIN" | "STAFF"; expires: string };

const ROLE: Record<Role, string> = { OWNER: "Omanik", ADMIN: "Administraator", STAFF: "Töötaja" };

export function UsersCard({ me, users, invites, staff }: { me: { role: Role }; users: SettingsUser[]; invites: PendingInvite[]; staff: { id: string; name: string }[] }) {
  const can = manageableRoles(me.role);
  const [pending, start] = useTransition();
  const [form, setForm] = useState<{ name: string; email: string; role: "ADMIN" | "STAFF"; staffId: string | null } | null>(null);
  const [state, setState] = useState<FormState>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const linked = new Set(users.map((u) => u.staffId).filter(Boolean));

  const openInvite = () => {
    setState(null);
    setForm({ name: "", email: "", role: "STAFF", staffId: staff.find((s) => !linked.has(s.id))?.id ?? null });
  };

  return (
    <Card>
      <CardHeader
        title="Kasutajad ja rollid"
        subtitle="Omanik haldab kõike. Administraator haldab ettevõtet, aga mitte paketti ega kontot. Töötaja näeb oma kalendrit, broneeringuid ja kliente."
        action={
          can.length > 0 && (
            <Button size="sm" onClick={openInvite}>
              <UserPlus size={15} aria-hidden /> Kutsu kasutaja
            </Button>
          )
        }
      />
      {msg && (
        <Flash ok token={msg} className="mx-5 mt-4">
          {msg}
        </Flash>
      )}
      <ul className="divide-y divide-line-soft">
        {users.map((u) => {
          const manageable = !u.isMe && can.includes(u.role as "ADMIN" | "STAFF");
          return (
            <li key={u.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <Avatar name={u.name} color="#7a5af8" size={32} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {u.name} {u.isMe && <span className="text-muted">(sina)</span>}
                </p>
                <p className="text-xs text-muted">{u.email}</p>
              </div>
              {u.role === "STAFF" && manageable && (
                <Select
                  className="w-[190px]"
                  value={u.staffId ?? ""}
                  aria-label={`${u.name}: töötaja profiil`}
                  onChange={(e) => start(() => linkStaff(u.id, e.target.value || null))}
                >
                  <option value="">Profiil sidumata</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id} disabled={linked.has(s.id) && s.id !== u.staffId}>
                      Kalender: {s.name}
                    </option>
                  ))}
                </Select>
              )}
              {manageable && me.role === "OWNER" ? (
                <Select className="w-[160px]" value={u.role} onChange={(e) => start(() => setUserRole(u.id, e.target.value as "ADMIN" | "STAFF"))} aria-label={`${u.name} roll`}>
                  <option value="ADMIN">Administraator</option>
                  <option value="STAFF">Töötaja</option>
                </Select>
              ) : (
                <Badge tone="neutral" dot={false}>
                  {ROLE[u.role]}
                </Badge>
              )}
              {manageable && (
                <button
                  type="button"
                  aria-label={`Eemalda ${u.name}`}
                  onClick={() => window.confirm(`Eemaldada ${u.name}? Ta ei saa enam sisse logida.`) && start(() => removeUser(u.id))}
                  className="grid size-8 place-items-center rounded-lg text-muted hover:bg-bad-bg hover:text-bad"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </li>
          );
        })}
        {invites.map((i) => (
          <li key={i.email} className="flex flex-wrap items-center gap-3 bg-[#fcfcfd] px-5 py-3">
            <span className="grid size-8 place-items-center rounded-full bg-line-soft text-muted">
              <Mail size={15} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{i.name}</p>
              <p className="text-xs text-muted">
                {i.email} · kutse kehtib kuni {i.expires}
              </p>
            </div>
            <Badge tone="warn">Kutse ootel · {ROLE[i.role]}</Badge>
            {can.includes(i.role) && (
              <button type="button" aria-label={`Tühista kutse ${i.email}`} onClick={() => start(() => cancelInvite(i.email))} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-line-soft">
                <X size={15} />
              </button>
            )}
          </li>
        ))}
      </ul>

      <Dialog
        open={!!form}
        onClose={() => setForm(null)}
        title="Kutsu kasutaja"
        subtitle="Saadame kutse e-postiga. Kasutaja määrab ise parooli."
        footer={
          <>
            <Button onClick={() => setForm(null)}>Tühista</Button>
            <Button
              variant="primary"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await inviteUser(form!);
                  if (r?.ok) {
                    setMsg(r.message ?? null);
                    setForm(null);
                  } else setState(r);
                })
              }
            >
              {pending ? "Saadan…" : "Saada kutse"}
            </Button>
          </>
        }
      >
        {form && (
          <div className="space-y-4">
            <FormMessage state={state} />
            <Field label="Nimi" htmlFor="iName">
              <Input id="iName" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="E-post" htmlFor="iEmail">
              <Input id="iEmail" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Roll" htmlFor="iRole">
              <Select id="iRole" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as "ADMIN" | "STAFF" })}>
                {can.includes("STAFF") && <option value="STAFF">Töötaja – näeb oma kalendrit ja broneeringuid</option>}
                {can.includes("ADMIN") && <option value="ADMIN">Administraator – haldab ettevõtet</option>}
              </Select>
            </Field>
            {form.role === "STAFF" && (
              <Field label="Töötaja profiil" htmlFor="iStaff" hint="Kelle kalendrit see kasutaja näeb">
                <Select id="iStaff" value={form.staffId ?? ""} onChange={(e) => setForm({ ...form, staffId: e.target.value || null })}>
                  <option value="">Seon hiljem</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id} disabled={linked.has(s.id)}>
                      {s.name}
                      {linked.has(s.id) ? " (juba seotud)" : ""}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </div>
        )}
      </Dialog>
    </Card>
  );
}
