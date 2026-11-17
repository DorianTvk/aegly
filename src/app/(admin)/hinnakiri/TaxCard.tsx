"use client";

import { useState, useTransition } from "react";
import { Card, CardHeader } from "@/components/ui/primitives";
import { Field, FormMessage, Select, type FormState } from "@/components/ui/form";
import { Switch } from "@/components/ui/pickers";
import { saveTaxSettings } from "./actions";

export function TaxCard({ pricesIncludeVat, vatRate }: { pricesIncludeVat: boolean; vatRate: string }) {
  const [incl, setIncl] = useState(pricesIncludeVat);
  const [rate, setRate] = useState(String(Number(vatRate)));
  const [state, setState] = useState<FormState>(null);
  const [, start] = useTransition();
  const save = (next: { pricesIncludeVat: boolean; vatRate: string }) => start(async () => setState(await saveTaxSettings(next)));

  return (
    <Card>
      <CardHeader title="Valuuta ja maksud" />
      <div className="space-y-4 p-5">
        <Field label="Valuuta" htmlFor="cur">
          <Select id="cur" value="EUR" disabled>
            <option value="EUR">EUR (€)</option>
          </Select>
        </Field>
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm font-medium">Hinnad sisaldavad käibemaksu</span>
          <Switch
            checked={incl}
            label="Hinnad sisaldavad käibemaksu"
            onChange={(v) => {
              setIncl(v);
              save({ pricesIncludeVat: v, vatRate: rate });
            }}
          />
        </div>
        <Field label="Vaikimisi KM määr" htmlFor="vat" hint="Teenusel saab määrata erineva määra">
          <Select
            id="vat"
            value={rate}
            onChange={(e) => {
              setRate(e.target.value);
              save({ pricesIncludeVat: incl, vatRate: e.target.value });
            }}
          >
            <option value="24">24%</option>
            <option value="22">22%</option>
            <option value="13">13%</option>
            <option value="9">9%</option>
            <option value="0">0% (KM-ta)</option>
          </Select>
        </Field>
        <FormMessage state={state} />
      </div>
    </Card>
  );
}
