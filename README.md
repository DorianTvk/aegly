# Aegly

Broneerimistarkvara ilu- ja heaolusalongidele: halduspaneel ettevõttele ja broneerimisvidin salongi kodulehele.
Disain: Figma „AEGLY“ (vahelehed OVERVIEW, ADMIN PANEL, WEB WIDGET).

## Tehnoloogia

- **Next.js 16** (App Router, Cache Components), TypeScript, Tailwind CSS 4
- **PostgreSQL** + **Drizzle ORM** (`src/db/schema.ts`)
- **Stripe Connect** maksete jaoks (tulekul)
- Ikoonid: `lucide-react`, fondid: Inter ja JetBrains Mono

## Käivitamine

```bash
cp .env.example .env          # DATABASE_URL
npm install
npm run db:migrate            # loob tabelid
npm run db:seed               # Studio Lumi näidisandmed
npm run dev                   # http://localhost:3000
npm test                      # loogika testid (vitest)
npm run test:smoke            # brauseritest töötava rakenduse vastu (BASE_URL, CHROME_PATH)
```

Näidiskonto: **triin@studiolumi.ee** / **aegly-demo**

## Struktuur

| Kaust | Sisu |
| --- | --- |
| `src/app/(admin)` | Halduspaneeli vaated (00–19 Figmas) |
| `src/components` | Kest (küljeriba, päis) ja UI põhikomponendid |
| `src/db` | Andmemudel, ühendus, näidisandmed |
| `src/lib` | Puhas loogika: ajad, graafikud (testitud) |
| `src/server` | Andmebaasipäringud vaadetele |

## Seis

- [x] Andmemudel (12 objekti raportist + kinkekaardid, mitme salongi tugi)
- [x] Halduspaneeli kest, 01 Töölaud, 02 Kalender (päevavaade)
- [x] Sisselogimine ja registreerumine (sessioonid andmebaasis, scrypt)
- [x] 03–04 Teenused ja kategooriad, 06–07 Töötajad (profiil, teenused, tööaeg, puudumised), 08 Tööajad ja vabad ajad
- [x] Vabade aegade mootor (testitud raporti näitega) ja Eesti riigipühad
- [x] Hinna mootor (raporti 3 näidet testides) ja vaated 05 Paketid, 09 Hinnakiri, 10 Sooduskoodid, 11 Kampaaniad
- [x] 14–15 Kliendid ja kliendikaart (mitteilmumise kaitse, märkmed, GDPR eksport/kustutus), 16 Uus broneering, broneeringu vaade, 17 Kinkekaardid
- [x] 12 Broneerimisvidina seaded, 13 Ettevõtte profiil (logo/bänner), 18 Aruanded, 19 Teavitused (mallid), Seaded (kasutajad, kaitse, konto)
- [x] Aegly paketid (Solo 9 €, Salong 19 €, Suur salong 29 € kuus + km): valik registreerumisel (`/registreeru?pakett=solo&periood=year`), töötajate piirang, Seaded → Pakett ja arveldus, superadmin-vaade `/platvorm` (`SUPERADMIN_EMAILS`)
- [ ] Broneerimisvidin (W0–W9), mobiilivaated, kliendi iseteenindus
- [ ] Teavituste saatmine (e-posti ja SMS-i teenusepakkuja)
- [ ] Stripe Connect maksed ja Stripe Billing (paketi kuumaks)
- [ ] Teavitused, iseteenindus, ootenimekiri
