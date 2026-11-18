import { CalendarCheck, Check } from "lucide-react";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[1fr_520px]">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <div className="flex items-center gap-2.5">
          <span className="grid size-[34px] place-items-center rounded-[9px] bg-lime">
            <CalendarCheck size={18} className="text-ink" />
          </span>
          <span className="text-[17px] font-bold">Aegly</span>
        </div>
        <div className="mx-auto flex w-full max-w-[460px] flex-1 flex-col justify-center py-10">{children}</div>
      </div>
      <aside className="hidden flex-col justify-between bg-ink p-12 text-white lg:flex">
        <div />
        <div>
          <p className="text-[28px] leading-tight font-bold tracking-[-0.4px]">
            Broneeringud otse sinu kodulehel – ilma, et klient lahkuks.
          </p>
          <ul className="mt-8 space-y-3.5 text-[15px] text-[#d1d5db]">
            {[
              "Vabad ajad arvutatakse töötajate graafikust automaatselt",
              "Ettemaks ja makse kaardi või Apple/Google Payga",
              "Kampaaniad, sooduskoodid, paketid ja kinkekaardid",
              "Meeldetuletused e-posti ja SMS-iga",
            ].map((t) => (
              <li key={t} className="flex gap-3">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-lime text-ink">
                  <Check size={12} strokeWidth={3} />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>
        <nav aria-label="Õiguslik teave" className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-subtle">
          <a href="/tingimused" className="hover:text-white">Kasutustingimused</a>
          <a href="/privaatsus" className="hover:text-white">Privaatsuspoliitika</a>
          <a href="/andmetootlus" className="hover:text-white">Andmetöötlusleping</a>
        </nav>
      </aside>
    </div>
  );
}
