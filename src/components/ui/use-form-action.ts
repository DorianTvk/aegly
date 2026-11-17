"use client";

import { startTransition, useActionState, type FormEvent } from "react";
import type { FormState } from "./form";

/**
 * Nagu useActionState, aga ei lähtesta vormi pärast toimingut.
 * (React 19 tühjendab `<form action>` väljad automaatselt – vea korral kaoks kasutaja sisestus.)
 * Kasutus: <form onSubmit={onSubmit}>
 */
export function useFormAction(action: (prev: FormState, data: FormData) => Promise<FormState>) {
  const [state, dispatch, pending] = useActionState<FormState, FormData>(action, null);
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => dispatch(data));
  };
  return [state, onSubmit, pending] as const;
}
