"use client";

import { useState, useTransition } from "react";
import { Ban, Check, CheckCheck, UserX } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { Dialog } from "@/components/ui/Dialog";
import { Field, FormMessage, Select, Textarea, type FormState } from "@/components/ui/form";
import { saveBookingNote, setBookingStatus } from "../actions";

export function BookingActions({ id, status, isPast }: { id: string; status: string; isPast: boolean }) {
  const [state, setState] = useState<FormState>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("Tühistas teenusepakkuja");
  const [pending, start] = useTransition();
  const run = (s: "CONFIRMED" | "COMPLETED" | "NO_SHOW" | "CANCELLED", r?: string) => start(async () => setState(await setBookingStatus(id, s, r)));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {(status === "PENDING_PAYMENT" || status === "HELD") && (
          <Button variant="primary" disabled={pending} onClick={() => run("CONFIRMED")}>
            <Check size={16} /> Kinnita broneering
          </Button>
        )}
        {status === "CONFIRMED" && (
          <>
            <Button variant={isPast ? "primary" : "secondary"} disabled={pending} onClick={() => run("COMPLETED")}>
              <CheckCheck size={16} /> Märgi lõpetatuks
            </Button>
            <Button disabled={pending} onClick={() => { if (confirm("Märkida, et klient ei ilmunud? See loeb mitteilmumise kaitse hulka.")) run("NO_SHOW"); }}>
              <UserX size={16} /> Ei ilmunud
            </Button>
          </>
        )}
        {(status === "COMPLETED" || status === "NO_SHOW") && (
          <Button disabled={pending} onClick={() => run("CONFIRMED")}>
            Taasta kinnitatuks
          </Button>
        )}
        {["HELD", "PENDING_PAYMENT", "CONFIRMED"].includes(status) && (
          <Button variant="ghost" className="text-bad" disabled={pending} onClick={() => setCancelOpen(true)}>
            <Ban size={16} /> Tühista
          </Button>
        )}
      </div>
      <FormMessage state={state} />
      <Dialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Tühista broneering"
        subtitle="Aeg vabaneb kalendris kohe ja ootenimekirjas olijad saavad teavituse"
        footer={
          <>
            <Button onClick={() => setCancelOpen(false)}>Jäta alles</Button>
            <Button variant="primary" className="border-danger bg-danger text-white hover:bg-[#d92d20]" disabled={pending} onClick={() => { run("CANCELLED", reason); setCancelOpen(false); }}>
              Tühista broneering
            </Button>
          </>
        }
      >
        <Field label="Põhjus" htmlFor="cReason">
          <Select id="cReason" value={reason} onChange={(e) => setReason(e.target.value)}>
            <option>Tühistas teenusepakkuja</option>
            <option>Klient tühistas telefoni teel</option>
            <option>Töötaja haigestus</option>
            <option>Topeltbroneering</option>
          </Select>
        </Field>
      </Dialog>
    </div>
  );
}

export function BookingNote({ id, note }: { id: string; note: string | null }) {
  const [v, setV] = useState(note ?? "");
  const [state, setState] = useState<FormState>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <Textarea rows={3} value={v} onChange={(e) => setV(e.target.value)} placeholder="Sisemine märge, kliendile ei kuvata" aria-label="Märge" />
      <div className="flex items-center justify-end gap-2">
        <FormMessage state={state} />
        <Button size="sm" disabled={pending || v === (note ?? "")} onClick={() => start(async () => setState(await saveBookingNote(id, v)))}>
          Salvesta märge
        </Button>
      </div>
    </div>
  );
}
