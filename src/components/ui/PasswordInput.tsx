"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { clsx } from "clsx";
import { Input } from "@/components/ui/form";
import { MIN_PASSWORD_LENGTH, checkPasswordPolicy, passwordScore } from "@/lib/password-policy";

const LABEL = ["Liiga nõrk", "Nõrk", "Rahuldav", "Hea", "Väga hea"];
const COLOR = ["bg-bad", "bg-warn", "bg-warn", "bg-ok", "bg-ok"];

/** Uue parooli väli: näita/peida nupp ja tugevuse riba (kontroll toimub ka serveris) */
export function PasswordInput({ id, name, invalid, context }: { id: string; name: string; invalid?: boolean; context?: { email?: string; name?: string } }) {
  const [value, setValue] = useState("");
  const [show, setShow] = useState(false);
  const score = passwordScore(value);
  const problem = value ? checkPasswordPolicy(value, context) : null;
  return (
    <div>
      <div className="relative">
        <Input
          id={id} name={name} type={show ? "text" : "password"} autoComplete="new-password" required maxLength={128}
          value={value} onChange={(e) => setValue(e.target.value)} aria-invalid={invalid} aria-describedby={`${id}-strength`} className="pr-11"
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? "Peida parool" : "Näita parooli"}
          aria-pressed={show}
          className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-muted hover:bg-line-soft hover:text-ink"
        >
          {show ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
      {value && (
        <div id={`${id}-strength`} className="mt-2" aria-live="polite">
          <div className="flex gap-1" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={clsx("h-1.5 flex-1 rounded-full", problem ? (i === 0 ? "bg-bad" : "bg-line") : i < score ? COLOR[score] : "bg-line")} />
            ))}
          </div>
          <p className={clsx("mt-1 text-xs", problem ? "text-bad" : "text-muted")}>
            {problem
              ? value.length < MIN_PASSWORD_LENGTH
                ? `${value.length}/${MIN_PASSWORD_LENGTH} märki`
                : problem
              : LABEL[score]}
          </p>
        </div>
      )}
    </div>
  );
}
