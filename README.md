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
npm test                      # loogika testid
```

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
- [ ] Sisselogimine ja registreerumine
- [ ] Ülejäänud halduspaneeli vaated
- [ ] Vabade aegade ja hinna mootor
- [ ] Broneerimisvidin (W0–W9), Stripe
- [ ] Teavitused, iseteenindus, ootenimekiri
